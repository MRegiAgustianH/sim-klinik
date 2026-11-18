# Panduan Pemasangan SIMKlinik

Panduan memasang sistem dari nol di komputer server klinik. Untuk pemakaian sehari-hari setelah terpasang, lihat `README.md`. Untuk portal dan SSO, lihat `docs/portal-dan-sso.md`.

**Waktu pemasangan:** sekitar 20–30 menit, sebagian besar menunggu unduhan.

---

## 1. Yang dibutuhkan

| Kebutuhan | Keterangan |
| :--- | :--- |
| Windows 10/11 | Komputer server yang selalu menyala di jam kerja |
| **Node.js 22.13 atau lebih baru** | Wajib. Backend memakai modul `node:sqlite` yang belum ada di versi lama |
| Git | Untuk mengunduh dan memperbarui kode |
| Jaringan LAN / Wi-Fi klinik | Komputer lain mengakses lewat IP server |
| Google Cloud service account | Hanya bila memakai sinkronisasi Google Form (opsional) |

### Memasang Node.js

1. Unduh dari <https://nodejs.org> — pilih versi **LTS** (22.x atau lebih baru).
2. Jalankan pemasangnya, biarkan semua pilihan bawaan.
3. **Tutup lalu buka ulang Command Prompt**, kemudian periksa:

```bat
node -v
```

Harus menampilkan `v22.13.0` atau lebih tinggi. Bila masih versi lama, kemungkinan Node lama masih terpasang — hapus lewat *Add or remove programs*, lalu pasang ulang.

---

## 2. Mengunduh kode

```bat
cd /d C:\
git clone https://github.com/MRegiAgustianH/sim-klinik.git
cd sim-klinik
```

Tempat lain boleh saja, tetapi **hindari folder OneDrive/Dropbox**. Sinkronisasi cloud dapat mengunci file database saat aplikasi berjalan dan merusak data.

Dependensi akan terpasang otomatis saat aplikasi pertama kali dijalankan. Bila ingin memasang manual lebih dulu:

```bat
cd apps\simklinik-api && npm install && cd ..\..
cd apps\simklinik-web && npm install && cd ..\..
cd apps\portal && npm install && cd ..\..
cd services\identity && npm install && cd ..\..
```

---

## 3. Menyiapkan kredensial Google (opsional)

Lewati bagian ini bila tidak memakai sinkronisasi Google Form. Aplikasi tetap berjalan; hanya pendaftaran mandiri lewat QR yang tidak aktif.

1. Buat *service account* di Google Cloud Console, aktifkan **Google Sheets API** dan **Google Drive API**.
2. Unduh kunci dalam format JSON.
3. Simpan sebagai `secrets\google-credentials.json` (buat folder `secrets` di folder utama bila belum ada).
4. Bagikan spreadsheet Google Form ke alamat email service account tersebut (peran *Editor*).

Berkas ini sudah masuk `.gitignore`. **Jangan pernah** di-commit — kunci itu memberi akses ke data pendaftaran pasien.

---

## 4. Build (wajib, sekali di awal)

Production memakai hasil build, bukan kode sumber. Jalankan berurutan:

```bat
cd /d C:\sim-klinik\services\identity
npm run build

cd /d C:\sim-klinik\apps\portal
npm run build

cd /d C:\sim-klinik\apps\simklinik-api
npm run build

cd /d C:\sim-klinik\apps\simklinik-web
npm run build
```

Verifikasi build SIMKlinik sudah memuat halaman SSO:

```bat
type C:\sim-klinik\apps\simklinik-web\.next\app-path-routes-manifest.json
```

Harus ada `"/sso/page":"/sso"`. Bila tidak ada, portal tidak bisa membuka SIMKlinik otomatis.

---

## 5. Menjalankan

```bat
cd /d C:\sim-klinik
JALANKAN.bat
```

Satu perintah menyalakan tiga layanan:

| Layanan | Port | Fungsi |
| :--- | :--- | :--- |
| Layanan identitas | 4010 | Pengguna, pasien, token SSO |
| Portal | 8082 | Pintu masuk semua aplikasi |
| SIMKlinik | 8080 | Vaksinasi, ICV, MCU, stok |

Jendela Command Prompt harus **tetap terbuka**. CTRL + C untuk mematikan.

Saat pertama dijalankan, launcher otomatis:
- membuat database di `data\simklinik\` dan `data\identity\`, lalu mengisinya dengan akun awal
- membuat service key untuk portal dan SIMKlinik di `secrets\service-keys\`

---

## 6. Mengakses dari komputer lain

1. Catat IP server yang ditampilkan di banner launcher (mis. `192.168.1.10`).
2. Di komputer/tablet lain dalam jaringan yang sama, buka:

```
http://192.168.1.10:8082
```

3. Tambahkan pengecualian firewall bila tidak bisa dibuka (jalankan sebagai Administrator):

```bat
netsh advfirewall firewall add rule name="SIMKlinik Portal" dir=in action=allow protocol=TCP localport=8082
netsh advfirewall firewall add rule name="SIMKlinik App" dir=in action=allow protocol=TCP localport=8080
```

4. Agar IP server tidak berubah, set *static IP* atau reservasi DHCP di router.

---

## 7. Keamanan wajib sebelum dipakai

Tiga hal ini tidak boleh dilewatkan pada sistem berisi rekam medis.

### 7.1 Ganti JWT_SECRET

Nilai bawaan ada di kode dan diketahui siapa pun yang membaca repositori. Set sebelum menjalankan, di jendela yang sama:

```bat
set JWT_SECRET=<kunci-acak-panjang>
```

Buat kunci acak dengan:

```bat
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Nilai ini harus **sama** untuk ketiga layanan. Untuk pemasangan permanen, atur sebagai variabel lingkungan sistem Windows. Jangan menaruhnya di `.env.local`: file itu adalah penanda mode development dan dihapus otomatis saat production dijalankan.

### 7.2 Ganti kata sandi akun bawaan

| Peran | Username | Kata sandi awal |
| :--- | :--- | :--- |
| Superadmin | `superadmin` | `admin123` |
| Dokter | `dokter` | `dokter123` |
| Perawat | `perawat` | `perawat123` |
| Administrasi | `admin` | `admin123` |

Login ke portal di 8082 → menu **Profil Saya** untuk mengganti. Atur juga hak akses aplikasi tiap akun di menu **Pengguna**.

### 7.3 Pastikan data pasien tidak terunggah

```bat
cd /d C:\sim-klinik
git status --short
```

Tidak boleh ada file dari `data\` atau `secrets\`, `*.sqlite`, `*.key`, atau `google-credentials.json`. Bila muncul, **jangan commit** — periksa `.gitignore` lebih dulu.

---

## 8. Uji setelah pemasangan

Kerjakan berurutan. Bila satu langkah gagal, perbaiki dulu sebelum lanjut.

1. **Login portal** — buka `http://localhost:8082`, masuk sebagai `superadmin`.
2. **Beranda** — kartu aplikasi muncul dengan status *Aktif*.
3. **Buka SIMKlinik** — klik **Buka Aplikasi** pada kartu SIMKlinik. Harus terbuka **tab baru** dan langsung masuk tanpa login ulang.
4. **Kembali ke portal** — di tab SIMKlinik, klik **Portal SIMKlinik** di sidebar.
5. **Data pasien** — di portal, buka menu **Data Pasien**, tambah satu pasien uji dengan NIK 16 digit. Simpan berhasil.
6. **NIK ganda** — coba simpan NIK yang sama lagi. Harus ditolak dengan pesan bahwa NIK sudah terdaftar (bukan error menakutkan).
7. **Cetak MCU** — di SIMKlinik, buat laporan MCU dan unduh PDF. Periksa kop surat dan blok tanda tangan.
8. **Akses LAN** — buka `http://<IP-server>:8082` dari komputer lain.
9. **Backup** — pastikan `data\simklinik\vaksinku.sqlite` dan `data\identity\identity.sqlite` ada.

---

## 9. Mengimpor data pasien lama (opsional)

Setelah sistem berjalan. Membaca database SIMKlinik **read-only** dan mengisi data induk pasien di portal.

```bat
cd /d C:\sim-klinik\services\identity
npm run import:patients -- --dry-run
```

Pelajari ringkasannya — berapa pasien terimpor, berapa dilewati karena NIK kosong, dan **bentrok** (NIK sama tetapi nama/tanggal lahir berbeda). Periksa bentrok secara manual sebelum melanjutkan.

Setelah yakin, cadangkan dulu lalu impor sungguhan:

```bat
copy data\identity.sqlite data\identity-backup.sqlite
npm run import:patients
```

---

## 10. Backup rutin

Yang **wajib** disalin, minimal sekali seminggu ke drive eksternal:

```
data\simklinik\vaksinku.sqlite      (+ -wal dan -shm bila ada)
data\identity\identity.sqlite       (+ -wal dan -shm bila ada)
data\simklinik\vaksinku-dev.sqlite  (bila memakai mode dev)
secrets\service-keys\              (kunci SSO; tanpa ini semua aplikasi harus login ulang)
secrets\google-credentials.json
```

Cara aman: matikan aplikasi (CTRL + C), salin berkasnya, jalankan lagi. Menyalin saat aplikasi berjalan bisa menghasilkan berkas yang tidak utuh.

`scripts\DEPLOY_PRODUCTION.bat` juga mencadangkan database SIMKlinik dan identitas otomatis ke `data\backups\` setiap kali deploy.

---

## 11. Memperbarui aplikasi

```bat
cd /d C:\sim-klinik
git pull
```

Lalu build ulang bagian yang berubah (bagian 4), kemudian nyalakan lagi. Bila hanya kode frontend yang berubah, cukup build folder itu.

**Selalu cadangkan database sebelum menarik pembaruan** yang menyentuh skema.

---

## 12. Bila ada masalah

| Gejala | Penyebab dan tindakan |
| :--- | :--- |
| `This site can't be reached` di 8082 | Aplikasi belum berjalan. Jalankan `JALANKAN.bat`; jendelanya harus tetap terbuka |
| Portal terbuka, login 500 | Layanan identitas mati. Jangan pakai `npm run start` sendirian — pakai launcher |
| Buka Aplikasi → 404 di `/sso` | Client SIMKlinik belum di-build ulang. Jalankan bagian 4 |
| Buka Aplikasi → "Service key belum dibuat" | Jalankan launcher sekali; kunci dibuat otomatis. Bila tetap gagal, jalankan `npm run generate-key -- portal --portal` di `services\identity` |
| Buka Aplikasi → "Tiket tidak dikenal atau sudah dipakai" | Tiket berlaku 60 detik dan sekali pakai. Klik ulang dari portal, jangan pakai URL lama |
| Tab baru tidak terbuka | Popup diblokir. Izinkan popup untuk alamat portal di pengaturan peramban |
| `EADDRINUSE` | Port masih dipakai proses lama. Tutup jendela launcher sebelumnya, atau jalankan ulang — launcher membersihkan port |
| `Cannot find module './mcu-template'` | `scripts\PERBAIKI_BACKEND.bat` |
| Perubahan kode tidak muncul | Production tidak hot reload. Build ulang |
| Tidak bisa diakses dari komputer lain | Firewall. Lihat bagian 6 langkah 3 |

Log lengkapnya ada di jendela launcher. Pesan error di sana biasanya menyebutkan langkah mana yang gagal (`[1/5]` sampai `[5/5]`).
