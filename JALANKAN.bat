@echo off
REM ===================================================================
REM  SISTEM KLINIK - PRODUCTION
REM  Klinik Utama Dr. H. A. Rotinsulu Cianjur
REM  Menyalakan layanan identitas, portal, dan SIMKlinik sekaligus.
REM ===================================================================
title Sistem Klinik - Production
cd /d "%~dp0"

echo.
echo  Menyalakan sistem klinik (production)...
echo  Portal    : http://localhost:8082   ^<-- dibuka staf
echo  SIMKlinik : http://localhost:8080
echo.

node runner.js
if %errorlevel% neq 0 (
  echo.
  echo [ERROR] Sistem berhenti dengan kode error.
)
pause
