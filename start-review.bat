@echo off
chcp 65001 >nul
setlocal

echo ========================================
echo   Feynman Platform - Review Start
echo ========================================
echo.

if not exist "feynman-platform-backend" (
  echo [Error] 当前目录不正确，未找到 feynman-platform-backend
  pause
  exit /b 1
)

if not exist "feynman-platform-frontend" (
  echo [Error] 当前目录不正确，未找到 feynman-platform-frontend
  pause
  exit /b 1
)

echo [1/2] 启动后端服务...
start "Feynman Backend" cmd /k "cd /d %~dp0feynman-platform-backend && npm run dev"

timeout /t 3 /nobreak >nul

echo [2/2] 启动前端服务...
start "Feynman Frontend" cmd /k "cd /d %~dp0feynman-platform-frontend && npm run dev"

echo.
echo 启动命令已发送：
echo - Backend: http://localhost:3000
echo - Frontend: http://127.0.0.1:5174
echo.
echo 如首次运行，请先在两个项目目录分别执行 npm install
pause
