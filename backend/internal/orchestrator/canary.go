// Package orchestrator provides the Canary Rollout and Auto-Rollback engine
// for OTA firmware deployments. Business logic is separated here from HTTP
// handlers to keep handler files thin and to allow independent unit testing.
package orchestrator

import (
	"context"
	"log"
	"math"
	"time"

	"github.com/jackc/pgx/v5/pgtype"
	db "github.com/ota-robot/api/internal/db/generated"
	mymqtt "github.com/ota-robot/api/internal/mqtt"
)

// PhaseConfig describes the canary phases and their target percentages.
var PhaseConfig = []struct {
	PhaseNum   int32
	Percentage int32
	Fraction   float64
}{
	{PhaseNum: 1, Percentage: 20, Fraction: 0.20},
	{PhaseNum: 2, Percentage: 60, Fraction: 0.60},
	{PhaseNum: 3, Percentage: 100, Fraction: 1.00},
}

// ObservationWindow is the time the orchestrator waits between phases
// to check for failures before promoting to the next phase.
const ObservationWindow = 15 * time.Second

// CanaryOrchestrator drives a phased canary rollout for a given deployment.
type CanaryOrchestrator struct {
	queries    *db.Queries
	mqttClient *mymqtt.Client
}

// NewCanaryOrchestrator creates a new CanaryOrchestrator.
func NewCanaryOrchestrator(queries *db.Queries, mqttClient *mymqtt.Client) *CanaryOrchestrator {
	return &CanaryOrchestrator{
		queries:    queries,
		mqttClient: mqttClient,
	}
}

// Run executes the full Canary Rollout for the given deployment in three
// phases (20% → 60% → 100%), pausing between phases to observe failure rate.
// It is designed to be called as a goroutine.
//
// If the deployment status changes to anything other than "running" during an
// observation window, the rollout is halted automatically (Auto-Rollback is
// expected to have been triggered externally via the monitoring path).
func (o *CanaryOrchestrator) Run(depID pgtype.UUID, devices []db.Device, cmd map[string]string) {
	n := len(devices)
	if n == 0 {
		log.Printf("[canary] deployment %v has no target devices — aborting", depID)
		return
	}

	// Calculate slice boundaries for each phase
	p1End := clampPhaseEnd(n, 0.20)
	p2End := clampPhaseEnd(n, 0.60)
	if p2End <= p1End && p1End < n {
		p2End = p1End + 1
	}

	phases := []struct {
		phaseNum   int32
		percentage int32
		devices    []db.Device
	}{
		{phaseNum: 1, percentage: 20, devices: devices[:p1End]},
		{phaseNum: 2, percentage: 60, devices: devices[p1End:p2End]},
		{phaseNum: 3, percentage: 100, devices: devices[p2End:]},
	}

	for _, p := range phases {
		if len(p.devices) == 0 {
			continue
		}

		ctx := context.Background()

		// Abort if deployment is no longer in "running" state
		cur, err := o.queries.GetDeployment(ctx, depID)
		if err != nil || cur.Status != "running" {
			log.Printf("[canary] deployment %v halted before Phase %d (status=%s)", depID, p.phaseNum, cur.Status)
			return
		}

		// Persist current phase in DB
		_, _ = o.queries.UpdateDeploymentPhase(ctx, db.UpdateDeploymentPhaseParams{
			ID:               depID,
			CurrentPhase:     p.phaseNum,
			CanaryPercentage: p.percentage,
		})
		log.Printf("[canary] deployment %v → Phase %d (%d%%) dispatching %d device(s)", depID, p.phaseNum, p.percentage, len(p.devices))

		// Dispatch OTA command to this phase's devices
		for _, dev := range p.devices {
			if pubErr := o.mqttClient.PublishCommand(dev.ID, cmd); pubErr != nil {
				log.Printf("[canary] MQTT publish error for device %s: %v", dev.ID, pubErr)
			}
		}

		// Last phase — no observation window needed
		isLastPhase := p.phaseNum == 3 || (p2End == n && p.phaseNum == 2)
		if isLastPhase {
			break
		}

		// Observation window: poll DB every second for early abort
		log.Printf("[canary] deployment %v Phase %d observation window (%s)…", depID, p.phaseNum, ObservationWindow)
		if aborted := o.observeWindow(depID, p.phaseNum, ObservationWindow); aborted {
			return
		}
	}

	log.Printf("[canary] deployment %v rollout complete", depID)
}

// observeWindow polls the deployment status once per second for the given
// duration. Returns true if the rollout was aborted (status ≠ "running").
func (o *CanaryOrchestrator) observeWindow(depID pgtype.UUID, phaseNum int32, window time.Duration) bool {
	ticker := time.NewTicker(1 * time.Second)
	defer ticker.Stop()
	deadline := time.Now().Add(window)

	for range ticker.C {
		if time.Now().After(deadline) {
			return false
		}
		dep, err := o.queries.GetDeployment(context.Background(), depID)
		if err != nil || dep.Status != "running" {
			log.Printf("[canary] deployment %v aborted during Phase %d window (status=%s)", depID, phaseNum, dep.Status)
			return true
		}
	}
	return false
}

// clampPhaseEnd calculates the ceiling slice-end index for a given fraction
// and ensures it stays within [1, n].
func clampPhaseEnd(n int, fraction float64) int {
	end := int(math.Ceil(float64(n) * fraction))
	if end < 1 {
		end = 1
	}
	if end > n {
		end = n
	}
	return end
}
