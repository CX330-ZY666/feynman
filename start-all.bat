@echo off
setlocal
cd /d "%~dp0"
if not exist "feynman-platform-springboot\mvnw.cmd" (
  echo Spring Boot backend not found.
  pause
  exit /b 1
)
if not defined DB_PASSWORD (
  echo Set DB_PASSWORD and JWT_SECRET first. See README.md.
  pause
  exit /b 1
)
if not defined JWT_SECRET (
  echo Set JWT_SECRET first. See README.md.
  pause
  exit /b 1
)
set "VITE_API_URL=http://localhost:8080/api"
start "Feynman Backend" /D "%~dp0feynman-platform-springboot" cmd /k mvnw.cmd spring-boot:run
start "Feynman Frontend" /D "%~dp0feynman-platform-frontend" cmd /k npm run dev
echo Backend: http://localhost:8080/api/health
echo Frontend: see the address printed by Vite.
pause
