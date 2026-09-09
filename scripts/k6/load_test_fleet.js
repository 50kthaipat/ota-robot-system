import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';

// Custom metrics for Thesis KPI tracking
export const successfulRequests = new Counter('k6_successful_requests');
export const failedRequests = new Counter('k6_failed_requests');
export const apiSuccessRate = new Rate('k6_success_rate');
export const deviceQueryDuration = new Trend('k6_device_query_duration', true);
export const firmwareQueryDuration = new Trend('k6_firmware_query_duration', true);

// Test configuration: Multi-stage Ramp up to 100 concurrent robot VUs
export const options = {
  stages: [
    { duration: '15s', target: 25 },  // Stage 1: Warmup to 25 VUs
    { duration: '20s', target: 50 },  // Stage 2: 50 Concurrent Robots (KPI 8 baseline)
    { duration: '25s', target: 100 }, // Stage 3: Stress Peak at 100 Concurrent Robots
    { duration: '10s', target: 0 },   // Stage 4: Ramp-down / Cooldown
  ],
  thresholds: {
    // KPI 6: API Latency p95 must be < 300ms
    http_req_duration: ['p(95)<300', 'p(99)<800'],
    // KPI 1: Success rate >= 99% (failure rate < 1%)
    http_req_failed: ['rate<0.01'],
    checks: ['rate>0.99'],
  },
};

const BASE_URL = __ENV.API_BASE_URL || 'http://api:8000';

export default function () {
  // 1. Healthcheck Probe
  const healthRes = http.get(`${BASE_URL}/health`, { tags: { endpoint: 'health' } });
  const healthOk = check(healthRes, {
    'health status is 200': (r) => r.status === 200,
    'health body is OK': (r) => r.body === 'OK',
  });
  apiSuccessRate.add(healthOk);
  if (healthOk) successfulRequests.add(1); else failedRequests.add(1);

  // 2. Fleet Devices Query (Simulating robot heartbeat polling & dashboard sync)
  const devicesRes = http.get(`${BASE_URL}/api/v1/devices`, { tags: { endpoint: 'devices' } });
  deviceQueryDuration.add(devicesRes.timings.duration);
  const devicesOk = check(devicesRes, {
    'devices status is 200': (r) => r.status === 200,
    'devices returned data array': (r) => {
      try {
        const json = JSON.parse(r.body);
        return Array.isArray(json.data) && json.data.length > 0;
      } catch (e) {
        return false;
      }
    },
  });
  apiSuccessRate.add(devicesOk);
  if (devicesOk) successfulRequests.add(1); else failedRequests.add(1);

  // 3. Firmware Catalog & Download URL Request
  const fwRes = http.get(`${BASE_URL}/api/v1/firmware`, { tags: { endpoint: 'firmware' } });
  firmwareQueryDuration.add(fwRes.timings.duration);
  const fwOk = check(fwRes, {
    'firmware list is 200': (r) => r.status === 200,
  });
  apiSuccessRate.add(fwOk);
  if (fwOk) successfulRequests.add(1); else failedRequests.add(1);

  // If firmware list succeeds, fetch presigned download URL for the active version
  if (fwOk) {
    try {
      const fwData = JSON.parse(fwRes.body).data;
      if (fwData && fwData.length > 0) {
        const fwId = fwData[0].id;
        const dlRes = http.get(`${BASE_URL}/api/v1/firmware/${fwId}/url`, { tags: { endpoint: 'firmware_url' } });
        const dlOk = check(dlRes, {
          'download url status is 200': (r) => r.status === 200,
          'has presigned url': (r) => {
            const j = JSON.parse(r.body);
            return typeof j.url === 'string' && j.url.length > 0;
          },
        });
        apiSuccessRate.add(dlOk);
        if (dlOk) successfulRequests.add(1); else failedRequests.add(1);
      }
    } catch (e) {}
  }

  // 4. Deployment Rollout Telemetry Polling
  const depRes = http.get(`${BASE_URL}/api/v1/deployments`, { tags: { endpoint: 'deployments' } });
  const depOk = check(depRes, {
    'deployments status is 200': (r) => r.status === 200,
  });
  apiSuccessRate.add(depOk);
  if (depOk) successfulRequests.add(1); else failedRequests.add(1);

  // Realistic thinking time between robot polling cycles (100ms - 250ms)
  sleep(0.1 + Math.random() * 0.15);
}
