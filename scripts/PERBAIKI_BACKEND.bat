@echo off
setlocal
title SIMKlinik - Perbaiki Backend Production (Build Bersih)
REM Skrip ada di scripts\, semua path di bawah relatif terhadap folder utama.
set ROOT=%~dp0..
cd /d "%ROOT%"

echo ====================================================================
echo   PERBAIKI BACKEND PRODUCTION
echo ====================================================================
echo   Dipakai bila backend gagal start karena file hasil build hilang
echo   (mis. "Cannot find module './mcu-template'").
echo.
echo   Langkah:
echo     1. Hentikan seluruh sistem production (8080 / 8082 / 4000 / 4010)
echo     2. Hapus folder apps\simklinik-api\dist (build lama yang tidak lengkap)
echo     3. Build ulang backend dari nol
echo     4. Jalankan seluruh sistem kembali (frontend tidak di-build ulang)
echo.
set /p LANJUT=Ketik YA untuk melanjutkan:
if /i not "%LANJUT%"=="YA" (
  echo Dibatalkan.
  pause
  exit /b 1
)

echo.
echo [1/4] Menghentikan production...
powershell -NoProfile -Command "Get-NetTCPConnection -LocalPort 8080,8082,4000,4010 -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique | ForEach-Object { Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue }"
timeout /t 2 /nobreak >nul
echo       [OK] Port dibebaskan.

echo.
echo [2/4] Menghapus hasil build backend lama...
cd /d "%ROOT%\apps\simklinik-api"
if exist "dist" (
  rmdir /S /Q "dist"
  echo       [OK] Folder dist dihapus.
) else (
  echo       [INFO] Folder dist memang belum ada.
)

echo.
echo [3/4] Build backend dari nol...
call npm run build
if errorlevel 1 (
  echo.
  echo [GAGAL] Build backend gagal. Production TIDAK dijalankan.
  cd /d "%ROOT%"
  pause
  exit /b 1
)
if not exist "dist\mcu\mcu-template.js" (
  echo.
  echo [GAGAL] dist\mcu\mcu-template.js tidak terbentuk. Build tidak lengkap.
  cd /d "%ROOT%"
  pause
  exit /b 1
)
echo       [OK] Build lengkap, mcu-template.js terbentuk.

cd /d "%ROOT%"
echo.
echo [4/4] Menjalankan seluruh sistem (portal + SIMKlinik)...
echo.
node runner.js
if %errorlevel% neq 0 (
  echo.
  echo [ERROR] Sistem berhenti dengan kode error.
  pause
)
