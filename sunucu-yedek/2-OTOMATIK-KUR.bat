@echo off
chcp 65001 >nul
echo.
echo Otomatik yedek gorevleri kuruluyor:
echo   - HER SAAT
echo   - Bilgisayar/oturum ACILINCA (gunun ilk acilisi)
echo   - Bilgisayar KAPANIRKEN (kapatma baslayinca)
echo (Sunucu/PC acik oldugu surece, kimse giris yapmasa bile calisir.)
echo.

set "YEDEKBAT=%~dp01-YEDEK-AL.bat"

REM Eski tek-gorevi (varsa) temizle
schtasks /Delete /TN "NameTeknik Gunluk Yedek" /F >nul 2>&1

REM 1) HER SAAT
schtasks /Create /TN "NameTeknik Yedek - Saatlik" /TR "\"%YEDEKBAT%\" /oto" /SC HOURLY /MO 1 /RU SYSTEM /RL HIGHEST /F
set E1=%errorlevel%

REM 2) OTURUM ACILINCA (gunun ilk acilisinda)
schtasks /Create /TN "NameTeknik Yedek - Aciliste" /TR "\"%YEDEKBAT%\" /oto" /SC ONLOGON /RU SYSTEM /RL HIGHEST /F
set E2=%errorlevel%

REM 3) KAPANIRKEN (User32 EventID 1074 = kapatma/yeniden baslatma baslatildi)
schtasks /Create /TN "NameTeknik Yedek - Kapanista" /TR "\"%YEDEKBAT%\" /oto" /SC ONEVENT /EC System /MO "*[System[Provider[@Name='User32'] and (EventID=1074)]]" /RU SYSTEM /RL HIGHEST /F
set E3=%errorlevel%

echo.
if %E1%==0 if %E2%==0 if %E3%==0 (
  echo ============================================
  echo   TAMAM! Yedek: her saat + aciliste + kapanista.
  echo   Sunucu/PC acik oldugu surece calisir.
  echo ============================================
  goto son
)
echo Bazi gorevler olusturulamadi (E1=%E1% E2=%E2% E3=%E3%).
echo Bu dosyaya SAG TIKLAYIP "Yonetici olarak calistir" ile tekrar dene.
echo (Kapanis yedegi bazi surumlerde engellenebilir; saatlik + acilis yine yeter.)
:son
echo.
pause
