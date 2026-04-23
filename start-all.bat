@echo off
chcp 65001 >nul
echo ========================================
echo   费曼学习平台 - 一键启动
echo ========================================
echo.

:: 启动后端服务
echo [1/2] 启动后端服务...
start "Feynman Backend" cmd /k "cd /d D:\feiman\feynman-platform-backend && npm run dev"

:: 等待后端启动
timeout /t 3 /nobreak >nul

:: 启动前端 (Electron 开发模式)
echo [2/2] 启动前端 Electron...
start "Feynman Frontend" cmd /k "cd /d D:\feiman\feynman-platform-frontend && npm run electron:dev"

echo.
echo ========================================
echo   启动完成！
echo   - 后端: http://localhost:3000
echo   - 前端: http://localhost:5173
echo   - Electron 窗口将自动打开
echo ========================================
echo.
pause
