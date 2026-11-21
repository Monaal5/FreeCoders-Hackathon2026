@echo off
echo Starting SunPower CRM Stack...

start "SunPower - Embedded PostgreSQL (Port 5433)" cmd /k "cd /d "%~dp0backend" && npm run db:start"
timeout /t 3 /nobreak >nul

start "SunPower - Backend API (Port 5000)" cmd /k "cd /d "%~dp0backend" && npm run dev"
timeout /t 2 /nobreak >nul

start "SunPower - Frontend UI (Port 5173)" cmd /k "cd /d "%~dp0frontend" && npm run dev"

echo All services launched in separate windows!
echo - Frontend: http://localhost:5173
echo - Backend:  http://localhost:5000/api
echo - Database: localhost:5433
