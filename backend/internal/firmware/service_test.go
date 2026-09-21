package firmware

import (
	"context"
	"testing"
)

func TestFirmware_Validation(t *testing.T) {
	svc := &ReleaseServiceImpl{}

	ctx := context.Background()

	// 1. Empty version
	_, err := svc.Release(ctx, ReleaseParams{
		Version:  "",
		Filename: "app.bin",
		Data:     []byte("test binary data"),
	})
	if err == nil {
		t.Error("expected error for empty version, got nil")
	}

	// 2. Data too small
	_, err = svc.Release(ctx, ReleaseParams{
		Version:  "v1.0.0",
		Filename: "app.bin",
		Data:     []byte{1, 2},
	})
	if err == nil {
		t.Error("expected error for binary smaller than MinFirmwareSize, got nil")
	}
}
