package rollout

import (
	"context"
	"fmt"
	"log"
	"math"
	"time"

	"github.com/jackc/pgx/v5/pgtype"
	db "github.com/ota-robot/api/internal/db/generated"
)

// Option allows customizing the Manager behavior.
type Option func(*Manager)

// WithObservationWindow sets the time duration to wait between canary phases.
func WithObservationWindow(window time.Duration) Option {
	return func(m *Manager) {
		m.obsWindow = window
	}
}

// Manager is the deep rollout lifecycle module that concentrates
// state transitions, phase progression, completion, dispatch, and rollback.
type Manager struct {
	queries    *db.Queries
	dispatcher CommandDispatcher
	obsWindow  time.Duration
}

// NewManager creates a new Manager instance.
func NewManager(queries *db.Queries, dispatcher CommandDispatcher, opts ...Option) *Manager {
	m := &Manager{
		queries:    queries,
		dispatcher: dispatcher,
		obsWindow:  DefaultObservationWindow,
	}
	for _, opt := range opts {
		opt(m)
	}
	return m
}

// StartRollout begins execution of a deployment according to its strategy.
func (m *Manager) StartRollout(ctx context.Context, depID pgtype.UUID, strategy string, targetDevices []db.Device, cmd map[string]string) error {
	if len(targetDevices) == 0 {
		return fmt.Errorf("cannot start rollout with zero target devices")
	}

	if strategy == "canary" {
		go m.runCanary(depID, targetDevices, cmd)
		return nil
	}

	// Direct deployment strategy: dispatch to all devices concurrently
	for _, dev := range targetDevices {
		if err := m.dispatcher.PublishCommand(dev.ID, cmd); err != nil {
			log.Printf("[rollout] direct dispatch error for device %s: %v", dev.ID, err)
		}
	}

	// Ensure phase 3 (100%) is recorded for direct deployments
	_, _ = m.queries.UpdateDeploymentPhase(ctx, db.UpdateDeploymentPhaseParams{
		ID:               depID,
		CurrentPhase:     3,
		CanaryPercentage: 100,
	})

	return nil
}

// runCanary executes the three-phase canary rollout sequence in the background.
func (m *Manager) runCanary(depID pgtype.UUID, devices []db.Device, cmd map[string]string) {
	n := len(devices)
	if n == 0 {
		return
	}

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
		cur, err := m.queries.GetDeployment(ctx, depID)
		if err != nil || cur.Status != "running" {
			log.Printf("[rollout] deployment %v halted before phase %d (status=%s)", depID, p.phaseNum, cur.Status)
			return
		}

		_, _ = m.queries.UpdateDeploymentPhase(ctx, db.UpdateDeploymentPhaseParams{
			ID:               depID,
			CurrentPhase:     p.phaseNum,
			CanaryPercentage: p.percentage,
		})
		log.Printf("[rollout] deployment %v -> phase %d (%d%%) with %d device(s)", depID, p.phaseNum, p.percentage, len(p.devices))

		for _, dev := range p.devices {
			if err := m.dispatcher.PublishCommand(dev.ID, cmd); err != nil {
				log.Printf("[rollout] publish command error for device %s: %v", dev.ID, err)
			}
		}

		isLastPhase := p.phaseNum == 3 || (p2End == n && p.phaseNum == 2)
		if isLastPhase {
			break
		}

		if aborted := m.observeWindow(depID, p.phaseNum, m.obsWindow); aborted {
			return
		}
	}

	ctx := context.Background()
	cur, err := m.queries.GetDeployment(ctx, depID)
	if err == nil && cur.Status != "rolled_back" && cur.Status != "failed" {
		_, _ = m.queries.UpdateDeploymentPhase(ctx, db.UpdateDeploymentPhaseParams{
			ID:               depID,
			CurrentPhase:     3,
			CanaryPercentage: 100,
		})
	}
}

// observeWindow waits for the observation duration while polling for status abort.
func (m *Manager) observeWindow(depID pgtype.UUID, phaseNum int32, window time.Duration) bool {
	ticker := time.NewTicker(500 * time.Millisecond)
	defer ticker.Stop()
	deadline := time.Now().Add(window)

	for range ticker.C {
		if time.Now().After(deadline) {
			return false
		}
		dep, err := m.queries.GetDeployment(context.Background(), depID)
		if err != nil || dep.Status != "running" {
			log.Printf("[rollout] deployment %v aborted during phase %d observation (status=%s)", depID, phaseNum, dep.Status)
			return true
		}
	}
	return false
}

// HandleDeviceProgress processes an incoming status/progress report from a device.
func (m *Manager) HandleDeviceProgress(ctx context.Context, event DeviceProgressEvent) error {
	activeDD, err := m.queries.GetActiveDeploymentDeviceByDevice(ctx, event.DeviceID)
	if err != nil {
		return fmt.Errorf("no active deployment found for device %s: %w", event.DeviceID, err)
	}

	_, err = m.queries.UpdateDeploymentDeviceStatus(ctx, db.UpdateDeploymentDeviceStatusParams{
		DeploymentID: activeDD.DeploymentID,
		DeviceID:     event.DeviceID,
		Status:       event.Status,
		Progress:     event.Progress,
		ErrorMessage: pgtype.Text{Valid: false},
	})
	if err != nil {
		return fmt.Errorf("failed to update device status: %w", err)
	}

	if event.Status == "success" && event.Progress == 100 {
		dep, err := m.queries.GetDeployment(ctx, activeDD.DeploymentID)
		if err != nil {
			return fmt.Errorf("failed to fetch deployment: %w", err)
		}
		if dep.Status == "rolled_back" || dep.Status == "failed" {
			return nil
		}

		_ = m.queries.IncrementDeploymentSuccess(ctx, activeDD.DeploymentID)

		fw, err := m.queries.GetFirmwareVersion(ctx, dep.FirmwareVersionID)
		if err == nil {
			_, _ = m.queries.UpdateDeviceVersion(ctx, db.UpdateDeviceVersionParams{
				ID:             event.DeviceID,
				CurrentVersion: fw.Version,
			})
		}

		// Check completion invariant: all targets reached terminal state
		if dep.SuccessCount+1+dep.FailureCount >= dep.TotalDevices {
			_, _ = m.queries.UpdateDeploymentStatus(ctx, db.UpdateDeploymentStatusParams{
				ID:     activeDD.DeploymentID,
				Status: "completed",
			})
			if dep.Strategy == "canary" {
				_, _ = m.queries.UpdateDeploymentPhase(ctx, db.UpdateDeploymentPhaseParams{
					ID:               activeDD.DeploymentID,
					CurrentPhase:     3,
					CanaryPercentage: 100,
				})
			}
		}
	}

	return nil
}

// HandleDeviceError processes an error event reported by a device and evaluates rollback invariants.
func (m *Manager) HandleDeviceError(ctx context.Context, event DeviceErrorEvent) error {
	activeDD, err := m.queries.GetActiveDeploymentDeviceByDevice(ctx, event.DeviceID)
	if err != nil {
		return fmt.Errorf("no active deployment found for device %s: %w", event.DeviceID, err)
	}

	if activeDD.Status == "success" || activeDD.Status == "failed" {
		return nil
	}

	_, err = m.queries.UpdateDeploymentDeviceStatus(ctx, db.UpdateDeploymentDeviceStatusParams{
		DeploymentID: activeDD.DeploymentID,
		DeviceID:     event.DeviceID,
		Status:       "failed",
		Progress:     activeDD.Progress,
		ErrorMessage: pgtype.Text{String: event.Error, Valid: true},
	})
	if err != nil {
		return fmt.Errorf("failed to update failed device status: %w", err)
	}

	_ = m.queries.IncrementDeploymentFailure(ctx, activeDD.DeploymentID)

	dep, err := m.queries.GetDeployment(ctx, activeDD.DeploymentID)
	if err != nil {
		return fmt.Errorf("failed to fetch deployment: %w", err)
	}

	// Calculate failure rate across total devices
	failureRate := float64(dep.FailureCount+1) / float64(dep.TotalDevices)
	if dep.Status == "running" && failureRate >= dep.RollbackThreshold {
		log.Printf("[rollout] auto-rollback triggered: deployment %v failure rate %.2f >= threshold %.2f",
			dep.ID, failureRate, dep.RollbackThreshold)
		return m.ExecuteRollback(ctx, dep.ID, fmt.Sprintf("failure rate %.2f breached threshold %.2f", failureRate, dep.RollbackThreshold))
	}

	// If all devices finished without breaching rollback threshold
	if dep.SuccessCount+dep.FailureCount+1 >= dep.TotalDevices {
		_, _ = m.queries.UpdateDeploymentStatus(ctx, db.UpdateDeploymentStatusParams{
			ID:     activeDD.DeploymentID,
			Status: "completed",
		})
	}

	return nil
}

// ExecuteRollback is the single canonical implementation for rolling back a deployment.
func (m *Manager) ExecuteRollback(ctx context.Context, depID pgtype.UUID, reason string) error {
	dep, err := m.queries.GetDeployment(ctx, depID)
	if err != nil {
		return fmt.Errorf("failed to retrieve deployment %v for rollback: %w", depID, err)
	}

	if dep.Status == "rolled_back" {
		return nil
	}

	_, err = m.queries.UpdateDeploymentStatus(ctx, db.UpdateDeploymentStatusParams{
		ID:     dep.ID,
		Status: "rolled_back",
	})
	if err != nil {
		return fmt.Errorf("failed to update deployment status to rolled_back: %w", err)
	}

	devs, err := m.queries.ListDeploymentDevices(ctx, dep.ID)
	if err != nil {
		return fmt.Errorf("failed to list deployment devices for rollback: %w", err)
	}

	for _, d := range devs {
		prevVer := "1.0.0"
		if d.PreviousVersion.Valid && d.PreviousVersion.String != "" {
			prevVer = d.PreviousVersion.String
		}

		rollbackCmd := map[string]string{
			"action":  "rollback",
			"version": prevVer,
			"reason":  reason,
		}

		if pubErr := m.dispatcher.PublishCommand(d.DeviceID, rollbackCmd); pubErr != nil {
			log.Printf("[rollout] rollback publish command error for device %s: %v", d.DeviceID, pubErr)
		}

		_, _ = m.queries.UpdateDeviceVersion(ctx, db.UpdateDeviceVersionParams{
			ID:             d.DeviceID,
			CurrentVersion: prevVer,
		})
	}

	log.Printf("[rollout] deployment %v successfully rolled back (%d devices reverted, reason=%s)",
		dep.ID, len(devs), reason)
	return nil
}

// Reconcile checks if all devices for a deployment have completed and updates the deployment status accordingly.
func (m *Manager) Reconcile(ctx context.Context, depID pgtype.UUID) (*db.Deployment, error) {
	dep, err := m.queries.GetDeployment(ctx, depID)
	if err != nil {
		return nil, err
	}

	if dep.TotalDevices > 0 && (dep.SuccessCount+dep.FailureCount >= dep.TotalDevices) && dep.Status != "rolled_back" && dep.Status != "failed" {
		if dep.Status != "completed" {
			updated, err := m.queries.UpdateDeploymentStatus(ctx, db.UpdateDeploymentStatusParams{
				ID:     dep.ID,
				Status: "completed",
			})
			if err == nil {
				dep = updated
			}
		}
		if dep.Strategy == "canary" && dep.CurrentPhase < 3 {
			updated, err := m.queries.UpdateDeploymentPhase(ctx, db.UpdateDeploymentPhaseParams{
				ID:               dep.ID,
				CurrentPhase:     3,
				CanaryPercentage: 100,
			})
			if err == nil {
				dep = updated
			}
		}
	}

	return &dep, nil
}

// clampPhaseEnd calculates the ceiling slice-end index for a given fraction.
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
