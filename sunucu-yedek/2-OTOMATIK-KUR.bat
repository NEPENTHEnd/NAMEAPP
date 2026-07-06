@echo off
chcp 65001 >nul
echo.
echo Her gun otomatik yedek gorevi kuruluyor (bilgisayar/sunucu acik oldugu surece
echo kimse giris yapmasa bile calisir)...
echo.

REM SYSTEM olarak calisir -> kimse giris yapmasa bile, 7/24 acik sunucuda her gun 18:00
schtasks /Create /TN "NameTeknik Gunluk Yedek" /TR "\"%~dp01-YEDEK-AL.bat\" /oto" /SC DAILY /ST 18:00 /RU SYSTEM /RL HIGHEST /F

if %errorlevel%==0 (
  echo.
  echo ============================================
  echo   TAMAM! Her gun 18:00'de otomatik yedek.
  echo   Sunucu acik oldugu surece, kimse giris
  echo   yapmasa bile calisir.
  echo ============================================
) else (
  echo.
  echo Gorev olusturulamadi. Bu dosyaya SAG TIKLAYIP
  echo "Yonetici olarak calistir" ile tekrar dene.
)
echo.
pause
