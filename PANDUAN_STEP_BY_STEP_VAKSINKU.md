# PANDUAN LENGKAP & STEP-BY-STEP OPERASIONAL VAKSINKU
## KLINIK UTAMA DR. H. A. ROTINSULU CIANJUR
### Sistem Informasi Laporan Vaksinasi, Skrining WUS, Logistik Buku ICV & Registrasi Mandiri QR Code

---

## DAFTAR ISI

1. [Gambaran Umum Sistem](#1-gambaran-umum-sistem)
2. [Langkah 1: Menjalankan Aplikasi di Komputer Server Lokal](#2-langkah-1-menjalankan-aplikasi-di-komputer-server-lokal)
3. [Langkah 2: Menghubungkan Tablet / Komputer Lain dalam Satu Jaringan (LAN / Wi-Fi)](#3-langkah-2-menghubungkan-tablet--komputer-lain-dalam-satu-jaringan-lan--wi-fi)
4. [Langkah 3: Akun Login & Hak Akses Staf Klinik](#4-langkah-3-akun-login--hak-akses-staf-klinik)
5. [Langkah 4: Setup Fitur Registrasi Mandiri Pasien via QR Code & Google Form](#5-langkah-4-setup-fitur-registrasi-mandiri-pasien-via-qr-code--google-form)
6. [Langkah 5: Alur Kerja Harian Pelayanan Vaksinasi](#6-langkah-5-alur-kerja-harian-pelayanan-vaksinasi)
   - [5.1. Pendaftaran Pasien (Mandiri via QR / Input Manual Loket)](#51-pendaftaran-pasien-mandiri-via-qr--input-manual-loket)
   - [5.2. Pemeriksaan & Persetujuan Medis oleh Dokter](#52-pemeriksaan--persetujuan-medis-oleh-dokter)
   - [5.3. Tindakan Vaksinasi oleh Perawat & Pemotongan Stok Otomatis](#53-tindakan-vaksinasi-oleh-perawat--pemotongan-stok-otomatis)
   - [5.4. Penerbitan Sertifikat / Kartu Bukti Vaksinasi Pasien (PDF)](#54-penerbitan-sertifikat--kartu-bukti-vaksinasi-pasien-pdf)
7. [Langkah 6: Pengelolaan Logistik Stok Vaksin & Buku Kuning (ICV)](#7-langkah-6-pengelolaan-logistik-stok-vaksin--buku-kuning-icv)
8. [Langkah 7: Ekspor Laporan Bulanan Profesional (Excel & PDF)](#8-langkah-7-ekspor-laporan-bulanan-profesional-excel--pdf)
9. [Langkah 8: Manajemen Pengguna & Ganti Password](#9-langkah-8-manajemen-pengguna--ganti-password)
10. [Panduan Pemecahan Masalah (Troubleshooting)](#10-panduan-pemecahan-masalah-troubleshooting)

---

## 1. GAMBARAN UMUM SISTEM

Aplikasi **VaksinKU** dirancang khusus untuk operasional **Klinik Utama Dr. H. A. Rotinsulu Cianjur** guna mengelola pencatatan rekam vaksinasi umrah/haji/perjalanan internasional, inventaris buku kuning ICV (*International Certificate of Vaccination*), skrining medis kehamilan pada Wanita Usia Subur (WUS), serta pencatatan logistik vaksin.

### Spesifikasi Teknis:
* **Frontend:** Next.js 14 (Port **`8080`** — *bebas bentrok dengan aplikasi kwitansi di port 3000*).
* **Backend:** NestJS 10 (Port **`4000`** via internal reverse proxy).
* **Database:** SQLite Lokal (`data/vaksinku.sqlite`) — ringan, tanpa perlu instalasi database server eksternal, dan mudah dibackup.
* **Format Ekspor:** Microsoft Excel (`.xlsx`) multi-sheet resmi & Dokumen PDF (`.pdf`) berkop klinik resmi.

---

## 2. LANGKAH 1: MENJALANKAN APLIKASI DI KOMPUTER SERVER LOKAL

### Prasyarat:
1. Komputer bersistem operasi **Windows 10 atau Windows 11**.
2. Telah terpasang **Node.js** (Versi 18 ke atas). Anda dapat memeriksa instalasi dengan membuka CMD dan mengetik:
   ```cmd
   node -v
   ```

### Cara Menjalankan (1 Langkah Saja):
1. Buka folder proyek **`VaksinKU`**.
2. Klik ganda (*double-click*) file:
   ```text
   JALANKAN_VAKSINKU.bat
   ```
3. Jendela hitam (*Command Prompt*) akan muncul dan melakukan tahapan berikut secara otomatis:
   * Membersihkan port 8080 & 4000 jika ada proses lama yang macet (mencegah *EADDRINUSE*).
   * Mendeteksi alamat IP jaringan lokal komputer Anda.
   * Menjalankan Backend NestJS pada port 4000.
   * Menjalankan Frontend Web pada port 8080.
   * Otomatis meluncurkan peramban (*browser*) ke alamat:
     ```text
     http://localhost:8080/login
     ```
4. **PENTING:** Biarkan jendela hitam tersebut tetap terbuka di latar belakang (*background*) selama aplikasi digunakan.

---

## 3. LANGKAH 2: MENGHUBUNGKAN TABLET / KOMPUTER LAIN DALAM SATU JARINGAN (LAN / WI-FI)

Dokter di ruang periksa atau perawat di ruang tindakan dapat menggunakan laptop/tablet/iPad tanpa harus duduk di depan komputer server.

### Langkah-langkah:
1. Pastikan komputer server dan perangkat staf lainnya terhubung ke **jaringan Wi-Fi atau kabel LAN yang sama** di Klinik Utama Dr. H. A. Rotinsulu Cianjur.
2. Lihat alamat IP yang tertera pada jendela hitam komputer server saat menjalankan file `.bat`, contoh:
   ```text
   Akses dari Komputer/Tablet Lain dalam SATU JARINGAN (LAN / Wi-Fi):
     -> http://192.168.1.15:8080
   ```
3. Buka peramban (Google Chrome / Microsoft Edge / Safari) di tablet atau laptop lain tersebut.
4. Ketikkan alamat tersebut di address bar:
   ```text
   http://192.168.1.15:8080
   ```
   *(Ganti 192.168.1.15 dengan IP riil yang muncul di layar komputer server Anda).*
5. Halaman login VaksinKU akan langsung terbuka.

---

## 4. LANGKAH 3: AKUN LOGIN & HAK AKSES STAF KLINIK

Sistem menerapkan pembagian kewenangan (*Role-Based Access Control*):

| Peran (Role) | Username | Password Default | Hak Akses & Tanggung Jawab |
| :--- | :--- | :--- | :--- |
| **Superadmin** | `superadmin` | `admin123` | Akses penuh, manajemen pengguna, hapus data, mutasi stok, konfigurasi Google Sheets, ekspor laporan |
| **Dokter** | `dokter` | `dokter123` | Telaah klinis, persetujuan/penolakan kelayakan vaksinasi, evaluasi hasil tes kehamilan WUS, catatan rekam medis |
| **Perawat** | `perawat` | `perawat123` | Registrasi pasien, tindakan penyuntikan vaksinasi, input batch vaksin, input nomor buku ICV, skrining awal tes WUS |

> **Catatan Keamanan:** Segera ubah kata sandi default setelah login pertama kali melalui menu **Profil Pengguna**.

---

## 5. LANGKAH 4: SETUP FITUR REGISTRASI MANDIRI PASIEN VIA QR CODE & GOOGLE FORM

Fitur ini memungkinkan pasien mengisi data pendaftaran melalui ponsel pintar (*smartphone*) masing-masing saat menunggu di ruang tunggu, kemudian data secara otomatis ditarik ke aplikasi VaksinKU.

```
[Ruang Tunggu Pasien]
    |-- Scan Poster QR Code menggunakan Kamera HP
    |-- Mengisi Formulir Pendaftaran Google Form
    v
[Cloud Google Sheets]
    |-- Data tersimpan di baris Google Sheets
    v
[Aplikasi VaksinKU Lokal]
    |-- Ditarik otomatis setiap 30 detik (Cron Job) ATAU
    |-- Ditarik instan saat Perawat klik "Tarik Data GForm"
    |-- Pengecekan Idempotensi (Mencegah Duplikasi NIK)
    |-- Baris Google Sheets otomatis ditandai "TERSIMPAN"
```

### Tahap 4.1: Menyiapkan Google Form
1. Buka [Google Forms](https://forms.google.com/) dan buat formulir baru berjudul:
   `Pendaftaran Vaksinasi - Klinik Utama Dr. H. A. Rotinsulu Cianjur`
2. Buat pertanyaan minimal berikut:
   * **NIK** (Jawaban singkat, validasi angka 16 digit).
   * **Nama Lengkap** (Jawaban singkat).
   * **Jenis Kelamin** (Pilihan ganda: `Laki-laki` / `Perempuan`).
   * **No. WhatsApp / HP** (Jawaban singkat).
   * **Jenis Vaksin** (Pilihan ganda: *Meningitis ACYW-135, Yellow Fever, Polio, Influenza, Hepatitis B, HPV, dll*).
   * **Alamat Lengkap** (Paragraf).
3. Klik tombol **Kirim** pada Google Form, pilih tab tautan (*link*), centang **Perpendek URL**, lalu salin tautan tersebut (Contoh: `https://forms.gle/rotinsulu-cianjur`).

### Tahap 4.2: Menghubungkan ke Google Sheets
1. Pada Google Form Anda, buka tab **Responses (Jawaban)**.
2. Klik ikon hijau **Link to Sheets (Hubungkan ke Spreadsheet)**.
3. Buat spreadsheet baru. Setelah spreadsheet terbuka di browser, perhatikan kolom-kolomnya:
   * Kolom A: *Timestamp*
   * Kolom B: *NIK*
   * Kolom C: *Nama Lengkap*
   * Kolom D: *Jenis Kelamin*
   * Kolom E: *No. WhatsApp*
   * Kolom F: *Jenis Vaksin*
4. Pada baris pertama kolom kosong berikutnya (misal kolom **G1** atau **F1**), ketikkan teks header:
   ```text
   STATUS_SYNC
   ```
   *(Kolom ini akan digunakan sistem VaksinKU untuk menandai data yang sudah berhasil masuk).*
5. Salin **Spreadsheet ID** dari bilah alamat browser Anda.
   Contoh URL:
   `https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit`
   Maka Spreadsheet ID-nya adalah:
   `1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms`

### Tahap 4.3: Menghubungkan Google Sheets ke VaksinKU (Solusi Policy Organisasi GCP)

> **MENGAPA MUNCUL ERROR?**
> Jika Anda menggunakan akun Google Workspace (email instansi/rumah sakit/universitas), Google secara otomatis memberlakukan aturan keamanan organisasi (*Organization Policy*): `constraints/iam.disableServiceAccountKeyCreation` yang memblokir pembuatan file JSON key pada Service Account.

Terdapat **2 Solusi** yang dapat Anda pilih:

---

#### PILIHAN A (SANGAT DIREKOMENDASIKAN): Menggunakan Google Apps Script Web App
*Metode ini **100% melewati batasan GCP**, tanpa perlu Google Cloud Console, tanpa perlu kartu kredit, tanpa Service Account, dan dapat berjalan di semua jenis akun Google.*

1. Buka file Google Sheets hasil pendaftaran Google Form Anda di browser.
2. Klik menu **Ekstensi (Extensions) > Apps Script**.
3. Hapus seluruh kode bawaan yang ada di editor, lalu salin dan tempelkan kode berikut:
   ```javascript
   function doGet(e) {
     var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
     var data = sheet.getDataRange().getValues();
     return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
   }

   function doPost(e) {
     try {
       var params = JSON.parse(e.postData.contents);
       var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
       sheet.getRange(params.row, params.col).setValue(params.value);
       return ContentService.createTextOutput(JSON.stringify({ status: "success" })).setMimeType(ContentService.MimeType.JSON);
     } catch(err) {
       return ContentService.createTextOutput(JSON.stringify({ error: err.toString() })).setMimeType(ContentService.MimeType.JSON);
     }
   }
   ```
4. Klik tombol **Deploy (Terapkan)** di pojok kanan atas, lalu pilih **New deployment (Penerapan baru)**.
5. Klik ikon roda gigi di samping *Select type*, lalu pilih **Web app (Aplikasi web)**.
6. Atur konfigurasi berikut:
   * **Description:** `VaksinKU Sync`
   * **Execute as (Jalankan sebagai):** `Me (email Anda)`
   * **Who has access (Siapa yang memiliki akses):** **`Anyone (Siapa saja)`** *(Penting: pilih Anyone agar server lokal klinik dapat mengambil data)*.
7. Klik tombol **Deploy**.
8. Jika muncul jendela otorisasi izin akun Google (*Authorization required*):
   * Klik **Authorize access**.
   * Pilih akun Google Anda.
   * Klik tombol kecil **Advanced (Lanjutan)** di kiri bawah -> Klik **Go to Untitled project (unsafe)** -> Klik **Allow (Izinkan)**.
9. Salin tautan **Web App URL** yang muncul (tautan berawalan `https://script.google.com/macros/s/.../exec`).
10. Masuk ke aplikasi VaksinKU di browser (`http://localhost:8080`), klik ikon roda gigi **Pengaturan** pada panel pendaftaran, lalu tempelkan URL Web App tersebut ke kolom **Spreadsheet ID ATAU URL Google Apps Script Web App**.
11. Selesai! Data langsung tersinkronisasi otomatis tanpa membutuhkan file JSON sama sekali.

---

#### PILIHAN B: Mematikan Organization Policy di Google Cloud Console
*Gunakan opsi ini jika Anda adalah Administrator Google Workspace / GCP Organization atau ingin tetap menggunakan Service Account JSON:*

1. Buka [Google Cloud Console](https://console.cloud.google.com/).
2. Pada bilah pencarian paling atas, ketik: **Organization Policies** (Kebijakan Organisasi).
3. Cari kebijakan bernama:
   `constraints/iam.disableServiceAccountKeyCreation` (*Disable service account key creation*).
4. Klik pada kebijakan tersebut, lalu klik **Manage Policy** (Kelola Kebijakan) atau **Edit**.
5. Pada bagian aturan (*Rules*):
   * Pilih **Override parent policy** (Ganti kebijakan induk).
   * Pada bagian penegakan (*Enforcement*), pilih **Off** (Nonaktif).
6. Klik **Set Policy** / **Save** untuk menyimpan perubahan.
7. Sekarang kembali ke menu **Credentials > Service Accounts > Keys > Add Key > Create new key (JSON)**. Pembuatan file JSON akan berhasil tanpa terblokir.
8. Ganti nama file JSON menjadi `google-credentials.json` dan letakkan di folder utama `VaksinKU/`.
### Tahap 4.4: Konfigurasi di Aplikasi VaksinKU
1. Buka aplikasi VaksinKU di browser (`http://localhost:8080`).
2. Masuk sebagai **Superadmin**.
3. Buka menu **Data Pasien & Vaksinasi**.
4. Pada panel atas *Registrasi Mandiri Pasien*, klik ikon roda gigi **Pengaturan**.
5. Isi konfigurasi:
   * **Link Google Form Pasien:** Tempel link Google Form yang disalin pada Tahap 4.1.
   * **Google Sheets Spreadsheet ID:** Tempel ID yang disalin pada Tahap 4.2.
   * **Nama Tab Sheet:** `Form Responses 1` (sesuai nama tab di spreadsheet).
   * **Centang:** *Aktifkan penarikan berkala otomatis setiap 30 detik*.
6. Klik **Simpan Pengaturan**. Status koneksi akan otomatis berubah menjadi *Siap*.

### Tahap 4.5: Mencetak Poster QR Code untuk Ruang Tunggu
1. Pada panel *Registrasi Mandiri Pasien*, klik tombol **Cetak Poster Ruang Tunggu**.
2. Jendela pratinjau poster akan muncul menampilkan logo klinik, judul resmi, QR Code beresolusi tinggi, dan 4 langkah panduan pasien.
3. Klik tombol **Cetak Poster** untuk mencetak ke printer klinik (ukuran kertas A4) dan tempelkan di loket atau dinding ruang tunggu pasien.

---

## 6. LANGKAH 5: ALUR KERJA HARIAN PELAYANAN VAKSINASI

```
+---------------------------------------------------------------------------------+
| 1. PENDAFTARAN                                                                  |
|    - Pasien scan QR Code -> Mengisi GForm -> Masuk otomatis ke sistem           |
|    - ATAU Perawat klik "Registrasi Pasien Baru" untuk input manual              |
+---------------------------------------------------------------------------------+
                                         |
                                         v
+---------------------------------------------------------------------------------+
| 2. SKRINING AWAL & PEMERIKSAAN DOKTER                                           |
|    - Khusus WUS (Perempuan 15-49 thn): Lakukan tes kehamilan (Hasil: +/-)       |
|    - Dokter membuka data pasien -> Klik tombol "Validasi & Telaah Dokter"       |
|    - Jika WUS Positif (Hamil) & Vaksin Hidup (Yellow Fever): Sistem memberi     |
|      peringatan tegas kontraindikasi -> Dokter memutuskan Setuju/Tolak         |
|    - Dokter menuliskan catatan medis -> Simpan Keputusan                        |
+---------------------------------------------------------------------------------+
                                         |
                                         v
+---------------------------------------------------------------------------------+
| 3. TINDAKAN PENYUNTIKAN OLEH PERAWAT                                            |
|    - Pasien yang disetujui dokter dipanggil ke ruang tindakan                   |
|    - Perawat klik tombol "Tindakan Vaksinasi & Potong Stok" (Ikon Jarum Suntik) |
|    - Pilih nomor batch vaksin yang disuntikkan                                  |
|    - Masukkan nomor seri Buku Kuning (No ICV)                                   |
|    - Klik "Selesaikan Vaksinasi"                                               |
|    - SISTEM OTOMATIS:                                                           |
|      * Status pasien berubah menjadi "Selesai"                                  |
|      * Stok fisik vaksin terpotong 1 dosis                                       |
|      * Stok buku kuning ICV terpotong 1 buku                                    |
|      * Riwayat mutasi logistik tercatat lengkap                                 |
+---------------------------------------------------------------------------------+
                                         |
                                         v
+---------------------------------------------------------------------------------+
| 4. PENERBITAN KARTU BUKTI VAKSINASI (PDF)                                       |
|    - Perawat/Admin klik tombol "Unduh PDF" pada baris pasien                    |
|    - Dokumen resmi berkop klinik langsung terbuka siap cetak                    |
|    - Dokter dan Perawat menandatangani dokumen fisik                            |
|    - Serahkan buku kuning ICV & kartu vaksinasi kepada pasien                   |
+---------------------------------------------------------------------------------+
```

### 5.1. Pendaftaran Pasien (Mandiri via QR / Input Manual Loket)
* **Pasien Mandiri:** Pasien mengisi formulir di HP -> Data otomatis ditarik dalam 30 detik atau perawat dapat langsung menekan tombol **"Tarik Data GForm"** untuk pembaruan instan.
* **Input Manual Loket:** Jika ada pasien lansia/non-smartphone, perawat klik tombol **"Registrasi Pasien Baru"**, isi 22 parameter data, lalu klik **Simpan Data Pasien**.

### 5.2. Pemeriksaan & Persetujuan Medis oleh Dokter
1. Login sebagai **Dokter** (`dokter`).
2. Masuk ke menu **Data Pasien & Vaksinasi** atau pantau dari **Dashboard**.
3. Klik tombol centang biru (**Validasi & Telaah Dokter**) pada baris pasien.
4. Periksa kondisi tanda vital, riwayat alergi, dan **Hasil Tes Kehamilan WUS**.
   > **Penting untuk Dokter:** Apabila pasien berstatus WUS Hamil (Tes Positif) dan memilih vaksin virus hidup (*Yellow Fever* / Demam Kuning), sistem akan menampilkan kotak peringatan merah. Dokter wajib memasukkan telaah pertimbangan medis sebelum memberikan keputusan.
5. Pilih **Disetujui** atau **Ditolak**, tulis catatan telaah, lalu klik **Simpan Keputusan Dokter**.

### 5.3. Tindakan Vaksinasi oleh Perawat & Pemotongan Stok Otomatis
1. Login sebagai **Perawat** (`perawat`).
2. Cari nama pasien yang status persetujuan dokternya telah **Disetujui**.
3. Klik tombol hijau berikon suntikan (**Tindakan Vaksinasi & Potong Stok**).
4. Pilih **Nomor Batch Vaksin** yang akan digunakan (misal: `MEN-2026-X1`).
5. Masukkan **Nomor Buku Kuning (No ICV)** yang akan diberikan kepada pasien (misal: `ICV-ID-2026-0015`).
6. Masukkan catatan tindakan (lokasi injeksi deltoid, tidak ada KIPI, dll).
7. Klik **Selesaikan Vaksinasi**.
8. Sistem secara otomatis:
   * Mengubah status pasien menjadi **Selesai**.
   * Memotong stok vaksin terkait sebanyak 1 dosis.
   * Memotong stok buku kuning ICV sebanyak 1 buku.
   * Mencatat mutasi keluar pada log audit logistik.

### 5.4. Penerbitan Sertifikat / Kartu Bukti Vaksinasi Pasien (PDF)
1. Klik tombol berikon unduh dokumen (**Unduh / Cetak Kartu Bukti Vaksinasi**) pada baris pasien.
2. Peramban akan membuka file PDF resmi yang memuat:
   * Kop surat resmi **Klinik Utama Dr. H. A. Rotinsulu Cianjur**.
   * Identitas lengkap pasien (NIK, Nama, Tempat Tanggal Lahir, Alamat, No. HP).
   * Rekam tindakan vaksinasi (Nama Vaksin, Nomor Batch, Nomor ICV, Hasil Skrining WUS).
   * Catatan kelayakan medis dokter.
   * Kolom tanda tangan resmi Dokter Penanggung Jawab dan Perawat Pelaksana beserta nomor SIP/SIKP.
3. Cetak dokumen tersebut dengan menekan `Ctrl + P`.

---

## 7. LANGKAH 6: PENGELOLAAN LOGISTIK STOK VAKSIN & BUKU KUNING (ICV)

Buka menu **Stok Vaksin & Buku ICV** (`/stock`). Halaman ini terdiri dari 3 tab:

### 1. Tab Master Stok Vaksin:
* Menampilkan seluruh jenis vaksin, produsen, nomor batch, stok awal, stok saat ini, satuan, tanggal kadaluarsa, dan status (*Tersedia*, *Menipis*, *Habis*, *Kadaluarsa*).
* **Menambah Stok Baru:** Klik **Tambah Stok Vaksin**, isi nama vaksin, produsen, no. batch unik, jumlah stok awal, tanggal kadaluarsa, dan batas minimal alert (default 10 dosis).

### 2. Tab Inventaris Buku Kuning (ICV):
* Menampilkan total pengadaan buku ICV, jumlah yang telah diterbitkan ke pasien, dan sisa stok fisik buku.
* **Mencatat Penerimaan Buku Baru:** Klik **Penerimaan Buku ICV**, masukkan kode batch penerimaan (contoh: `ICV-BATCH-2026-02`), nomor seri awal (contoh: `ICV-ID-2026-0501`), nomor seri akhir (contoh: `ICV-ID-2026-1000`), dan jumlah buku diterima.

### 3. Tab Riwayat Mutasi Stok:
* Menampilkan catatan audit riwayat keluar-masuk barang secara real-time.
* **Penyesuaian Manual:** Klik **Catat Mutasi Manual** jika terdapat vial vaksin yang pecah, rusak, atau penyesuaian saat *stok opname* bulanan.

---

## 8. LANGKAH 7: EKSPOR LAPORAN BULANAN PROFESIONAL (EXCEL & PDF)

Buka menu **Laporan & Export** (`/reports`):

1. **Pilih Periode Bulan:** Tentukan bulan laporan yang ingin diekspor pada pemilih tanggal (contoh: `2026-11`).
2. **Ekspor Microsoft Excel (`.xlsx`):**
   * Klik tombol hijau **Unduh Excel (.xlsx)**.
   * File `Laporan_Vaksinasi_Rotinsulu_[Bulan].xlsx` akan terunduh.
   * Berkas ini terdiri dari 3 Sheet resmi:
     * **Sheet 1:** Laporan 24 Kolom Rekam Pasien Vaksinasi Lengkap.
     * **Sheet 2:** Laporan Monitoring Stok Vaksin, Batch & Masa Kadaluarsa.
     * **Sheet 3:** Laporan Inventaris Penggunaan Buku Kuning ICV.
3. **Ekspor Dokumen PDF Rekapitulasi Resmi (`.pdf`):**
   * Klik tombol biru **Unduh PDF Rekapitulasi**.
   * File `Rekap_Vaksinasi_Rotinsulu_[Bulan].pdf` akan terunduh dalam format *landscape* resmi siap cetak, memuat ringkasan demografi, tabel pasien bulanan, dan kolom tanda tangan Kepala Pelayanan Vaksinasi Klinik Utama Dr. H. A. Rotinsulu Cianjur.

---

## 9. LANGKAH 8: MANAJEMEN PENGGUNA & GANTI PASSWORD

### Menambah Pengguna Baru (Khusus Superadmin):
1. Masuk ke menu **Kelola Pengguna** (`/users`).
2. Klik tombol **Tambah Pengguna Baru**.
3. Masukkan username (huruf kecil tanpa spasi), nama lengkap beserta gelar (contoh: `dr. Budi Santoso, Sp.A`), peran (*Dokter* / *Perawat* / *Superadmin*), dan kata sandi minimal 6 karakter.
4. Klik **Daftarkan Pengguna**.

### Mengubah Kata Sandi Pribadi:
1. Klik menu **Profil** di sidebar atau navigasi atas.
2. Masukkan kata sandi lama Anda.
3. Masukkan kata sandi baru dan ulangi konfirmasi kata sandi baru.
4. Klik **Simpan Password Baru**.

---

## 10. PANDUAN PEMECAHAN MASALAH (TROUBLESHOOTING)

### 1. Muncul pesan "Failed to fetch" saat login:
* **Penyebab:** Backend service port 4000 belum siap atau prosesnya terhenti.
* **Solusi:** Tutup semua jendela CMD aplikasi, lalu klik ganda kembali file `JALANKAN_VAKSINKU.bat`. Tunggu hingga jendela browser terbuka secara otomatis.

### 2. Error "EADDRINUSE: address already in use":
* **Penyebab:** Ada aplikasi lain atau instans VaksinKU sebelumnya yang masih berjalan di latar belakang.
* **Solusi:** File `JALANKAN_VAKSINKU.bat` yang baru sudah dilengkapi pembersih port otomatis. Tutup jendela CMD lama, lalu jalankan kembali `JALANKAN_VAKSINKU.bat`.

### 3. Komputer lain di jaringan LAN tidak bisa membuka web:
* **Penyebab:** Perangkat tidak berada dalam satu jaringan Wi-Fi/LAN yang sama, atau firewall Windows di komputer server memblokir akses masuk.
* **Solusi:**
  1. Pastikan kedua perangkat terhubung ke Wi-Fi yang sama di klinik.
  2. Buka **Windows Defender Firewall** di komputer server -> pilih *Allow an app or feature through Windows Defender Firewall* -> izinkan **Node.js** pada jaringan *Private*.
  3. Pastikan alamat IP yang dimasukkan di laptop lain sesuai dengan yang ditampilkan di jendela terminal server (contoh: `http://192.168.1.15:8080`).

### 4. Tombol "Tarik Data GForm" menampilkan "Kredensial belum ditemukan":
* **Penyebab:** File `google-credentials.json` belum diletakkan di folder aplikasi.
* **Solusi:** Ikuti panduan pada **Langkah 4 (Tahap 4.3)** di atas, pastikan file JSON hasil unduhan dari Google Cloud Console telah di-rename menjadi `google-credentials.json` dan diletakkan di root folder `VaksinKU/`.

### 5. Cara mematikan aplikasi dengan benar:
* Cukup klik pada jendela hitam *Command Prompt*, lalu tekan kombinasi tombol **`Ctrl + C`**, kemudian ketik `Y` jika diminta konfirmasi, atau cukup tutup (*close*) jendela Command Prompt tersebut. Kedua service (frontend dan backend) akan otomatis berhenti bersih.

---
*Dokumen panduan ini disusun resmi untuk operasional sistem informasi VaksinKU pada Klinik Utama Dr. H. A. Rotinsulu Cianjur.*
