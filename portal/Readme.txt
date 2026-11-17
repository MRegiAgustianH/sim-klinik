Integrasi SIM-Klinik
====================

Rancangan ada di README.md bagian 5. Urutan pengerjaan:

  1. identity-service  (port 4010)  -- SELESAI, sudah dijalankan & dikompilasi
  2. portal-dashboard  (port 8082)  -- SELESAI (login, beranda, pasien,
                                       pengguna, aplikasi, profil, SSO)
  3. impor pasien lama per NIK      -- skrip siap, jalankan saat klinik sepi
  4. migrasi patientId di SIMKlinik -- BELUM (uji di mode dev lebih dulu)
  5. surat & laporan                -- BELUM

Mulai dari sini
---------------
  JALANKAN_PORTAL.bat            portal + SIMKlinik (production)
  MODE_PENGEMBANGAN_PORTAL.bat   portal + SIMKlinik (development)

  Panduan lengkap: README.md di folder ini.

identity-service/
  - Layanan identitas: pengguna, pasien, daftar app, akses per app,
    penerbit token. Satu sumber data untuk semua aplikasi klinik.
  - Panduan: identity-service/README.md

portal-dashboard/
  - Halaman login, beranda kartu aplikasi, data pasien (data induk),
    pengguna & hak akses, profil, serta penukaran token SSO.
  - Service key portal disimpan di identity-service/data/service-keys/
    dan dibuat otomatis oleh runner.js saat pertama dijalankan.

SSO
---
  Portal -> SIMKlinik memakai halaman /sso di client/ dan route
  /api/sso/redeem. Token tidak pernah ditaruh di URL; yang berpindah
  adalah tiket sekali pakai berumur 60 detik.

sistem_surat_dan_laporan/  (belum dikerjakan)
  - Dua jenis surat: keluar (berkaitan dengan pasien) dan internal
    (pengajuan, pengadaan, dll) yang dibuat dari template.
  - Surat internal TIDAK boleh bergantung pada data pasien; hanya surat
    keluar yang menyimpan patientId.
  - Template disimpan sebagai editor dokumen, bukan HTML terpisah per surat.
