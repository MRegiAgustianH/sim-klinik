# Sistem Surat

Pembuatan surat dan formulir klinik dari template, terintegrasi dengan Portal SIMKlinik. Rancangan awal: [docs/arsitektur-integrasi.md](../../docs/arsitektur-integrasi.md) bagian 6.

| Bagian | Folder | Port production | Port dev |
| :--- | :--- | :--- | :--- |
| Frontend (Next.js) | `web/` | `8084` | `8085` |
| Backend (NestJS) | `api/` | `4002` | `4003` |
| Database | `data/surat/surat.sqlite` | | `surat-dev.sqlite` |
| Gambar kop & unggahan | `data/surat/uploads/` | | `uploads-dev/` |

Dinyalakan bersama aplikasi lain oleh `JALANKAN.bat` / `MODE_PENGEMBANGAN.bat`. Untuk sistem surat saja: `node runner.js --only=surat` (atau `--dev --only=surat`).

## Cara pakai

1. Buka dari portal: kartu **Sistem Surat** > **Buka Aplikasi** (SSO, tanpa login ulang). Login langsung di `:8084` juga bisa dengan akun portal.
2. **Buat Surat** > pilih template. Ruang kerjanya dua bagian:
   - **Kiri:** formulir berisi tanggal, perihal, tujuan, pasien (surat keluar: wajib; formulir: opsional), isian template, dan penandatangan.
   - **Tengah:** editor SuratPro (bergaya Word: lembar kertas, ruler, tab stop, tabel, cetak). Isian formulir langsung tampil di surat sebagai teks berwarna. Klik teks itu untuk melompat ke isiannya. Bagian lain surat bisa diketik bebas.
3. **Simpan** (Ctrl+S) menyimpan draft. **Terbitkan** mengambil nomor otomatis (mis. `001/SKS/KU-RTS/XI/2026`) dan mengunci isi surat.
4. Surat terbit bisa **dicetak / disimpan PDF** (dialog cetak browser), **diunduh .doc**, **diduplikat**, atau **dibatalkan** dengan alasan. Nomor surat yang batal tidak dipakai ulang.
5. **Menghapus surat:** draft bisa dihapus pembuatnya (atau yang punya izin `surat.hapus`). Surat terbit tidak bisa dihapus siapa pun; batalkan dulu, lalu **hanya Superadmin** yang bisa menghapus surat berstatus Dibatalkan. Penghitung nomor tidak dimundurkan, jadi nomor surat yang dihapus tidak pernah dipakai ulang.
6. **Arsip Surat** menyaring per jenis, template, status, rentang tanggal, dan kata kunci (nomor, perihal, tujuan, nama pasien).

## Pengelolaan (izin "Kelola template")

- **Template Surat:** tambah, ubah, duplikat, nonaktifkan. Perancang template punya tab:
  - **Kop:** kop bawaan, pilih dari pustaka, kop khusus yang dirancang di editor, atau tanpa kop.
  - **Isi surat:** editor dengan palet variabel `{{...}}`.
  - **Tanda tangan:** susunan kanan, kiri, tengah, berjajar, atau dua berjajar + "mengetahui"; 0–6 penandatangan; "Kota, tanggal"; NIP/SIP.
  - **Penutup:** tembusan, catatan, dan sejenisnya.
  - **Variabel:** tipe teks, teks panjang, angka, tanggal, jam, pilihan, daftar bernomor, atau tabel; wajib/tidak; nilai bawaan; petunjuk.
  - **Halaman & nomor:** kertas A4/F4/Letter/Legal/A5, orientasi, margin, huruf, spasi, kode dan pola nomor.
  - **Pratinjau.**

  Setiap simpan membuat versi baru (menu **Riwayat** untuk memulihkan). Surat lama tidak berubah karena menyimpan salinan isinya sendiri.
- **Kop Surat:** pustaka header yang dipakai banyak template, dengan satu kop bawaan. Gambar kop disimpan sebagai file, bukan base64.
- **Penandatangan:** nama, jabatan, dan NIP/SIP yang dipilih saat membuat surat.
- **Pengaturan:** data klinik (`{{klinik_nama}}`, `{{klinik_alamat}}`, …), pola nomor umum, kode instansi, dan **penghitung nomor**. Penghitung dipakai untuk melanjutkan nomor manual di tengah tahun.

Ada 17 template bawaan. **Surat keluar (pasien):** keterangan sehat, keterangan sakit, rujukan, keterangan vaksinasi, hasil tes kehamilan, hasil MCU. **Surat internal:** pengajuan, permintaan pengadaan barang, permohonan, surat tugas, surat edaran, berita acara serah terima, undangan, nota dinas, surat keputusan. **Formulir:** Formulir Permohonan Vaksinasi pria (3 halaman: permohonan, skrining & hasil pemeriksaan, persetujuan tindakan) dan wanita (ditambah pernyataan tidak hamil), disalin dari dokumen Word klinik. Template bawaan dibuat sekali saat database masih kosong; setelah itu sepenuhnya milik Superadmin. Template yang ditambahkan belakangan (formulir vaksinasi) dibuat sekali di database yang sudah berisi, ditandai di tabel `settings` (`seed_formulir_vaksinasi`), sehingga tidak muncul lagi bila dihapus.

### Jenis dokumen

| Jenis | Data pasien | Catatan |
| :--- | :--- | :--- |
| Surat keluar | Wajib sebelum terbit | |
| Surat internal | Tidak pernah disimpan | |
| Formulir | Opsional | Isian kosong dicetak titik-titik (`data-blank`) untuk ditulis tangan. Kop dimuat di tiap halaman pada isi template (mode kop: tanpa kop). |

## Hak akses (diatur di Portal > Pengguna)

| Kode fitur | Arti |
| :--- | :--- |
| `surat.buat` | Buat & ubah draft surat |
| `surat.terbitkan` | Terbitkan surat (ambil nomor, isi dikunci) |
| `surat.batal` | Batalkan surat yang sudah terbit |
| `surat.hapus` | Hapus draft milik orang lain (draft sendiri selalu boleh dihapus) |
| `template.kelola` | Template, kop, penandatangan, pengaturan & penomoran |

Preset: Administrasi, Dokter, Pimpinan, Hanya lihat. Melihat arsip dan mencetak boleh bagi semua yang diberi akses aplikasi surat. Superadmin otomatis boleh semuanya. Katalog fitur dikirim ke layanan identitas setiap backend start (`api/src/auth/permissions.ts`).

## Variabel

| Kelompok | Variabel |
| :--- | :--- |
| Surat | `nomor_surat` (diisi saat terbit), `tanggal_surat`, `perihal`, `tujuan`, `tahun`, `tanda_tangan` (blok tanda tangan) |
| Klinik | `klinik_nama`, `klinik_nama_kapital`, `klinik_alamat`, `klinik_kota`, `klinik_telepon`, `klinik_email`, `klinik_website` |
| Pasien (surat keluar & formulir) | `nama_pasien`, `nik`, `ttl`, `tempat_lahir`, `tanggal_lahir`, `umur`, `jenis_kelamin`, `alamat_pasien`, `pekerjaan`, `no_hp`, `email_pasien`, `status_perkawinan` |
| Penandatangan | `ttd_1_nama`, `ttd_1_jabatan`, `ttd_1_id` (NIP/SIP lengkap), `ttd_1_nip`, … per urutan |
| Khusus template | didefinisikan di tab Variabel; setiap variabel tanggal `x` juga punya `x_hari` (nama hari) |

Variabel daftar dan tabel harus berada di paragraf sendiri agar dirender sebagai blok.

## Aturan data

- **Surat internal tidak pernah menyimpan data pasien.** Surat keluar (dan formulir bila pasien dipilih) menyimpan `patientId` dari layanan identitas ditambah salinan ringkas (nama, NIK, dll.) agar arsip tetap utuh bila data pasien berubah. Sistem surat tidak punya tabel pasien sendiri.
- **Nomor** diambil dalam satu transaksi saat terbit, berurutan per kode penomoran dan per tahun. Template dengan kode penomoran sama berbagi urutan.
- **Isi surat dibersihkan di server** (sanitize-html) sebelum disimpan: skrip, atribut `on*`, dan URL `javascript:` dibuang.
- Gambar di `/api/uploads/<nama-acak>` dapat diakses tanpa token, karena cetak dan file .doc tidak bisa mengirim token. Nama file acak 128-bit.

## Editor SuratPro

Salinan dari `suratpro-text-editor/` (MIT, Studio Barakah) ada di `web/public/suratpro/`. Bila editor diperbarui, salin ulang `suratpro.js`, `suratpro.css`, dan `suratpro-content.css` ke folder itu. Pembungkus React: `web/src/components/SuratProEditor.tsx`. Penyusunan surat (kop + isi + tanda tangan + penutup, lalu penanda `data-var`) ada di `web/src/lib/compose.ts`.
