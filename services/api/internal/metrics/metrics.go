package metrics

import (
	"context"
	"fmt"
	"log"
	"time"

	"github.com/gofiber/fiber/v3"
	"github.com/gofiber/fiber/v3/middleware/adaptor"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promhttp"
)

var (
	// HTTP Metrics
	HTTPRequestDuration = prometheus.NewHistogramVec(
		prometheus.HistogramOpts{
			Name:    "ota_http_request_duration_seconds",
			Help:    "HTTP request latency in seconds.",
			Buckets: []float64{0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5},
		},
		[]string{"path", "method", "status"},
	)

	HTTPRequestsTotal = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name: "ota_http_requests_total",
			Help: "Total number of HTTP requests made to the API.",
		},
		[]string{"path", "method", "status"},
	)

	// Fleet Metrics
	FleetDevicesTotal = prometheus.NewGaugeVec(
		prometheus.GaugeOpts{
			Name: "ota_fleet_devices_total",
			Help: "Total number of robot devices in the fleet by factory, hardware model, and status.",
		},
		[]string{"factory_id", "hw_model", "status"},
	)

	FleetFirmwareTotal = prometheus.NewGaugeVec(
		prometheus.GaugeOpts{
			Name: "ota_fleet_firmware_total",
			Help: "Total number of robot devices by factory, hardware model, and firmware version.",
		},
		[]string{"factory_id", "hw_model", "current_version"},
	)

	// Deployment Metrics
	DeploymentsTotal = prometheus.NewGaugeVec(
		prometheus.GaugeOpts{
			Name: "ota_deployments_total",
			Help: "Total OTA deployments executed by strategy and status.",
		},
		[]string{"strategy", "status"},
	)

	ActiveDeployments = prometheus.NewGauge(
		prometheus.GaugeOpts{
			Name: "ota_active_deployments",
			Help: "Current number of in-progress OTA deployments.",
		},
	)

	FirmwareVersionsTotal = prometheus.NewGauge(
		prometheus.GaugeOpts{
			Name: "ota_firmware_versions_total",
			Help: "Total registered active firmware releases.",
		},
	)
)

func init() {
	prometheus.MustRegister(
		HTTPRequestDuration,
		HTTPRequestsTotal,
		FleetDevicesTotal,
		FleetFirmwareTotal,
		DeploymentsTotal,
		ActiveDeployments,
		FirmwareVersionsTotal,
	)
}

// HTTPMiddleware instruments Fiber HTTP handlers with latency and throughput metrics.
func HTTPMiddleware() fiber.Handler {
	return func(c fiber.Ctx) error {
		start := time.Now()
		err := c.Next()
		duration := time.Since(start).Seconds()

		status := fmt.Sprintf("%d", c.Response().StatusCode())
		path := c.Route().Path
		if path == "" {
			path = c.Path()
		}

		HTTPRequestDuration.WithLabelValues(path, c.Method(), status).Observe(duration)
		HTTPRequestsTotal.WithLabelValues(path, c.Method(), status).Inc()

		return err
	}
}

// Handler returns a Fiber handler that serves the Prometheus /metrics endpoint.
func Handler() fiber.Handler {
	return adaptor.HTTPHandler(promhttp.Handler())
}

// StartFleetMetricsSync runs a background worker that periodically polls PostgreSQL
// to update fleet gauges and deployment statistics.
func StartFleetMetricsSync(pool *pgxpool.Pool, interval time.Duration) {
	go func() {
		ticker := time.NewTicker(interval)
		defer ticker.Stop()

		// Run once immediately
		syncMetrics(pool)

		for range ticker.C {
			syncMetrics(pool)
		}
	}()
}

func syncMetrics(pool *pgxpool.Pool) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	// 1. Sync Fleet Devices
	rows, err := pool.Query(ctx, `
		SELECT factory_id, hw_model, status, count(*) 
		FROM devices 
		GROUP BY factory_id, hw_model, status
	`)
	if err == nil {
		FleetDevicesTotal.Reset()
		for rows.Next() {
			var factoryID, hwModel, status string
			var count float64
			if err := rows.Scan(&factoryID, &hwModel, &status, &count); err == nil {
				FleetDevicesTotal.WithLabelValues(factoryID, hwModel, status).Set(count)
			}
		}
		rows.Close()
	} else {
		log.Printf("Warning: failed to query device metrics: %v", err)
	}

	// 2. Sync Fleet Firmware Versions
	rowsFw, err := pool.Query(ctx, `
		SELECT factory_id, hw_model, current_version, count(*) 
		FROM devices 
		GROUP BY factory_id, hw_model, current_version
	`)
	if err == nil {
		FleetFirmwareTotal.Reset()
		for rowsFw.Next() {
			var factoryID, hwModel, version string
			var count float64
			if err := rowsFw.Scan(&factoryID, &hwModel, &version, &count); err == nil {
				FleetFirmwareTotal.WithLabelValues(factoryID, hwModel, version).Set(count)
			}
		}
		rowsFw.Close()
	} else {
		log.Printf("Warning: failed to query device firmware metrics: %v", err)
	}

	// 3. Sync Deployments by Strategy and Status
	rowsDep, err := pool.Query(ctx, `
		SELECT strategy, status, count(*) 
		FROM deployments 
		GROUP BY strategy, status
	`)
	if err == nil {
		DeploymentsTotal.Reset()
		for rowsDep.Next() {
			var strategy, status string
			var count float64
			if err := rowsDep.Scan(&strategy, &status, &count); err == nil {
				DeploymentsTotal.WithLabelValues(strategy, status).Set(count)
			}
		}
		rowsDep.Close()
	} else {
		log.Printf("Warning: failed to query deployment metrics: %v", err)
	}

	// 4. Sync Active Deployments
	var activeCount float64
	err = pool.QueryRow(ctx, "SELECT count(*) FROM deployments WHERE status = 'running'").Scan(&activeCount)
	if err == nil {
		ActiveDeployments.Set(activeCount)
	}

	// 5. Sync Firmware Releases Total
	var fwCount float64
	err = pool.QueryRow(ctx, "SELECT count(*) FROM firmware_versions WHERE is_active = true").Scan(&fwCount)
	if err == nil {
		FirmwareVersionsTotal.Set(fwCount)
	}
}
