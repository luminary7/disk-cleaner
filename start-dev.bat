@echo off
cd /d "%~dp0"
echo 启动 C盘清理工具 开发模式...
echo.
echo 请确保先 npm install 安装了所有依赖
echo.
npm run electron:dev
pause
