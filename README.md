# SIMKlinik — Klinik Utama Dr. H. A. Rotinsulu Cianjur

Sistem Informasi Manajemen Pelayanan Klinik: vaksinasi internasional, buku kuning (ICV), Medical Check Up (MCU), stok vaksin, dan rekam medis pasien.

**Untuk apa:** menggantikan pencatatan manual (Excel, Word, buku tulis) di klinik. Dokter, perawat, dan admin bekerja dari satu database yang sama lewat browser di dalam jaringan LAN/Wi-Fi klinik — satu komputer sebagai server, sisanya cukup membuka alamat IP server.

Repositori: `https://github.com/MRegiAgustianH/sim-klinik.git`

---

## 1. Isi Aplikasi

| Modul | Fungsi |
| :--- | :--- |
| Dashboard | Ringkasan kunjungan, stok kritis, dan aktifitas terbaru |
| Pasien | Registrasi & 22 parameter rekam medis vaksinasi, skrining tes kehamilan WUS, nomor ICV, persetujuan dokter |
| MCU | Laporan hasil Medical Check Up, template 1-klik isi normal, pratinjau A4, ekspor PDF 4 halaman |
| Stok | Master stok vaksin per batch, inventaris buku ICV, mutasi masuk/keluar, pengurangan otomatis saat vaksinasi |
| Laporan | Ekspor Excel multi-sheet (rekap pasien, stok, ICV), PDF rekap bulanan, kartu bukti vaksinasi per pasien |
| Pengguna | Manajemen akun & peran (Superadmin / Dokter / Perawat) |
| Registrasi Mandiri | QR Code + Google Form, sinkronisasi otomatis tiap 30 detik dari Google Sheets |

**Akun bawaan** (seeding otomatis saat database pertama kali dibuat):

| Peran | Username | Password |
| :--- | :--- | :--- |
| Superadmin | `superadmin` | `admin123` |
| Dokter | `dokter` | `dokter123` |
| Perawat | `perawat` | `perawat123` |

Ubah kata sandi lewat menu **Profil** setelah login pertama.

---

## 2. Struktur Folder

```
sim-klinik/
├─ JALANKAN.bat               ** YANG DIKLIK DI SERVER KLINIK ** (identitas + portal + SIMKlinik)
├─ MODE_PENGEMBANGAN.bat      Versi development, berdampingan dengan production
├─ runner.js                  Launcher tunggal seluruh sistem
├─ config/ports.js            Satu-satunya daftar port (production & development)
│
├─ apps/                      Aplikasi yang dibuka staf
│  ├─ portal/                 Next.js :8082 — login, kartu aplikasi, pasien, pengguna
│  ├─ simklinik-web/          Next.js :8080 — frontend vaksinasi, ICV, MCU, stok
│  ├─ simklinik-api/          NestJS  :4000 — REST API, PDF, Excel, sinkron Google Form
│  └─ surat-laporan/          (belum dikerjakan)
├─ services/
│  └─ identity/               NestJS  :4010 — pengguna, data induk pasien, token SSO
│
├─ scripts/                   Perawatan: deploy, perbaiki backend, verifikasi MCU, migrasi
├─ assets/                    Kop surat (header-hasil.jpeg) untuk cetak PDF
├─ docs/                      Panduan pemasangan, arsitektur, catatan fitur
│
├─ data/        (tidak di-git) simklinik/, identity/, backups/
└─ secrets/     (tidak di-git) google-credentials.json, service-keys/
```

Pembagiannya: `apps/` untuk yang dibuka staf, `services/` untuk yang dipakai bersama semua aplikasi. Semua data pasien ada di `data/` dan semua rahasia di `secrets/`, jadi backup cukup menyalin dua folder itu.

---

## 3. Cara Menjalankan Server

**Prasyarat:** Windows 10/11 dan Node.js (backend memakai modul `node:sqlite`, jadi gunakan **Node.js 22.13 atau lebih baru** — cek dengan `node -v`). Dependensi terpasang otomatis saat pertama dijalankan.

### Production (dipakai klinik sehari-hari)

1. Klik ganda **`JALANKAN.bat`**. Satu klik menyalakan layanan identitas (4010), portal (8082), dan SIMKlinik (8080/4000).
2. Staf membuka `http://<IP-server>:8082`, login sekali di portal, lalu pilih aplikasi dari beranda.
3. Biarkan jendela Command Prompt tetap terbuka. **CTRL + C** untuk mematikan semuanya.

Bila portal tidak dipakai, SIMKlinik bisa dijalankan sendiri dengan `scripts\JALANKAN_SIMKLINIK_SAJA.bat` (`node runner.js --only=simklinik`). Jangan jalankan keduanya bersamaan — port 8080 bentrok.

### Development (menguji fitur baru)

1. Klik ganda **`MODE_PENGEMBANGAN.bat`**, atau: `node runner.js --dev`
2. Berjalan **berdampingan** dengan production — web pasien tidak terganggu.

| Aspek | Production | Development |
| :--- | :--- | :--- |
| Portal | `http://localhost:8082` | `http://localhost:8083` |
| SIMKlinik | `http://localhost:8080` (backend 4000) | `http://localhost:8081` (backend 4001) |
| Layanan identitas | 4010 | 4011 |
| Database SIMKlinik | `data/simklinik/vaksinku.sqlite` | `data/simklinik/vaksinku-dev.sqlite` |
| Database identitas | `data/identity/identity.sqlite` | `data/identity/identity-dev.sqlite` |
| Service key | `secrets/service-keys/<app>.key` | `secrets/service-keys/<app>-dev.key` |
| Folder build Next.js | `.next` | `.next-dev` |
| Backend dari | `dist` (hasil build) | `src` (ts-node) |
| Hot reload | Tidak | Ya |

Penanda mode adalah file `.env.local` di `apps/simklinik-api/` dan `services/identity/`. File itu hanya dibuat di mode dev dan **dihapus otomatis** saat production dijalankan, agar backend tidak salah memakai database dev.

### Pilihan launcher

| Perintah | Yang dinyalakan |
| :--- | :--- |
| `node runner.js` | identitas + portal + SIMKlinik (production) |
| `node runner.js --dev` | sama, mode development |
| `node runner.js --only=simklinik` | identitas + SIMKlinik |
| `node runner.js --only=portal` | identitas + portal |

Port semua aplikasi diatur di `config/ports.js`. Runner meneruskan port dan `KLINIK_ROOT` (root repo) ke setiap proses, sehingga lokasi `data/`, `secrets/`, dan `assets/` tidak bergantung pada folder tempat aplikasi dijalankan.

---

## 4. Maintenance Web

### Alur rilis fitur

1. Uji di mode development (`MODE_PENGEMBANGAN.bat`) — cek form, pratinjau A4, unduh PDF.
2. Jalankan `scripts\VERIFIKASI_MCU.bat` untuk memastikan tidak ada error TypeScript dan cetak PDF masih benar.
3. Klik ganda **`scripts\DEPLOY_PRODUCTION.bat`**. Skrip ini menghentikan production → mencadangkan kedua database ke `data\backups\` → build keempat aplikasi → menjalankan seluruh sistem kembali. Downtime 3–5 menit, jalankan saat klinik sepi.

### Perbaikan cepat

| Gejala | Tindakan |
| :--- | :--- |
| Tidak bisa dibuka, port bentrok (`EADDRINUSE`) | Tutup jendela lama, jalankan ulang `JALANKAN.bat` |
| Backend gagal start: `Cannot find module './mcu-template'` | `scripts\PERBAIKI_BACKEND.bat` (hapus `apps\simklinik-api\dist`, build ulang bersih) |
| Perubahan kode tidak muncul di production | Build ulang (`scripts\DEPLOY_PRODUCTION.bat`) — production tidak hot reload |
| Halaman blank / error setelah update | Kembalikan source ke commit sebelumnya (`git checkout <commit>`), lalu deploy ulang |

### Backup dan pemulihan

- **Backup manual:** salin folder `data\` dan `secrets\` saat aplikasi mati.
- **Backup otomatis:** `scripts\DEPLOY_PRODUCTION.bat` mencadangkan kedua database ke `data\backups\` setiap kali deploy.
- **Pemulihan:** matikan aplikasi, timpa file di `data\simklinik\` atau `data\identity\` dengan file backup (beserta `-wal`/`-shm` bila ada), jalankan ulang.
- Jadwalkan penyalinan `data\backups\` ke drive eksternal / cloud minimal sekali seminggu.

### Kredensial Google Form

Backend membaca satu file: `secrets\google-credentials.json` (bisa diganti lewat variabel lingkungan `GOOGLE_CREDENTIALS_PATH`). Untuk pindah ke akun Google lain: share spreadsheet ke email bot akun baru lebih dulu, ganti isi file itu, lalu jalankan ulang sistem.

### Keamanan wajib sebelum dipakai luas

- Ganti `JWT_SECRET` (bawaan `VaksinKU_Super_Secret_Key_Hospital_2026`) lewat variabel lingkungan.
- Ganti ketiga kata sandi akun bawaan.
- `data/` dan `secrets/` sudah masuk `.gitignore` — jangan pernah di-commit (rahasia medis, UU PDP).

---

## 5. Dokumentasi Lain

| Dokumen | Isi |
| :--- | :--- |
| [docs/SETUP.md](docs/SETUP.md) | Pemasangan di komputer server baru |
| [docs/arsitektur-integrasi.md](docs/arsitektur-integrasi.md) | Rancangan portal, identitas pasien, menambah app baru, app surat & laporan |
| [docs/portal-dan-sso.md](docs/portal-dan-sso.md) | Cara kerja portal, SSO, service key, impor pasien |
| [services/identity/README.md](services/identity/README.md) | Endpoint dan skrip layanan identitas |
| [docs/panduan-vaksinku.md](docs/panduan-vaksinku.md) | Panduan langkah demi langkah pemakaian aplikasi |
| [docs/fitur-registrasi-mandiri-qr.md](docs/fitur-registrasi-mandiri-qr.md) | Registrasi mandiri lewat QR Code + Google Form |

---

## 6. Push ke GitHub

`.gitignore` sudah mengamankan `data/`, `secrets/`, semua `*.sqlite`, kredensial, `node_modules/`, serta hasil build.

```bash
git remote add origin https://github.com/MRegiAgustianH/sim-klinik.git
git push -u origin main
```
