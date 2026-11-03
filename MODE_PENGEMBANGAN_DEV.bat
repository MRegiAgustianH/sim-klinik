@echo off
title VaksinKU - Mode Pengembang (Auto-Reload Saat Edit Code)

:: Pindah ke direktori tempat file .bat ini berada
cd /d "%~dp0"

echo ====================================================================
echo   VAKSINKU - MODE PENGEMBANGAN (HOT RELOAD / FAST REFRESH AKTIF)
echo ====================================================================
echo Setiap perubahan pada kode .tsx akan otomatis ter-update di browser!
echo.

node runner.js --dev

if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Terjadi kesalahan saat menjalankan VaksinKU mode dev.
    pause
)
