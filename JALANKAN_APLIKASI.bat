@echo off
title SIMKlinik - Klinik Utama Dr. H. A. Rotinsulu Cianjur

:: Pindah ke direktori tempat file .bat ini berada
cd /d "%~dp0"

:: Jalankan unified runner SIMKlinik
node runner.js %*

if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Terjadi kesalahan saat menjalankan SIMKlinik.
    pause
)
