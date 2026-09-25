@echo off
title COGNIPATH - FastAPI Backend
echo Starting COGNIPATH Backend Server on port 8000...
cd /d "%~dp0backend"
if exist ".\venv\Scripts\activate.bat" (
    call .\venv\Scripts\activate.bat
    python -m uvicorn app.main:app --reload --port 8000
) else (
    uvicorn app.main:app --reload --port 8000
)
pause
