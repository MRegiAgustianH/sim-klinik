@echo off
setlocal
title SIMKlinik - Verifikasi Otomatis MCU (Penanda Halaman Baru)
cd /d "%~dp0"

echo ====================================================================
echo   VERIFIKASI OTOMATIS MCU
echo   - Tidak memakai port 8080 / 4000 (production tetap berjalan)
echo   - Backend di-build ke folder dist-dev, folder dist production aman
echo   - Database yang dipakai: DEVELOPMENT (data\vaksinku-dev.sqlite)
echo ====================================================================
echo.

set RESULT=0
set SERVER_DIR=%cd%\server
set CLIENT_DIR=%cd%\client

echo [1/4] Memeriksa TypeScript backend...
cd /d "%SERVER_DIR%"
call node_modules\.bin\tsc.cmd -p tsconfig.dev.json --noEmit
if errorlevel 1 (
  echo.
  echo [GAGAL] Ada error TypeScript di backend. Teks error terlihat di atas.
  set RESULT=1
  goto summary
)
echo       [OK] Tidak ada error TypeScript backend.
echo.

echo [2/4] Build backend ke folder dist-dev (dist production tidak disentuh)...
call node_modules\.bin\tsc.cmd -p tsconfig.dev.json
if errorlevel 1 (
  echo [GAGAL] Build backend gagal.
  set RESULT=1
  goto summary
)
echo       [OK] Backend berhasil di-build.
echo.

echo [3/4] Tes simpan + cetak PDF (database development)...
node dist-dev\test-mcu-pdf.js
if errorlevel 1 set RESULT=1
echo.

echo [4/4] Memeriksa TypeScript frontend (Next.js)...
cd /d "%CLIENT_DIR%"
call node_modules\.bin\tsc.cmd --noEmit -p tsconfig.json
if errorlevel 1 (
  echo.
  echo [GAGAL] Ada error TypeScript di frontend. Teks error terlihat di atas.
  set RESULT=1
  goto summary
)
echo       [OK] Tidak ada error TypeScript frontend.
echo.

:summary
cd /d "%~dp0"
echo.
if %RESULT% neq 0 (
  echo ====================================================================
  echo   [GAGAL] Ada tes yang tidak lulus. Lihat baris berlabel FAIL / error di atas.
  echo ====================================================================
) else (
  echo ====================================================================
  echo   [LULUS] Semua tes berhasil.
  echo   Penanda halaman baru tersimpan dan PDF memecah halaman dengan benar.
  echo   Restart MODE_PENGEMBANGAN_DEV.bat agar web dev memakai kode terbaru.
  echo ====================================================================
)
echo.
pause
exit /b %RESULT%
