package agent_test

import (
	"testing"

	"github.com/ota-robot/robot-sim/internal/agent"
)

func TestStateMachine_NominalLifecycle(t *testing.T) {
	var transitions []string
	sm := agent.NewStateMachine("test-robot-01", func(from, to agent.State, event agent.Event) {
		transitions = append(transitions, string(from)+"->"+string(to))
	})

	if !sm.Is(agent.StateIdle) {
		t.Fatalf("expected initial state idle, got %s", sm.GetState())
	}

	// 1. Boot to Online
	if err := sm.Trigger(agent.EventBootOK); err != nil {
		t.Fatalf("unexpected error on boot: %v", err)
	}
	if !sm.Is(agent.StateOnline) {
		t.Fatalf("expected state online, got %s", sm.GetState())
	}

	// 2. Receive Update Command
	if err := sm.Trigger(agent.EventUpdateCommand); err != nil {
		t.Fatalf("unexpected error on update cmd: %v", err)
	}
	if !sm.Is(agent.StateDownloading) {
		t.Fatalf("expected state downloading, got %s", sm.GetState())
	}

	// 3. Download Complete
	if err := sm.Trigger(agent.EventDownloadOK); err != nil {
		t.Fatalf("unexpected error on download ok: %v", err)
	}
	if !sm.Is(agent.StateVerifying) {
		t.Fatalf("expected state verifying, got %s", sm.GetState())
	}

	// 4. Verify Complete
	if err := sm.Trigger(agent.EventVerifyOK); err != nil {
		t.Fatalf("unexpected error on verify ok: %v", err)
	}
	if !sm.Is(agent.StateInstalling) {
		t.Fatalf("expected state installing, got %s", sm.GetState())
	}

	// 5. Install Complete
	if err := sm.Trigger(agent.EventInstallOK); err != nil {
		t.Fatalf("unexpected error on install ok: %v", err)
	}
	if !sm.Is(agent.StateRebooting) {
		t.Fatalf("expected state rebooting, got %s", sm.GetState())
	}

	// 6. Reboot Complete
	if err := sm.Trigger(agent.EventRebootOK); err != nil {
		t.Fatalf("unexpected error on reboot ok: %v", err)
	}
	if !sm.Is(agent.StateOnline) {
		t.Fatalf("expected state online, got %s", sm.GetState())
	}

	expectedCount := 6
	if len(transitions) != expectedCount {
		t.Errorf("expected %d transitions, got %d: %v", expectedCount, len(transitions), transitions)
	}
}

func TestStateMachine_VerificationFailureAndRollback(t *testing.T) {
	sm := agent.NewStateMachine("test-robot-02", nil)
	_ = sm.Trigger(agent.EventBootOK)
	_ = sm.Trigger(agent.EventUpdateCommand)
	_ = sm.Trigger(agent.EventDownloadOK)

	// Verification fails (e.g. signature mismatch or tampered payload)
	if err := sm.Trigger(agent.EventVerifyFail); err != nil {
		t.Fatalf("unexpected error on verify fail: %v", err)
	}
	if !sm.Is(agent.StateError) {
		t.Fatalf("expected state error, got %s", sm.GetState())
	}

	// Rollback command dispatched
	if err := sm.Trigger(agent.EventRollbackCommand); err != nil {
		t.Fatalf("unexpected error on rollback cmd: %v", err)
	}
	if !sm.Is(agent.StateRollingBack) {
		t.Fatalf("expected state rolling_back, got %s", sm.GetState())
	}

	// Rollback completes
	if err := sm.Trigger(agent.EventRollbackComplete); err != nil {
		t.Fatalf("unexpected error on rollback done: %v", err)
	}
	if !sm.Is(agent.StateOnline) {
		t.Fatalf("expected state online, got %s", sm.GetState())
	}
}

func TestStateMachine_InvalidTransitionRejected(t *testing.T) {
	sm := agent.NewStateMachine("test-robot-03", nil)

	// Trying to trigger install from idle must fail
	err := sm.Trigger(agent.EventInstallOK)
	if err == nil {
		t.Fatalf("expected error on invalid transition, got nil")
	}
}
