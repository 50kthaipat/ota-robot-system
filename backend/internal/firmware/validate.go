package firmware

import (
	"bytes"
	"errors"
	"fmt"
	"path/filepath"
	"strings"
)

// AllowedFirmwareExtensions specifies permissible firmware package and binary file extensions.
var AllowedFirmwareExtensions = []string{
	".bin",
	".hex",
	".tar.gz",
	".tgz",
	".img",
	".zip",
	".elf",
}

var (
	magicGzip = []byte{0x1f, 0x8b}
	magicZip  = []byte{0x50, 0x4b, 0x03, 0x04}
	magicELF  = []byte{0x7f, 0x45, 0x4c, 0x46} // \x7fELF
)

var disallowedScriptPrefixes = [][]byte{
	[]byte("<?php"),
	[]byte("<!doctype html"),
	[]byte("<!DOCTYPE html"),
	[]byte("<html"),
	[]byte("eval("),
	[]byte("#!/bin/sh"),
	[]byte("#!/bin/bash"),
	[]byte("#!/usr/bin/env"),
}

// ValidateBinary performs multi-layer inspection: size, allowed extension, disallowed script signatures, and magic bytes.
func ValidateBinary(filename string, data []byte) error {
	size := len(data)
	if size < MinFirmwareSize {
		return fmt.Errorf("firmware file too small: must be at least %d bytes", MinFirmwareSize)
	}
	if size > MaxFirmwareSize {
		return fmt.Errorf("firmware file exceeds maximum limit of %d bytes", MaxFirmwareSize)
	}

	cleanName := filepath.Base(filename)
	lowerName := strings.ToLower(cleanName)

	hasValidExt := false
	for _, ext := range AllowedFirmwareExtensions {
		if strings.HasSuffix(lowerName, ext) {
			hasValidExt = true
			break
		}
	}
	if !hasValidExt {
		return fmt.Errorf("invalid firmware file extension: must be one of %v", AllowedFirmwareExtensions)
	}

	// Reject script payloads disguised with a firmware extension
	checkLen := 512
	if len(data) < checkLen {
		checkLen = len(data)
	}
	head := bytes.ToLower(data[:checkLen])
	for _, sig := range disallowedScriptPrefixes {
		if bytes.Contains(head, bytes.ToLower(sig)) {
			return errors.New("security violation: executable web/shell script signature detected in firmware payload")
		}
	}

	// Validate magic bytes according to specific format
	if strings.HasSuffix(lowerName, ".tar.gz") || strings.HasSuffix(lowerName, ".tgz") {
		if !bytes.HasPrefix(data, magicGzip) {
			return errors.New("invalid firmware binary: tar.gz archive must begin with gzip magic bytes (0x1F, 0x8B)")
		}
	} else if strings.HasSuffix(lowerName, ".zip") {
		if !bytes.HasPrefix(data, magicZip) {
			return errors.New("invalid firmware binary: zip archive must begin with zip magic bytes (PK\\x03\\x04)")
		}
	} else if strings.HasSuffix(lowerName, ".elf") {
		if !bytes.HasPrefix(data, magicELF) {
			return errors.New("invalid firmware binary: elf binary must begin with ELF magic bytes (\\x7fELF)")
		}
	} else if strings.HasSuffix(lowerName, ".hex") {
		if !bytes.HasPrefix(data, []byte(":")) {
			return errors.New("invalid firmware binary: intel hex file must begin with ':' record marker")
		}
	}

	return nil
}
