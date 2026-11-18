@echo off
REM ===================================================================
REM  SISTEM KLINIK - DEVELOPMENT (hot reload)
REM  Port dan database terpisah; production yang sedang berjalan tidak
REM  terganggu.
REM ===================================================================
title Sistem Klinik - Development
cd /d "%~dp0"

echo.
echo  Menyalakan sistem klinik MODE DEVELOPMENT...
echo  Portal dev    : http://localhost:8083
echo  SIMKlinik dev : http://localhost:8081
echo  Identitas dev : http://localhost:4011
echo  Database      : data\simklinik\vaksinku-dev.sqlite, data\identity\identity-dev.sqlite
echo.

node runner.js --dev
if %errorlevel% neq 0 (
  echo.
  echo [ERROR] Mode development berhenti dengan kode error.
)
pause
