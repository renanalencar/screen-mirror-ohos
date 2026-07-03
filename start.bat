@echo off
title Screen Mirroring - Signaling Server + Receiver
echo ================================
echo   Starting Screen Mirroring...
echo ================================
echo.
echo [1/2] Starting Signaling Server (ws://0.0.0.0:8080)...
start "Screen Mirroring-Signaling Server" /min cmd /c "cd /d %~dp0signaling-server && node server.js"
echo [2/2] Opening PC Receiver Page...
start "" "%~dp0web-receiver\index.html"
echo.
echo All ready!
echo Open the Mirroring App on Mobile → Click "Start Mirroring"
echo.
pause
