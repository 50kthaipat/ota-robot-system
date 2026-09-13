package handlers

import (
    "github.com/gofiber/fiber/v3"
    "github.com/ota-robot/api/internal/db/generated"
    "github.com/jackc/pgx/v5/pgxpool"
)

type DeviceHandler struct {
    db      *pgxpool.Pool
    queries *db.Queries
}

func NewDeviceHandler(pool *pgxpool.Pool) *DeviceHandler {
    return &DeviceHandler{
        db:      pool,
        queries: db.New(pool),
    }
}

func (h *DeviceHandler) ListDevices(c fiber.Ctx) error {
    _, _ = h.db.Exec(c.Context(), "UPDATE devices SET status = 'offline' WHERE last_seen < NOW() - INTERVAL '30 seconds' AND status != 'offline'")
    devices, err := h.queries.ListDevices(c.Context())
    if err != nil {
        return c.Status(500).JSON(fiber.Map{"error": err.Error()})
    }
    return c.JSON(fiber.Map{"data": devices, "total": len(devices)})
}

func (h *DeviceHandler) GetDevice(c fiber.Ctx) error {
    id := c.Params("id")
    device, err := h.queries.GetDevice(c.Context(), id)
    if err != nil {
        return c.Status(404).JSON(fiber.Map{"error": "device not found"})
    }
    return c.JSON(device)
}

func (h *DeviceHandler) DeleteDevice(c fiber.Ctx) error {
    id := c.Params("id")
    device, err := h.queries.GetDevice(c.Context(), id)
    if err != nil {
        return c.Status(404).JSON(fiber.Map{"error": "device not found"})
    }

    if device.Status == "online" || device.Status == "updating" {
        return c.Status(400).JSON(fiber.Map{
            "error": "cannot decommission active or updating robot. Unit must be offline before deletion.",
        })
    }

    cmdTag, err := h.db.Exec(c.Context(), "DELETE FROM devices WHERE id = $1", id)
    if err != nil {
        return c.Status(500).JSON(fiber.Map{"error": "failed to delete device: " + err.Error()})
    }
    if cmdTag.RowsAffected() == 0 {
        return c.Status(404).JSON(fiber.Map{"error": "device not found"})
    }

    return c.JSON(fiber.Map{
        "message": "robot decommissioned successfully",
        "id":      id,
    })
}

func (h *DeviceHandler) PruneOfflineDevices(c fiber.Ctx) error {
    cmdTag, err := h.db.Exec(c.Context(), "DELETE FROM devices WHERE status = 'offline'")
    if err != nil {
        return c.Status(500).JSON(fiber.Map{"error": "failed to prune offline devices: " + err.Error()})
    }

    return c.JSON(fiber.Map{
        "message":       "offline robots pruned successfully",
        "deleted_count": cmdTag.RowsAffected(),
    })
}

