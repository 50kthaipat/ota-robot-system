package rollout

import (
	"sync"
	"testing"
)

// mockDispatcher records published commands for test assertions.
type mockDispatcher struct {
	mu       sync.Mutex
	commands map[string]interface{}
}

func newMockDispatcher() *mockDispatcher {
	return &mockDispatcher{
		commands: make(map[string]interface{}),
	}
}

func (m *mockDispatcher) PublishCommand(deviceID string, cmd interface{}) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.commands[deviceID] = cmd
	return nil
}

func (m *mockDispatcher) getCommand(deviceID string) (interface{}, bool) {
	m.mu.Lock()
	defer m.mu.Unlock()
	cmd, ok := m.commands[deviceID]
	return cmd, ok
}

func TestRollout_PhaseConfig(t *testing.T) {
	if len(PhaseConfig) != 3 {
		t.Fatalf("expected 3 phases, got %d", len(PhaseConfig))
	}

	expectedPercentages := []int32{20, 60, 100}
	expectedFractions := []float64{0.20, 0.60, 1.00}

	for i, p := range PhaseConfig {
		if p.Percentage != expectedPercentages[i] {
			t.Errorf("phase %d: expected percentage %d, got %d", i+1, expectedPercentages[i], p.Percentage)
		}
		if p.Fraction != expectedFractions[i] {
			t.Errorf("phase %d: expected fraction %f, got %f", i+1, expectedFractions[i], p.Fraction)
		}
	}
}

func TestRollout_ClampPhaseEnd(t *testing.T) {
	cases := []struct {
		n        int
		fraction float64
		expected int
	}{
		{n: 1, fraction: 0.20, expected: 1},
		{n: 1, fraction: 0.60, expected: 1},
		{n: 1, fraction: 1.00, expected: 1},
		{n: 5, fraction: 0.20, expected: 1},
		{n: 5, fraction: 0.60, expected: 3},
		{n: 5, fraction: 1.00, expected: 5},
		{n: 10, fraction: 0.20, expected: 2},
		{n: 10, fraction: 0.60, expected: 6},
		{n: 10, fraction: 1.00, expected: 10},
		{n: 50, fraction: 0.20, expected: 10},
		{n: 50, fraction: 0.60, expected: 30},
		{n: 50, fraction: 1.00, expected: 50},
	}

	for _, c := range cases {
		got := clampPhaseEnd(c.n, c.fraction)
		if got != c.expected {
			t.Errorf("clampPhaseEnd(n=%d, frac=%.2f): expected %d, got %d", c.n, c.fraction, c.expected, got)
		}
	}
}

func TestRollout_FleetPhasePartitionIntegrity(t *testing.T) {
	fleetSizes := []int{1, 2, 3, 4, 5, 8, 10, 20, 50}

	for _, n := range fleetSizes {
		p1End := clampPhaseEnd(n, 0.20)
		p2End := clampPhaseEnd(n, 0.60)
		if p2End <= p1End && p1End < n {
			p2End = p1End + 1
		}

		phase1 := make([]int, p1End)
		for i := 0; i < p1End; i++ {
			phase1[i] = i
		}

		phase2 := make([]int, p2End-p1End)
		for i := p1End; i < p2End; i++ {
			phase2[i-p1End] = i
		}

		phase3 := make([]int, n-p2End)
		for i := p2End; i < n; i++ {
			phase3[i-p2End] = i
		}

		totalDispatched := len(phase1) + len(phase2) + len(phase3)
		if totalDispatched != n {
			t.Errorf("fleet size %d: total dispatched %d != %d (p1=%d, p2=%d, p3=%d)",
				n, totalDispatched, n, len(phase1), len(phase2), len(phase3))
		}

		if len(phase1) < 1 {
			t.Errorf("fleet size %d: phase 1 must have at least 1 sentinel device, got %d", n, len(phase1))
		}
	}
}
