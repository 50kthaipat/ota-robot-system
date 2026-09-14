@echo off
echo ===================================================
echo   Stopping Cloud Robot Fleet
echo ===================================================
docker compose -f docker-compose.cloud-fleet.yml down
echo.
echo [STATUS] All cloud robot simulators stopped.
echo ===================================================
pause
