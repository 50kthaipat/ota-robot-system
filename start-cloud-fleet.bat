@echo off
echo ===================================================
echo   Starting Robot Fleet for Cloud (Vercel / Render)
echo ===================================================
docker compose -f docker-compose.cloud-fleet.yml up -d
echo.
echo [STATUS] 5 Cloud Robot Simulators are running in background!
echo Broadcasting heartbeats to HiveMQ Cloud...
echo.
echo Open your Vercel dashboard:
echo https://ota-robot-system.vercel.app
echo ===================================================
pause
