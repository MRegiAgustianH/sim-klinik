@echo off
title SIMKlinik - Mode Pengembangan (Terpisah dari Web Production)

:: Pindah ke direktori tempat file .bat ini berada
cd /d "%~dp0"

echo ====================================================================
echo   SIMKLINIK - MODE DEVELOPMENT (HOT RELOAD / FAST REFRESH AKTIF)
echo ====================================================================
echo Frontend dev : http://localhost:8081
echo Backend dev  : http://localhost:4001
echo Database     : server/data/vaksinku-dev.sqlite (terpisah)
echo Web production di port 8080 tetap berjalan dan TIDAK terganggu.
echo.

node runner.js --dev

if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Terjadi kesalahan saat menjalankan SIMKlinik mode development.
    pause
)
