@echo off
title Launch COGNIPATH Full-Stack Ecosystem
echo ===================================================
echo   Launching COGNIPATH Full-Stack LMS (SIH 2026)
echo ===================================================
echo Starting Backend (FastAPI on Port 8000)...
start "COGNIPATH Backend" "%~dp0run_backend.bat"

timeout /t 3 /nobreak >nul

echo Starting Frontend (Vite React on Port 3000)...
start "COGNIPATH Frontend" "%~dp0run_frontend.bat"

echo.
echo Both servers started!
echo Frontend will be at: http://localhost:3000
echo Backend Docs will be at: http://localhost:8000/docs
pause
