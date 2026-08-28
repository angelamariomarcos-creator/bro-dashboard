@echo off
title Bro Dashboard
color 0B

echo.
echo   ============================================
echo      BRO DASHBOARD - Arrancando...
echo   ============================================
echo.

cd /d C:\bro-dashboard

start "Bro Dashboard - Servidor" /min cmd /c "node server.js"

timeout /t 3 /nobreak >nul

start http://localhost:3002

echo.
echo   Bro Dashboard esta corriendo.
echo   Puedes cerrar esta ventana si quieres.
echo.
pause