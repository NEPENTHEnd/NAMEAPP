@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo Yedek aliniyor...
echo.
where py >nul 2>nul
if %errorlevel%==0 ( py -3 yedek.py ) else ( python yedek.py )
echo.
if /I "%~1"=="/oto" goto :son
echo Bitti. Bu pencereyi kapatabilirsin.
pause
:son
