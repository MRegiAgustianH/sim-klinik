@echo off
setlocal
title SIMKlinik - Deploy ke Production
cd /d "%~dp0"

echo ====================================================================
echo   DEPLOY PRODUCTION SIMKLINIK
echo ====================================================================
echo   Langkah yang dijalankan:
echo     1. Hentikan production yang sedang berjalan (port 8080 / 4000)
echo     2. Cadangkan database production ke folder backups\
echo     3. Build backend  (server\dist)
echo     4. Build frontend (client\.next)
echo     5. Jalankan ulang production
echo.
echo   PERHATIAN: web production MATI selama build (perkiraan 1-3 menit).
echo   Jalankan saat klinik sedang sepi.
echo.
echo   Saat start, data demo (4 pasien contoh + 1 laporan MCU SUHERIONO)
echo   akan dihapus otomatis. Pasien asli tidak disentuh.
echo.
set /p LANJUT=Ketik YA untuk melanjutkan:
if /i not "%LANJUT%"=="YA" (
  echo Dibatalkan. Tidak ada yang diubah.
  pause
  exit /b 1
)

echo.
echo [1/5] Menghentikan production...
powershell -NoProfile -Command "Get-NetTCPConnection -LocalPort 8080,4000 -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique | ForEach-Object { Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue }"
timeout /t 2 /nobreak >nul
echo       [OK] Port 8080 dan 4000 dibebaskan.

echo.
echo [2/5] Mencadangkan database production...
for /f %%I in ('powershell -NoProfile -Command "Get-Date -Format yyyyMMdd-HHmmss"') do set STAMP=%%I
if not exist "backups" mkdir "backups"
if exist "server\data\vaksinku.sqlite" (
  copy /Y "server\data\vaksinku.sqlite" "backups\vaksinku-%STAMP%.sqlite" >nul
  if exist "server\data\vaksinku.sqlite-wal" copy /Y "server\data\vaksinku.sqlite-wal" "backups\vaksinku-%STAMP%.sqlite-wal" >nul
  if exist "server\data\vaksinku.sqlite-shm" copy /Y "server\data\vaksinku.sqlite-shm" "backups\vaksinku-%STAMP%.sqlite-shm" >nul
  echo       [OK] Backup: backups\vaksinku-%STAMP%.sqlite
) else (
  echo       [INFO] Database production belum ada; tidak ada yang dicadangkan.
)

echo.
echo [3/5] Build backend...
cd /d "%~dp0server"
call npm run build
if errorlevel 1 (
  echo.
  echo [GAGAL] Build backend gagal. Production TIDAK dijalankan.
  echo         Perbaiki error di atas, lalu jalankan ulang skrip ini.
  cd ..
  pause
  exit /b 1
)
echo       [OK] Backend berhasil di-build.

echo.
echo [4/5] Build frontend production...
cd /d "%~dp0client"
call npm run build
if errorlevel 1 (
  echo.
  echo [GAGAL] Build frontend gagal. Production TIDAK dijalankan.
  echo         Perbaiki error di atas, lalu jalankan ulang skrip ini.
  cd ..
  pause
  exit /b 1
)
echo       [OK] Frontend berhasil di-build.

cd /d "%~dp0"
echo.
echo [5/5] Menjalankan production...
echo.
node runner.js

if %errorlevel% neq 0 (
  echo.
  echo [ERROR] Production berhenti dengan kode error.
  pause
)
