@echo off
title 手机投屏 - 信令服务器 + 接收端
echo ================================
echo   手机投屏启动中...
echo ================================
echo.
echo [1/2] 启动信令服务器 (ws://0.0.0.0:8080)...
start "投屏-信令服务器" /min cmd /c "cd /d %~dp0signaling-server && node server.js"
echo [2/2] 打开 PC 接收页面...
start "" "%~dp0web-receiver\index.html"
echo.
echo 全部就绪！
echo 手机打开投屏 App → 点击"开始投屏"
echo.
pause
