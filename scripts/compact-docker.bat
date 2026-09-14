@echo off
echo ===================================================
echo   Docker VHDX Shrink / Compact Utility (Windows)
echo ===================================================
echo.
echo Stopping WSL2 instances...
wsl --shutdown
echo.
echo Compacting %LOCALAPPDATA%\Docker\wsl\disk\docker_data.vhdx ...
(
echo select vdisk file="%LOCALAPPDATA%\Docker\wsl\disk\docker_data.vhdx"
echo attach vdisk readonly
echo compact vdisk
echo detach vdisk
) | diskpart
echo.
echo ===================================================
echo   Finished! Check your C: drive free space.
echo ===================================================
pause
