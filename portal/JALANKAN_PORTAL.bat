@echo off
REM ===================================================================
REM  PORTAL SIMKLINIK - Jalankan Portal + SIMKlinik (PRODUCTION)
REM  Klinik Utama Dr. H. A. Rotinsulu Cianjur
REM ===================================================================
title Portal SIMKlinik - Production

REM Tetap di folder portal: runner.js yang dimaksud adalah portal\runner.js.
REM (cd ke .. akan menjalankan launcher root dan menyalakan SIMKlinik saja,
REM  sehingga portal di port 8082 tidak pernah terbuka.)
cd /d "%~dp0"

echo.
echo  Menyalakan Portal SIMKlinik beserta aplikasi pelayanan...
echo  Portal    : http://localhost:8082
echo  SIMKlinik : http://localhost:8080
echo.

node runner.js --with-simklinik
pause
