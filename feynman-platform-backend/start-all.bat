@echo off
chcp 65001 >nul
echo ========================================
echo   Feynman 平台统一启动脚本
echo ========================================
echo.

REM 检查 Whisper 虚拟环境
if not exist "whisper-api\venv" (
    echo ⚠️  警告: 未检测到 Whisper 虚拟环境
    echo    请先运行: cd whisper-api ^&^& setup-whisper.bat
    echo.
    echo 是否继续启动（仅启动 Node.js 后端）？
    choice /C YN /M "继续"
    if %ERRORLEVEL% EQU 2 (
        echo 已取消启动
        pause
        exit /b 0
    )
    set SKIP_WHISPER=1
) else (
    set SKIP_WHISPER=0
)

echo.
echo 🚀 正在启动服务...
echo.

REM 启动 Node.js 后端
echo [1/2] 启动 Node.js 后端 (端口 5000)...
start "Feynman Backend - Node.js" cmd /k "npm run dev"
timeout /t 3 /nobreak >nul

REM 启动 Whisper API 服务
if %SKIP_WHISPER% EQU 0 (
    echo [2/2] 启动 Whisper API 服务 (端口 5001)...
    start "Feynman Whisper API - Python" cmd /k "cd whisper-api && venv\Scripts\activate && python app.py"
    timeout /t 2 /nobreak >nul
) else (
    echo [2/2] 跳过 Whisper API 服务启动
)

echo.
echo ========================================
echo   ✅ 服务启动完成！
echo ========================================
echo.
echo 服务地址:
echo   - Node.js 后端:  http://localhost:5000
if %SKIP_WHISPER% EQU 0 (
    echo   - Whisper API:   http://localhost:5001
    echo   - 健康检查:      http://localhost:5001/health
)
echo.
echo 提示:
echo   - 前端请单独启动: cd ..\feynman-platform-frontend ^&^& npm run dev
echo   - 关闭服务请直接关闭对应的命令行窗口
echo   - 查看日志请切换到对应的窗口
echo.
pause
