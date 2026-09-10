param (
    [string]$Broker = $env:MQTT_BROKER,
    [string]$Username = $env:MQTT_USERNAME,
    [string]$Password = $env:MQTT_PASSWORD
)

if (-not $Broker) {
    $Broker = Read-Host "Enter HiveMQ Broker URL (e.g. ssl://xxxx.hivemq.cloud:8883)"
}
if (-not $Username) {
    $Username = Read-Host "Enter HiveMQ Username"
}
if (-not $Password) {
    $Password = Read-Host "Enter HiveMQ Password"
}

$Broker = $Broker.Trim()
$Username = $Username.Trim()
$Password = $Password.Trim()

$Devices = @(
    @{ Id = "robot-agv-001"; Model = "agv-v1"; Factory = "factory-bkk-01" },
    @{ Id = "robot-agv-002"; Model = "agv-v1"; Factory = "factory-bkk-01" },
    @{ Id = "robot-arm-003"; Model = "arm-v2"; Factory = "factory-rayong-02" }
)

$SimDir = (Resolve-Path (Join-Path $PSScriptRoot "..\simulator")).Path

foreach ($dev in $Devices) {
    $id = $dev.Id
    $model = $dev.Model
    $factory = $dev.Factory
    
    Start-Process powershell -ArgumentList "-NoExit", "-Command", @"
        `$env:MQTT_BROKER = '$Broker';
        `$env:MQTT_USERNAME = '$Username';
        `$env:MQTT_PASSWORD = '$Password';
        `$env:MQTT_USE_TLS = 'true';
        `$env:DEVICE_ID = '$id';
        `$env:HW_MODEL = '$model';
        `$env:FACTORY_ID = '$factory';
        cd '$SimDir';
        Write-Host 'Starting Robot Agent: $id ($model)...' -ForegroundColor Green;
        go run main.go;
"@
    Start-Sleep -Milliseconds 500
}

Write-Host "All 3 robot agents launched. Check Vercel Dashboard!" -ForegroundColor Green
