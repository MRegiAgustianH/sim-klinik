@echo off
title SIMKlinik - Klinik Utama Dr. H. A. Rotinsulu Cianjur

:: Pindah ke direktori tempat file .bat ini berada
cd /d "%~dp0"

echo ====================================================================
echo   SIMKLINIK SAJA (tanpa portal)
echo ====================================================================
echo   Dipakai bila portal tidak diperlukan, mis. menguji SIMKlinik
echo   sendirian atau portal sedang bermasalah.
echo.
echo   Untuk pemakaian sehari-hari di klinik, gunakan:
echo     portal\JALANKAN_PORTAL.bat
echo   Perintah itu menyalakan portal BESERTA SIMKlinik sekaligus.
echo.
echo   Jangan menjalankan keduanya bersamaan: port 8080 akan bentrok.
echo ====================================================================
echo.

:: Jalankan unified runner SIMKlinik
node runner.js %*

if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Terjadi kesalahan saat menjalankan SIMKlinik.
    pause
)
