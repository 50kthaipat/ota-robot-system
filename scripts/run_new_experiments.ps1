# scripts/run_new_experiments.ps1
# Master Orchestrator for Empirical Benchmark Suite

$ErrorActionPreference = "Stop"

Write-Host "=================================================================" -ForegroundColor Cyan
Write-Host " OTA ROBOT SYSTEM - NEW EMPIRICAL BENCHMARK SUITE RUNNER" -ForegroundColor Cyan
Write-Host "=================================================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "[1/5] Executing Cryptographic Overhead Benchmark (Go)..." -ForegroundColor Yellow
go run scripts/benchmark_crypto.go

Write-Host "`n[2/5] Executing Zero-Trust Security Threat Mitigation (Python)..." -ForegroundColor Yellow
python scripts/benchmark_security.py

Write-Host "`n[3/5] Executing Resilience A/B Blast Radius Test (Python)..." -ForegroundColor Yellow
python scripts/benchmark_resilience_ab.py

Write-Host "`n[4/5] Executing Network Stress & Transport Reliability (Python)..." -ForegroundColor Yellow
python scripts/benchmark_network.py

Write-Host "`n[5/5] Executing Control Plane Concurrency Benchmark (Python)..." -ForegroundColor Yellow
python scripts/benchmark_concurrency.py

Write-Host "`n[COMPLETED] All 5 scenarios executed successfully." -ForegroundColor Green
Write-Host "Data saved in: data/experiments/" -ForegroundColor Green
