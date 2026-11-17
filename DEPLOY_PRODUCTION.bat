@echo off
setlocal
title SIMKlinik - Deploy ke Production
cd /d "%~dp0"

echo ====================================================================
echo   DEPLOY PRODUCTION SIMKLINIK
echo ====================================================================
echo   Langkah yang dijalankan:
echo     1. Hentikan production yang sedang berjalan (8080 / 8082 / 4000 / 4010)
echo     2. Cadangkan database production ke folder backups\
echo     3. Build layanan identitas (portal\identity-service)
echo     4. Build portal dashboard  (portal\portal-dashboard)
echo     5. Build backend SIMKlinik (server\dist)
echo     6. Build frontend SIMKlinik (client\.next)
echo     7. Jalankan ulang seluruh sistem
echo.
echo   PERHATIAN: seluruh web MATI selama build (perkiraan 3-5 menit).
echo   Jalankan saat klinik sedang sepi.
echo.
echo   Port 4010 dan 8082 termasuk: layanan identitas dan portal ikut
echo   dihentikan karena portal memegang kunci SSO ke SIMKlinik.
echo.
set /p LANJUT=Ketik YA untuk melanjutkan:
if /i not "%LANJUT%"=="YA" (
  echo Dibatalkan. Tidak ada yang diubah.
  pause
  exit /b 1
)

echo.
echo [1/7] Menghentikan seluruh layanan...
powershell -NoProfile -Command "Get-NetTCPConnection -LocalPort 8080,8082,4000,4010 -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique | ForEach-Object { Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue }"
timeout /t 2 /nobreak >nul
echo       [OK] Port 8080, 8082, 4000, dan 4010 dibebaskan.

echo.
echo [2/7] Mencadangkan database production...
for /f %%I in ('powershell -NoProfile -Command "Get-Date -Format yyyyMMdd-HHmmss"') do set STAMP=%%I
if not exist "backups" mkdir "backups"
if exist "server\data\vaksinku.sqlite" (
  copy /Y "server\data\vaksinku.sqlite" "backups\vaksinku-%STAMP%.sqlite" >nul
  if exist "server\data\vaksinku.sqlite-wal" copy /Y "server\data\vaksinku.sqlite-wal" "backups\vaksinku-%STAMP%.sqlite-wal" >nul
  if exist "server\data\vaksinku.sqlite-shm" copy /Y "server\data\vaksinku.sqlite-shm" "backups\vaksinku-%STAMP%.sqlite-shm" >nul
  echo       [OK] Backup SIMKlinik: backups\vaksinku-%STAMP%.sqlite
) else (
  echo       [INFO] Database production belum ada; tidak ada yang dicadangkan.
)
REM Database identitas berisi data induk pasien. Sejak portal dipakai, ini
REM sama pentingnya dengan database SIMKlinik — jangan dilewatkan.
if exist "portal\identity-service\data\identity.sqlite" (
  copy /Y "portal\identity-service\data\identity.sqlite" "backups\identity-%STAMP%.sqlite" >nul
  if exist "portal\identity-service\data\identity.sqlite-wal" copy /Y "portal\identity-service\data\identity.sqlite-wal" "backups\identity-%STAMP%.sqlite-wal" >nul
  if exist "portal\identity-service\data\identity.sqlite-shm" copy /Y "portal\identity-service\data\identity.sqlite-shm" "backups\identity-%STAMP%.sqlite-shm" >nul
  echo       [OK] Backup identitas: backups\identity-%STAMP%.sqlite
) else (
  echo       [INFO] Database identitas belum ada; tidak ada yang dicadangkan.
)

echo.
echo [3/7] Build layanan identitas (portal\identity-service)...
cd /d "%~dp0portal\identity-service"
if exist "dist" rmdir /S /Q "dist"
call npm run build
if errorlevel 1 (
  echo.
  echo [GAGAL] Build layanan identitas gagal. Tidak ada yang dijalankan.
  echo         Perbaiki error di atas, lalu jalankan ulang skrip ini.
  cd /d "%~dp0"
  pause
  exit /b 1
)
echo       [OK] Layanan identitas berhasil di-build.

echo.
echo [4/7] Build portal dashboard (portal\portal-dashboard)...
cd /d "%~dp0portal\portal-dashboard"
if exist ".next" rmdir /S /Q ".next"
call npm run build
if errorlevel 1 (
  echo.
  echo [GAGAL] Build portal gagal. Tidak ada yang dijalankan.
  echo         Perbaiki error di atas, lalu jalankan ulang skrip ini.
  cd /d "%~dp0"
  pause
  exit /b 1
)
echo       [OK] Portal berhasil di-build.

echo.
echo [5/7] Build backend (bersih, tanpa cache incremental)...
cd /d "%~dp0server"
if exist "dist" rmdir /S /Q "dist"
call npm run build
if errorlevel 1 (
  echo.
  echo [GAGAL] Build backend gagal. Production TIDAK dijalankan.
  echo         Perbaiki error di atas, lalu jalankan ulang skrip ini.
  cd /d "%~dp0"
  pause
  exit /b 1
)
echo       [OK] Backend berhasil di-build.

echo.
echo [6/7] Build frontend production...
cd /d "%~dp0client"
call npm run build
if errorlevel 1 (
  echo.
  echo [GAGAL] Build frontend gagal. Production TIDAK dijalankan.
  echo         Perbaiki error di atas, lalu jalankan ulang skrip ini.
  cd /d "%~dp0"
  pause
  exit /b 1
)
echo       [OK] Frontend berhasil di-build.

cd /d "%~dp0"
echo.
echo [7/7] Menjalankan seluruh sistem (portal + SIMKlinik)...
echo.
node portal\runner.js --with-simklinik

if %errorlevel% neq 0 (
  echo.
  echo [ERROR] Sistem berhenti dengan kode error.
  pause
)
