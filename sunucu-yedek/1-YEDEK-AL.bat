@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo Yedek aliniyor...
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0yedek.ps1"
echo.
if /I "%~1"=="/oto" goto :son
echo Bitti. Bu pencereyi kapatabilirsin.
pause
:son
