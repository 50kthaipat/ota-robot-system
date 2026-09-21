package firmware

import (
	"bytes"
	"testing"
)

func TestValidateBinary(t *testing.T) {
	minBytes := make([]byte, MinFirmwareSize)

	// 1. File too small
	if err := ValidateBinary("firmware.bin", []byte{1, 2, 3}); err == nil {
		t.Error("expected error for tiny binary, got nil")
	}

	// 2. Disallowed extension
	if err := ValidateBinary("firmware.exe", minBytes); err == nil {
		t.Error("expected error for .exe extension, got nil")
	}
	if err := ValidateBinary("malicious.sh", minBytes); err == nil {
		t.Error("expected error for .sh extension, got nil")
	}

	// 3. Web/shell script signature injection in .bin file
	phpPayload := append([]byte("<?php echo 'pwned'; ?>"), make([]byte, MinFirmwareSize)...)
	if err := ValidateBinary("firmware.bin", phpPayload); err == nil {
		t.Error("expected error for PHP payload, got nil")
	}

	bashPayload := append([]byte("#!/bin/bash\nrm -rf /"), make([]byte, MinFirmwareSize)...)
	if err := ValidateBinary("firmware.bin", bashPayload); err == nil {
		t.Error("expected error for Bash script payload, got nil")
	}

	htmlPayload := append([]byte("<!DOCTYPE html><html><body>malicious</body></html>"), make([]byte, MinFirmwareSize)...)
	if err := ValidateBinary("firmware.bin", htmlPayload); err == nil {
		t.Error("expected error for HTML payload, got nil")
	}

	// 4. Magic bytes validation for tar.gz
	corruptedTarGz := make([]byte, MinFirmwareSize)
	if err := ValidateBinary("firmware.tar.gz", corruptedTarGz); err == nil {
		t.Error("expected error for tar.gz without gzip magic header, got nil")
	}

	validTarGz := append([]byte{0x1f, 0x8b, 0x08, 0x00}, make([]byte, MinFirmwareSize)...)
	if err := ValidateBinary("firmware.tar.gz", validTarGz); err != nil {
		t.Errorf("expected valid tar.gz to pass, got error: %v", err)
	}

	// 5. Magic bytes validation for zip
	corruptedZip := make([]byte, MinFirmwareSize)
	if err := ValidateBinary("firmware.zip", corruptedZip); err == nil {
		t.Error("expected error for zip without PK magic header, got nil")
	}

	validZip := append([]byte{0x50, 0x4b, 0x03, 0x04}, make([]byte, MinFirmwareSize)...)
	if err := ValidateBinary("firmware.zip", validZip); err != nil {
		t.Errorf("expected valid zip to pass, got error: %v", err)
	}

	// 6. Magic bytes validation for ELF
	corruptedELF := make([]byte, MinFirmwareSize)
	if err := ValidateBinary("firmware.elf", corruptedELF); err == nil {
		t.Error("expected error for elf without \\x7fELF header, got nil")
	}

	validELF := append([]byte{0x7f, 'E', 'L', 'F', 0x02, 0x01, 0x01}, make([]byte, MinFirmwareSize)...)
	if err := ValidateBinary("firmware.elf", validELF); err != nil {
		t.Errorf("expected valid ELF to pass, got error: %v", err)
	}

	// 7. Magic bytes validation for Intel HEX
	corruptedHex := bytes.Repeat([]byte("ABCDEF"), MinFirmwareSize/6+1)
	if err := ValidateBinary("firmware.hex", corruptedHex); err == nil {
		t.Error("expected error for hex without ':' marker, got nil")
	}

	validHex := append([]byte(":020000040800F2\n"), make([]byte, MinFirmwareSize)...)
	if err := ValidateBinary("firmware.hex", validHex); err != nil {
		t.Errorf("expected valid Intel HEX to pass, got error: %v", err)
	}

	// 8. Normal binary firmware image (.bin)
	validBin := append([]byte("ROBOT_FIRMWARE_PAYLOAD|ARCH=ARM_CORTEX_M4\n"), make([]byte, MinFirmwareSize)...)
	if err := ValidateBinary("firmware.bin", validBin); err != nil {
		t.Errorf("expected valid .bin to pass, got error: %v", err)
	}
}
