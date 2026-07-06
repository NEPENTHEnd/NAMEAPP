@echo off
chcp 65001 >nul
echo.
echo Her gun otomatik yedek gorevi olusturuluyor...
echo.

REM Her gun 18:00'de YEDEK-AL.bat'i sessizce calistiran bir Windows gorevi kurar.
schtasks /Create /TN "NameTeknik Gunluk Yedek" /TR "\"%~dp0YEDEK-AL.bat\" /oto" /SC DAILY /ST 18:00 /F

if %errorlevel%==0 (
  echo.
  echo ============================================
  echo   TAMAM! Her gun saat 18:00'de otomatik
  echo   yedek alinacak.
  echo   ^(Bilgisayar o saatte kapaliysa, acik
  echo    oldugun bir sonraki gun alir.^)
  echo ============================================
) else (
  echo.
  echo Gorev olusturulamadi. Bu dosyaya SAG TIKLAYIP
  echo "Yonetici olarak calistir" ile tekrar dene.
)
echo.
pause
