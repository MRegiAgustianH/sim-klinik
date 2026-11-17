@echo off
REM ===================================================================
REM  PORTAL SIMKLINIK - Mode DEVELOPMENT
REM  Portal : 8083   (production 8082 tidak diganggu)
REM  SIMKlinik : 8081 (production 8080 tidak diganggu)
REM ===================================================================
title Portal SIMKlinik - Development

REM Tetap di folder portal agar portal\runner.js yang dijalankan, bukan launcher root.
cd /d "%~dp0"

echo.
echo  Menyalakan Portal SIMKlinik MODE DEVELOPMENT...
echo  Portal dev    : http://localhost:8083
echo  SIMKlinik dev : http://localhost:8081
echo.
echo  Web production di port 8080/8082 tetap berjalan dan tidak terpengaruh.
echo.

node runner.js --dev
pause
