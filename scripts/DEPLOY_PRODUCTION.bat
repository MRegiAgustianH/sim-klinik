@echo off
setlocal
title Sistem Klinik - Deploy ke Production
REM Skrip ada di scripts\, semua path di bawah relatif terhadap folder utama.
set ROOT=%~dp0..
cd /d "%ROOT%"

echo ====================================================================
echo   DEPLOY PRODUCTION SISTEM KLINIK
echo ====================================================================
echo   Langkah yang dijalankan:
echo     1. Hentikan production yang sedang berjalan (8080 / 8082 / 8084 / 4000 / 4002 / 4010)
echo     2. Cadangkan database production ke data\backups\
echo     3. Build layanan identitas  (services\identity)
echo     4. Build portal             (apps\portal)
echo     5. Build backend SIMKlinik  (apps\simklinik-api\dist)
echo     6. Build frontend SIMKlinik (apps\simklinik-web\.next)
echo     7. Build backend surat      (apps\surat-laporan\api\dist)
echo     8. Build frontend surat     (apps\surat-laporan\web\.next)
echo     9. Jalankan ulang seluruh sistem
echo.
echo   PERHATIAN: seluruh web MATI selama build (perkiraan 3-5 menit).
echo   Jalankan saat klinik sedang sepi.
echo.
set /p LANJUT=Ketik YA untuk melanjutkan:
if /i not "%LANJUT%"=="YA" (
  echo Dibatalkan. Tidak ada yang diubah.
  pause
  exit /b 1
)

echo.
echo [1/9] Menghentikan seluruh layanan...
powershell -NoProfile -Command "Get-NetTCPConnection -LocalPort 8080,8082,8084,4000,4002,4010 -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique | ForEach-Object { Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue }"
timeout /t 2 /nobreak >nul
echo       [OK] Port 8080, 8082, 8084, 4000, 4002, dan 4010 dibebaskan.

echo.
echo [2/9] Mencadangkan database production...
for /f %%I in ('powershell -NoProfile -Command "Get-Date -Format yyyyMMdd-HHmmss"') do set STAMP=%%I
if not exist "data\backups" mkdir "data\backups"
if exist "data\simklinik\vaksinku.sqlite" (
  copy /Y "data\simklinik\vaksinku.sqlite" "data\backups\vaksinku-%STAMP%.sqlite" >nul
  if exist "data\simklinik\vaksinku.sqlite-wal" copy /Y "data\simklinik\vaksinku.sqlite-wal" "data\backups\vaksinku-%STAMP%.sqlite-wal" >nul
  if exist "data\simklinik\vaksinku.sqlite-shm" copy /Y "data\simklinik\vaksinku.sqlite-shm" "data\backups\vaksinku-%STAMP%.sqlite-shm" >nul
  echo       [OK] Backup SIMKlinik: data\backups\vaksinku-%STAMP%.sqlite
) else (
  echo       [INFO] Database SIMKlinik belum ada; tidak ada yang dicadangkan.
)
REM Database identitas berisi data induk pasien; sama pentingnya dengan
REM database SIMKlinik, jangan dilewatkan.
if exist "data\identity\identity.sqlite" (
  copy /Y "data\identity\identity.sqlite" "data\backups\identity-%STAMP%.sqlite" >nul
  if exist "data\identity\identity.sqlite-wal" copy /Y "data\identity\identity.sqlite-wal" "data\backups\identity-%STAMP%.sqlite-wal" >nul
  if exist "data\identity\identity.sqlite-shm" copy /Y "data\identity\identity.sqlite-shm" "data\backups\identity-%STAMP%.sqlite-shm" >nul
  echo       [OK] Backup identitas: data\backups\identity-%STAMP%.sqlite
) else (
  echo       [INFO] Database identitas belum ada; tidak ada yang dicadangkan.
)
REM Database sistem surat: arsip surat, template, kop, dan penomoran.
if exist "data\surat\surat.sqlite" (
  copy /Y "data\surat\surat.sqlite" "data\backups\surat-%STAMP%.sqlite" >nul
  if exist "data\surat\surat.sqlite-wal" copy /Y "data\surat\surat.sqlite-wal" "data\backups\surat-%STAMP%.sqlite-wal" >nul
  if exist "data\surat\surat.sqlite-shm" copy /Y "data\surat\surat.sqlite-shm" "data\backups\surat-%STAMP%.sqlite-shm" >nul
  echo       [OK] Backup sistem surat: data\backups\surat-%STAMP%.sqlite
) else (
  echo       [INFO] Database sistem surat belum ada; tidak ada yang dicadangkan.
)

echo.
echo [3/9] Build layanan identitas...
cd /d "%ROOT%\services\identity"
if exist "dist" rmdir /S /Q "dist"
call npm run build
if errorlevel 1 goto gagal
echo       [OK] Layanan identitas berhasil di-build.

echo.
echo [4/9] Build portal...
cd /d "%ROOT%\apps\portal"
if exist ".next" rmdir /S /Q ".next"
call npm run build
if errorlevel 1 goto gagal
echo       [OK] Portal berhasil di-build.

echo.
echo [5/9] Build backend SIMKlinik (bersih, tanpa cache incremental)...
cd /d "%ROOT%\apps\simklinik-api"
if exist "dist" rmdir /S /Q "dist"
call npm run build
if errorlevel 1 goto gagal
echo       [OK] Backend berhasil di-build.

echo.
echo [6/9] Build frontend SIMKlinik...
cd /d "%ROOT%\apps\simklinik-web"
call npm run build
if errorlevel 1 goto gagal
echo       [OK] Frontend berhasil di-build.

echo.
echo [7/9] Build backend sistem surat (bersih)...
cd /d "%ROOT%\apps\surat-laporan\api"
if not exist "node_modules" call npm install
if exist "dist" rmdir /S /Q "dist"
call npm run build
if errorlevel 1 goto gagal
echo       [OK] Backend sistem surat berhasil di-build.

echo.
echo [8/9] Build frontend sistem surat...
cd /d "%ROOT%\apps\surat-laporan\web"
if not exist "node_modules" call npm install
if exist ".next" rmdir /S /Q ".next"
call npm run build
if errorlevel 1 goto gagal
echo       [OK] Frontend sistem surat berhasil di-build.

cd /d "%ROOT%"
echo.
echo [9/9] Menjalankan seluruh sistem...
echo.
node runner.js
if %errorlevel% neq 0 (
  echo.
  echo [ERROR] Sistem berhenti dengan kode error.
  pause
)
exit /b 0

:gagal
echo.
echo [GAGAL] Build gagal. Production TIDAK dijalankan.
echo         Perbaiki error di atas, lalu jalankan ulang skrip ini.
cd /d "%ROOT%"
pause
exit /b 1
