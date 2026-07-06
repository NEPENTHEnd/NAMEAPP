@echo off
setlocal enabledelayedexpansion
chcp 65001 >nul
cd /d "%~dp0"
set "AYAR=%~dp0yedek-hedef.txt"

REM Ilk calistirmada yedek klasorunu bir kere sorar, sonra hatirlar.
if not exist "%AYAR%" (
  echo.
  echo ============================================
  echo   Name Teknik - Yedek Kurulumu ^(tek seferlik^)
  echo ============================================
  echo.
  echo Yedeklerin kaydedilecegi KLASORU yapistirin.
  echo Ornek:  \\SUNUCU\yedek\nameteknik    veya    Z:\NameTeknikYedek
  echo.
  echo ^(Muhasebe yedeklerinin durdugu klasoru Dosya Gezgininde acip,
  echo   adres cubugundaki yolu kopyalayip buraya yapistirabilirsin.^)
  echo.
  set /p "HEDEF=Klasor yolu: "
  > "%AYAR%" echo !HEDEF!
)
set /p "HEDEF="<"%AYAR%"

echo.
echo Yedek aliniyor... Hedef: !HEDEF!
echo.
where py >nul 2>nul
if !errorlevel!==0 (
  py -3 scripts\yedek_indir.py "!HEDEF!" --tut 90
) else (
  python scripts\yedek_indir.py "!HEDEF!" --tut 90
)

if /I "%~1"=="/oto" goto :son
echo.
echo ============================================
echo   Bitti. Yedek klasorunu kontrol edebilirsin.
echo ============================================
echo.
pause
:son
endlocal
