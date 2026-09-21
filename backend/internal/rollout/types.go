package rollout

import (
	"context"
	"time"

	"github.com/jackc/pgx/v5/pgtype"
	db "github.com/ota-robot/api/internal/db/generated"
)

// CommandDispatcher abstracts sending deployment or rollback commands to edge devices.
type CommandDispatcher interface {
	PublishCommand(deviceID string, cmd interface{}) error
}

// DeviceProgressEvent represents an incoming progress update from an edge device.
type DeviceProgressEvent struct {
	DeviceID string
	Status   string
	Progress int32
}

// DeviceErrorEvent represents an error event reported by an edge device.
type DeviceErrorEvent struct {
	DeviceID string
	Error    string
}

// PhaseConfig defines the canonical progression percentages for canary phases.
var PhaseConfig = []struct {
	PhaseNum   int32
	Percentage int32
	Fraction   float64
}{
	{PhaseNum: 1, Percentage: 20, Fraction: 0.20},
	{PhaseNum: 2, Percentage: 60, Fraction: 0.60},
	{PhaseNum: 3, Percentage: 100, Fraction: 1.00},
}

// DefaultObservationWindow is the default duration to wait between canary phases.
const DefaultObservationWindow = 15 * time.Second

// LifecycleManager defines the deep module interface for managing rollout operations.
type LifecycleManager interface {
	StartRollout(ctx context.Context, depID pgtype.UUID, strategy string, targetDevices []db.Device, cmd map[string]string) error
	HandleDeviceProgress(ctx context.Context, event DeviceProgressEvent) error
	HandleDeviceError(ctx context.Context, event DeviceErrorEvent) error
	ExecuteRollback(ctx context.Context, depID pgtype.UUID, reason string) error
	Reconcile(ctx context.Context, depID pgtype.UUID) (*db.Deployment, error)
}
