@echo off
title SIMKlinik saja (tanpa portal)
cd /d "%~dp0.."

echo ====================================================================
echo   SIMKLINIK SAJA (tanpa portal)
echo ====================================================================
echo   Dipakai bila portal tidak diperlukan, mis. menguji SIMKlinik
echo   sendirian atau portal sedang bermasalah.
echo.
echo   Untuk pemakaian sehari-hari, gunakan JALANKAN.bat di folder utama.
echo   Jangan menjalankan keduanya bersamaan: port 8080 akan bentrok.
echo ====================================================================
echo.

node runner.js --only=simklinik %*
if %errorlevel% neq 0 (
  echo.
  echo [ERROR] Terjadi kesalahan saat menjalankan SIMKlinik.
)
pause
