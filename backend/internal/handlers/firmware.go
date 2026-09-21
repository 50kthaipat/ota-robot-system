package handlers

import (
	"fmt"
	"io"
	"time"

	"github.com/gofiber/fiber/v3"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/ota-robot/api/internal/firmware"
)

// FirmwareHandler is an HTTP adapter that translates requests to the firmware.Service deep module.
type FirmwareHandler struct {
	releaseSvc firmware.Service
}

// NewFirmwareHandler constructs a new FirmwareHandler.
func NewFirmwareHandler(releaseSvc firmware.Service) *FirmwareHandler {
	return &FirmwareHandler{
		releaseSvc: releaseSvc,
	}
}

// Upload handles firmware binary uploads and delegates to releaseSvc.Release.
func (h *FirmwareHandler) Upload(c fiber.Ctx) error {
	file, err := c.FormFile("file")
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "file is required"})
	}
	version := c.FormValue("version")
	if version == "" {
		return c.Status(400).JSON(fiber.Map{"error": "version is required"})
	}
	releaseNotes := c.FormValue("release_notes", "")

	src, err := file.Open()
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "cannot open file"})
	}
	defer src.Close()

	data, err := io.ReadAll(src)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "cannot read file"})
	}

	fw, err := h.releaseSvc.Release(c.Context(), firmware.ReleaseParams{
		Version:      version,
		Filename:     file.Filename,
		Data:         data,
		ReleaseNotes: releaseNotes,
	})
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": err.Error()})
	}

	return c.Status(201).JSON(fw)
}

// List returns all firmware versions.
func (h *FirmwareHandler) List(c fiber.Ctx) error {
	fws, err := h.releaseSvc.List(c.Context())
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "failed to list firmware: " + err.Error()})
	}
	return c.JSON(fiber.Map{"data": fws})
}

// GetDownloadURL provides a presigned download URL for the requested firmware version.
func (h *FirmwareHandler) GetDownloadURL(c fiber.Ctx) error {
	id := c.Params("id")
	uid, err := uuid.Parse(id)
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid id format"})
	}

	details, err := h.releaseSvc.GetDownloadURL(c.Context(), pgtype.UUID{Bytes: uid, Valid: true}, 15*time.Minute)
	if err != nil {
		return c.Status(404).JSON(fiber.Map{"error": err.Error()})
	}

	return c.JSON(fiber.Map{
		"url":       details.URL,
		"checksum":  details.Checksum,
		"signature": details.Signature,
	})
}

// Delete removes the specified firmware version.
func (h *FirmwareHandler) Delete(c fiber.Ctx) error {
	id := c.Params("id")
	uid, err := uuid.Parse(id)
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid id format"})
	}

	if err := h.releaseSvc.Delete(c.Context(), pgtype.UUID{Bytes: uid, Valid: true}); err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}

	return c.JSON(fiber.Map{
		"message": "firmware deleted successfully",
		"id":      id,
	})
}

// UpdateFirmwareRequest specifies update fields for firmware metadata.
type UpdateFirmwareRequest struct {
	Version      *string `json:"version"`
	ReleaseNotes *string `json:"release_notes"`
	Status       *string `json:"status"`
}

// Update modifies firmware release notes or status.
func (h *FirmwareHandler) Update(c fiber.Ctx) error {
	id := c.Params("id")
	uid, err := uuid.Parse(id)
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid id format"})
	}

	var req UpdateFirmwareRequest
	if err := c.Bind().Body(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid request body"})
	}

	notes := ""
	if req.ReleaseNotes != nil {
		notes = *req.ReleaseNotes
	}

	status := "active"
	if req.Status != nil {
		status = *req.Status
	}

	updated, err := h.releaseSvc.Update(c.Context(), pgtype.UUID{Bytes: uid, Valid: true}, notes, status)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}

	return c.JSON(updated)
}

// ResignAll signs any firmware records missing an ECDSA digital signature.
func (h *FirmwareHandler) ResignAll(c fiber.Ctx) error {
	count, err := h.releaseSvc.ResignAll(c.Context())
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": fmt.Sprintf("Failed to resign firmware: %v", err)})
	}
	return c.JSON(fiber.Map{
		"message":      "resigned all legacy firmware",
		"signed_count": count,
	})
}
