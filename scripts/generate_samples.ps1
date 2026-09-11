# scripts/generate_samples.ps1
# Generates realistic synthetic firmware binary (.bin) samples for testing OTA deployments.
# Provides multiple payload sizes: 256 KB, 512 KB, 1 MB, 2 MB, 5 MB, 10 MB, and 20 MB.

param (
    [string]$OutputDir = (Join-Path $PSScriptRoot "..\firmware_samples")
)

if (-not (Test-Path $OutputDir)) {
    New-Item -ItemType Directory -Path $OutputDir -Force | Out-Null
}

$samples = @(
    @{ Name = "firmware-v1.0.1-patch.bin";       SizeKB = 256;   Desc = "256 KB - Quick hotfix & motor calibration patch" },
    @{ Name = "firmware-v1.1.0.bin";             SizeKB = 512;   Desc = "512 KB - Minor controller update" },
    @{ Name = "firmware-v1.2.0.bin";             SizeKB = 1024;  Desc = "1 MB - Standard motion planning payload" },
    @{ Name = "firmware-v2.0.0-kinematics.bin";  SizeKB = 2048;  Desc = "2 MB - Major kinematics & trajectory subsystem" },
    @{ Name = "firmware-v2.1.0-navigation.bin";  SizeKB = 5120;  Desc = "5 MB - SLAM & autonomous navigation payload" },
    @{ Name = "firmware-v3.0.0-full-suite.bin";  SizeKB = 10240; Desc = "10 MB - Complete robot OS distribution (KPI benchmark)" },
    @{ Name = "firmware-v3.2.0-vision-ai.bin";   SizeKB = 20480; Desc = "20 MB - Heavy computer vision & perception model bundle" }
)

Write-Host "================================================================" -ForegroundColor Cyan
Write-Host " OTA ROBOT PLATFORM - FIRMWARE SAMPLES GENERATOR" -ForegroundColor Cyan
Write-Host " Target Directory: $OutputDir" -ForegroundColor Yellow
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host ""

foreach ($s in $samples) {
    $filePath = Join-Path $OutputDir $s.Name
    $totalBytes = $s.SizeKB * 1024

    $headerStr = "ROBOT_OTA_FIRMWARE_HEADER|NAME=$($s.Name)|SIZE=$totalBytes|DESC=$($s.Desc)|`n"
    $headerBytes = [System.Text.Encoding]::UTF8.GetBytes($headerStr)

    $remainingBytes = $totalBytes - $headerBytes.Length
    $buffer = New-Object byte[] $remainingBytes

    $rng = New-Object System.Random($s.SizeKB)
    $rng.NextBytes($buffer)

    $fs = [System.IO.File]::Create($filePath)
    $fs.Write($headerBytes, 0, $headerBytes.Length)
    $fs.Write($buffer, 0, $buffer.Length)
    $fs.Close()

    $hash = (Get-FileHash -Path $filePath -Algorithm SHA256).Hash.ToLower()
    Write-Host ("  [CREATED] {0,-32} ({1,5} KB) -> SHA256: {2}" -f $s.Name, $s.SizeKB, $hash.Substring(0, 16) + "...") -ForegroundColor Green
}

Write-Host ""
Write-Host "Completed. Generated $($samples.Count) firmware samples." -ForegroundColor Cyan