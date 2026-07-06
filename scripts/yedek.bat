@echo off
REM ============================================================================
REM Name Teknik - gunluk yedek (Windows Gorev Zamanlayici bunu calistirir)
REM Kurulum:
REM   1) Bu klasordeki .env.local icinde SUPABASE_SERVICE_ROLE_KEY dolu olmali
REM      (ya da asagida SET satirlarini doldur).
REM   2) HEDEF'i sirket yedek sunucusundaki klasore ayarla.
REM   3) Gorev Zamanlayici > Temel Gorev Olustur > Gunluk > Program: bu .bat
REM ============================================================================

REM --- Anahtari burada da verebilirsin (girersen .env.local'e gerek yok) ---
REM SET NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
REM SET SUPABASE_SERVICE_ROLE_KEY=eyJ....

REM Yedeklerin gidecegi klasor (sirket yedek sunucusu paylasimi):
SET HEDEF=\\SUNUCU\yedek\nameteknik

REM Kac gunluk yedek tutulsun:
SET TUT=90

cd /d "%~dp0.."
py -3 scripts\yedek_indir.py "%HEDEF%" --tut %TUT%
