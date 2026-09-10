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
