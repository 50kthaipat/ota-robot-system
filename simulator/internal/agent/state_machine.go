// Package agent implements the OTA Robot Agent state machine.
// It models the lifecycle of a firmware update operation on an
// industrial robot node, transitioning through well-defined states.
//
// State diagram (thesis Chapter 3.3):
//
//	         ┌────────┐
//	         │  IDLE  │◄──────────────────────────────┐
//	         └───┬────┘                               │
//	             │ command: update                     │
//	             ▼                                     │
//	      ┌─────────────┐                             │
//	      │ DOWNLOADING │                             │
//	      └──────┬──────┘                             │
//	             │ download OK                         │ error / rollback cmd
//	             ▼                                     │
//	      ┌─────────────┐                             │
//	      │  VERIFYING  │──── hash/sig mismatch ──────┤
//	      └──────┬──────┘                             │
//	             │ verified                            │
//	             ▼                                     │
//	      ┌─────────────┐                             │
//	      │  INSTALLING │──── flash fault ────────────┤
//	      └──────┬──────┘                             │
//	             │ success                             │
//	             ▼                                     │
//	      ┌─────────────┐                             │
//	      │   REBOOTING │                             │
//	      └──────┬──────┘                             │
//	             │ boot OK                             │
//	             ▼                                     │
//	         ┌────────┐                               │
//	         │ ONLINE │───────── rollback cmd ─────────┘
//	         └────────┘
package agent

import "fmt"

// State represents the current lifecycle state of the robot OTA agent.
type State string

const (
	StateIdle        State = "idle"
	StateDownloading State = "downloading"
	StateVerifying   State = "verifying"
	StateInstalling  State = "installing"
	StateRebooting   State = "rebooting"
	StateOnline      State = "online"
	StateRollingBack State = "rolling_back"
	StateError       State = "error"
)

// Event represents a trigger that causes a state transition.
type Event string

const (
	EventUpdateCommand    Event = "cmd_update"
	EventDownloadOK       Event = "download_ok"
	EventDownloadFail     Event = "download_fail"
	EventVerifyOK         Event = "verify_ok"
	EventVerifyFail       Event = "verify_fail"
	EventInstallOK        Event = "install_ok"
	EventInstallFail      Event = "install_fail"
	EventRebootOK         Event = "reboot_ok"
	EventRollbackCommand  Event = "cmd_rollback"
	EventRollbackComplete Event = "rollback_done"
)

// transition defines valid state transitions in the OTA agent state machine.
var transitions = map[State]map[Event]State{
	StateIdle: {
		EventUpdateCommand: StateDownloading,
	},
	StateDownloading: {
		EventDownloadOK:   StateVerifying,
		EventDownloadFail: StateError,
	},
	StateVerifying: {
		EventVerifyOK:   StateInstalling,
		EventVerifyFail: StateError,
	},
	StateInstalling: {
		EventInstallOK:   StateRebooting,
		EventInstallFail: StateError,
	},
	StateRebooting: {
		EventRebootOK: StateOnline,
	},
	StateOnline: {
		EventRollbackCommand: StateRollingBack,
		EventUpdateCommand:   StateDownloading,
	},
	StateRollingBack: {
		EventRollbackComplete: StateOnline,
		EventInstallFail:      StateError,
	},
	StateError: {
		EventRollbackCommand: StateRollingBack,
	},
}

// StateMachine manages the current state of a robot OTA agent.
type StateMachine struct {
	Current  State
	DeviceID string
	OnChange func(from, to State, event Event)
}

// NewStateMachine creates a new StateMachine starting in StateIdle.
func NewStateMachine(deviceID string, onChange func(from, to State, event Event)) *StateMachine {
	return &StateMachine{
		Current:  StateIdle,
		DeviceID: deviceID,
		OnChange: onChange,
	}
}

// Trigger applies an event to the current state, performing the transition
// if valid. Returns an error if the event is not allowed from the current state.
func (sm *StateMachine) Trigger(event Event) error {
	nextMap, ok := transitions[sm.Current]
	if !ok {
		return fmt.Errorf("[state_machine] device=%s: no transitions defined for state %q", sm.DeviceID, sm.Current)
	}
	next, ok := nextMap[event]
	if !ok {
		return fmt.Errorf("[state_machine] device=%s: event %q not allowed from state %q", sm.DeviceID, event, sm.Current)
	}
	prev := sm.Current
	sm.Current = next
	if sm.OnChange != nil {
		sm.OnChange(prev, next, event)
	}
	return nil
}

// Is returns true if the state machine is currently in the given state.
func (sm *StateMachine) Is(s State) bool {
	return sm.Current == s
}
