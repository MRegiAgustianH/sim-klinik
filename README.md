# SIMKlinik - Klinik Utama Dr. H. A. Rotinsulu Cianjur
### Sistem Informasi Manajemen Pelayanan Klinik (Vaksinasi Internasional, Buku ICV, MCU & Rekam Medis)

Aplikasi web terpadu untuk pencatatan rekam vaksinasi, monitoring ketersediaan vaksin, pengelolaan buku kuning internasional (*International Certificate of Vaccination* / ICV), skrining medis kehamilan pada Wanita Usia Subur (WUS), serta penerbitan laporan hasil **Medical Check Up (MCU)** di **Klinik Utama Dr. H. A. Rotinsulu Cianjur**. Dirancang untuk beroperasi di PC lokal klinik dan dapat diakses bersama oleh dokter, perawat, dan staf administrasi dalam satu jaringan LAN / Wi-Fi.

---

## Repositori GitHub Resmi

Proyek ini terhubung ke repositori GitHub:
🔗 **`https://github.com/MRegiAgustianH/sim-klinik.git`**

---

## Fitur Utama Sistem

1. **Pelayanan Vaksinasi Internasional & 22 Parameter Rekam Medis**
   - NIK (16 Digit Terstandarisasi)
   - Nama Lengkap Pasien
   - Jenis Kelamin (`Laki-laki` / `Perempuan`)
   - Tempat & Tanggal Lahir (Multi-pattern text parser & NIK extraction)
   - Email Aktif, Alamat Lengkap & Nomor WhatsApp
   - Pekerjaan & Status Pernikahan
   - Jenis Vaksin & Nomor Batch Vaksin
   - Jadwal Rencana Berkunjung (Tanggal & Jam Kunjungan)
   - Persetujuan Dokter (*Disetujui / Ditolak / Menunggu Persetujuan*) & Catatan Medis
   - Status Pelaksanaan (*Selesai / Belum*)
   - Petugas Penanggung Jawab (*Dokter, Perawat, Admin Registrasi*)
   - Sumber Informasi & Keterangan Paspor
   - Nomor Buku Kuning (No ICV)
   - Bulan Laporan (Otomatis terindeks)
   - **Skrining Tes Kehamilan pada WUS** (*Negatif / Positif / Tidak Dilakukan*) dengan peringatan dini kontraindikasi vaksin hidup (Yellow Fever / Demam Kuning).

2. **Laporan Hasil Medical Check Up (MCU) Dokter**
   - Pembuatan laporan MCU digital tanpa perlu mengetik manual di Microsoft Word.
   - **Template Cepat (1-Klik Isi Normal):** Mengisi otomatis seluruh poin dengan hasil normal sehingga dokter cukup mengubah poin yang ditemukan kelainan.
   - **Poin Pemeriksaan Terstruktur:** Tanda Vital, Antropometri & Kalkulator IMT otomatis, Pemeriksaan Fisik Lengkap, Laboratorium (Darah Lengkap, Urine Lengkap, Gula Puasa, Profil Lipid, Fungsi Hati, Faal Ginjal, HBsAg, Tes NAPZA), Rontgen Thorax, EKG, Treadmill, Audiometri, dan Spirometri.
   - **Urutan Pemeriksaan Fleksibel:** Setiap kategori maupun sub-poin dapat digeser ke atas/bawah; huruf urutan (A, B, C...) dihitung ulang otomatis di layar dan di PDF.
   - **Live Interactive Document Preview:** Pratinjau langsung 4 halaman dokumen cetak A4 dengan kop resmi `header-hasil.jpeg`.
   - **Ekspor PDF 4 Halaman Resmi:** Dilengkapi margin 3 cm, font Arial 11 pt, nomor halaman Cambria di tengah, checklist kesimpulan fit/unfit, saran medis, dan legalitas tanda tangan dokter.

3. **Registrasi Mandiri Pasien via QR Code & Google Form**
   - **QR Code Ruang Tunggu:** Pasien memindai QR Code di ruang tunggu menggunakan ponsel pintar untuk mengisi Google Form resmi klinik.
   - **Cetak Poster A4:** Poster siap cetak memuat logo klinik, QR Code resolusi tinggi, dan 4 langkah panduan pendaftaran pasien.
   - **Sinkronisasi Otomatis & Manual:** Backend menarik data baru dari Google Sheets setiap 30 detik (*Cron Job*) atau instan saat tombol *Tarik Data GForm* ditekan.
   - **Mitigasi Duplikasi Data (Idempotensi):** Pencegahan pendaftaran ganda berdasarkan NIK pada hari yang sama.
   - **Penandaan Google Sheets:** Baris data yang berhasil disinkronkan otomatis ditandai `TERSIMPAN` pada kolom `STATUS_SYNC`.

4. **Monitoring Logistik Stok Vaksin & Buku Kuning (ICV)**
   - **Master Stok Vaksin:** Pengawasan per nomor batch, produsen, tanggal kadaluarsa, stok awal, dan stok aktual.
   - **Inventaris Buku Kuning (ICV):** Pengawasan rentang nomor seri (*start-end serial*), total pengadaan, terpakai, dan sisa fisik.
   - **Pengurangan Otomatis:** Saat perawat menyelesaikan vaksinasi dan mengisi nomor ICV, stok vaksin dan buku ICV langsung terpotong secara otomatis.
   - **Log Mutasi:** Catatan audit lengkap barang masuk, keluar, dan penyesuaian (*opname*).

5. **Ekspor Laporan Profesional (Excel & PDF)**
   - **Ekspor Excel (.xlsx):** Buku kerja multi-sheet resmi dengan Kop Klinik Utama Dr. H. A. Rotinsulu Cianjur (Sheet 1: Rekap Pasien, Sheet 2: Stok Vaksin, Sheet 3: Inventaris ICV).
   - **Ekspor PDF Rekap Bulanan:** Format cetak resmi *landscape* dengan kop surat, tabel rekapitulasi, dan lembar pengesahan Kepala Pelayanan Vaksinasi.
   - **Kartu Bukti Vaksinasi Perorangan (PDF):** Dokumen sertifikat resmi per pasien lengkap dengan nomor ICV, skrining WUS, catatan dokter, dan legalitas tanda tangan dokter & perawat.

6. **Keamanan & Peran Pengguna (Role-Based Access Control)**
   - **Superadmin:** Akses penuh kelola sistem, manajemen pengguna (*user management*), hapus rekam medis, dan mutasi stok.
   - **Dokter:** Validasi telaah medis, persetujuan / penolakan vaksinasi, catatan kontraindikasi medis, pantauan skrining WUS, dan penerbitan laporan MCU.
   - **Perawat:** Registrasi pasien, tindakan vaksinasi, input nomor batch & ICV, dan input hasil tes kehamilan WUS.

---

## Akun Login Bawaan (Default Credentials)

Saat aplikasi pertama kali dijalankan, sistem otomatis melakukan *seeding* akun berikut:

| Peran (Role) | Username | Password | Deskripsi Tugas |
| :--- | :--- | :--- | :--- |
| **Superadmin** | `superadmin` | `admin123` | Akses penuh, manajemen user, hapus data, audit log |
| **Dokter** | `dokter` | `dokter123` | Pemeriksaan medis, persetujuan/penolakan, laporan hasil MCU |
| **Perawat** | `perawat` | `perawat123` | Registrasi pasien, tindakan vaksinasi, potong stok & ICV |

*(Kata sandi dapat diubah sewaktu-waktu melalui menu Profil Pengguna)*

---

## Cara Menjalankan di Komputer Server Klinik

### Prasyarat
- Komputer dengan sistem operasi **Windows 10 / 11**.
- Telah terinstall **Node.js** (versi 18 ke atas, direkomendasikan LTS).

### Langkah Menjalankan:
1. Klik ganda (*double-click*) file **`JALANKAN_APLIKASI.bat`** di folder utama aplikasi.
2. Skrip otomatis:
   - Membebaskan port 8080 dan 4000 jika ada proses lama yang macet (mencegah *EADDRINUSE*).
   - Memeriksa instalasi Node.js.
   - Mendeteksi alamat IP lokal (LAN / Wi-Fi) komputer server.
   - Menjalankan backend NestJS pada port `4000`.
   - Menjalankan frontend Next.js pada port **`8080`** (bebas bentrok dengan aplikasi kwitansi di port 3000).
   - Membuka peramban (*browser*) otomatis ke halaman login `http://localhost:8080/login`.
3. Biarkan jendela Command Prompt tetap terbuka selama aplikasi digunakan.

---

## Pemisahan Mode Production dan Development

Web production yang melayani pasien **jangan dimatikan** saat ada perubahan fitur. Mode development berjalan berdampingan di port dan database terpisah, sehingga klaim data pasien tetap aman.

| Aspek | Production (pasien) | Development (uji fitur) |
| :--- | :--- | :--- |
| Cara menjalankan | `JALANKAN_APLIKASI.bat` | `MODE_PENGEMBANGAN_DEV.bat` |
| Frontend | `http://localhost:8080` | `http://localhost:8081` |
| Backend | `4000` | `4001` |
| Database | `server/data/vaksinku.sqlite` | `server/data/vaksinku-dev.sqlite` |
| Folder build | `client/.next` | `client/.next-dev` |
| Backend dijalankan dari | `server/dist` | langsung dari `server/src` (ts-node) |
| Hot reload | Tidak | Ya (fast refresh) |

### Tahapan rilis fitur ke production

1. **Uji di mode development** — jalankan `MODE_PENGEMBANGAN_DEV.bat` (atau `node runner.js --dev`). Kalau `server/.env.local` belum ada, file itu dibuat otomatis; keberadaannya menandai backend memakai database `vaksinku-dev.sqlite`, jadi data uji tidak masuk ke database pasien. Web production di port 8080 tetap melayani.
2. **Validasi** — cek form, pratinjau cetak A4, dan unduh PDF di port 8081.
3. **Build** — buka Command Prompt baru di folder aplikasi, jalankan kedua perintah ini:
   ```bat
   cd server && npm run build && cd ..
   cd client && npm run build && cd ..
   ```
4. **Deploy** — tutup jendela production lama (CTRL + C), lalu klik ganda `JALANKAN_APLIKASI.bat`. Downtime hanya beberapa detik.
5. **Rollback** — bila versi baru bermasalah, kembalikan source ke commit sebelumnya lalu ulangi langkah 3–4.

> **Catatan:** `node runner.js` (tanpa `--dev`) akan otomatis membebaskan port 4000/8080 agar tidak ada server production ganda. Mode dev hanya membebaskan port 4001/8081, sehingga production tidak tersentuh. Database `vaksinku-dev.sqlite` sengaja tidak diberi data pasien asli — bila perlu uji dengan data mirip, input pemilik baru dari menu pasien di port 8081.

---

## Panduan Push ke GitHub

File `.gitignore` telah disiapkan untuk mengamankan data rahasia klinik:
* Kredensial Google Cloud (`google-credentials.json`) **tidak akan terunggah** ke GitHub demi keamanan kunci privat.
* Database pasien lokal SQLite (`*.sqlite`, `data/`) **tidak akan terunggah** demi privasi rekam medis pasien (*UU PDP & Rahasia Medis*).
* File build (`.next/`, `dist/`, `node_modules/`) diabaikan agar ukuran repositori tetap ringan.

### Langkah Perintah Git:
```bash
git init
git add .
git commit -m "feat: inisialisasi SIMKlinik Utama Dr. H. A. Rotinsulu Cianjur (Vaksinasi, ICV, MCU, Google Form Sync)"
git branch -M main
git remote add origin https://github.com/MRegiAgustianH/sim-klinik.git
git push -u origin main
```
