# Surat & Laporan (belum dikerjakan)

Aplikasi pembuatan surat klinik. Rancangan lengkap: [docs/arsitektur-integrasi.md](../../docs/arsitektur-integrasi.md), bagian "App surat & laporan".

- Dua jenis surat: **keluar** (berkaitan dengan pasien) dan **internal** (pengajuan, pengadaan, dll) yang dibuat dari template.
- Surat internal **tidak boleh** bergantung pada data pasien; hanya surat keluar yang menyimpan `patientId`.
- Template disimpan sebagai dokumen bertoken (`{{variabel}}`), bukan komponen kode terpisah per jenis surat.
- Kode aplikasi di layanan identitas: `surat` (sudah terdaftar di `APP_CODES`).
- Port yang dicadangkan ada di [config/ports.js](../../config/ports.js).
