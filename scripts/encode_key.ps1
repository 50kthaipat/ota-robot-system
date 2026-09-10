# ============================================================
# encode_key.ps1 — แปลง ECDSA Private Key เป็น Base64
# สำหรับใส่ใน Render.com ENV variable (ECDSA_PRIVATE_KEY_B64)
# ============================================================
#
# วิธีใช้:
#   .\scripts\encode_key.ps1
#
# จะได้ output เป็น string base64 → copy ไปใส่ใน Render dashboard
# ที่ ECDSA_PRIVATE_KEY_B64

$keyPath = Join-Path $PSScriptRoot "..\keys\private.pem"

if (-not (Test-Path $keyPath)) {
    Write-Error "ไม่พบไฟล์ keys/private.pem — รัน 'go run scripts/gen_keys.go' ก่อน"
    exit 1
}

$keyContent = Get-Content $keyPath -Raw
$keyBytes   = [System.Text.Encoding]::UTF8.GetBytes($keyContent)
$b64        = [Convert]::ToBase64String($keyBytes)

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  ECDSA_PRIVATE_KEY_B64 (copy ทั้งหมด)" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host $b64
Write-Host ""
Write-Host "ใส่ค่านี้ใน Render.com → Environment → ECDSA_PRIVATE_KEY_B64" -ForegroundColor Yellow
