# Dokumentasi Pembaruan Sistem: Registrasi Mandiri Pasien via QR Code & Google Form

Dokumen ini berisi panduan implementasi untuk pembaruan fitur registrasi pasien pada aplikasi **Laporan Vaksinasi Rumah Sakit** (Tech Stack: **NestJS** & **Next.js** pada jaringan LAN lokal).

---

## 1. Gambaran Arsitektur (Metode *Pull / Polling*)

Karena server aplikasi berjalan di jaringan lokal (LAN) namun memiliki koneksi *outbound* ke internet, integrasi dilakukan menggunakan metode **Pull (Penarikan Berkala)** melalui **Google Sheets API**:

1. **Pasien** melakukan *scan* QR Code di ruang tunggu menggunakan koneksi internet HP masing-masing dan mengisi **Google Form**.
2. Data respons otomatis tersimpan di **Google Sheets** (*cloud*).
3. **Server Lokal (NestJS)** menarik data baru dari Google Sheets secara otomatis setiap 30 detik (*Cron Job*) atau saat perawat menekan tombol sinkronisasi manual di **Next.js**.
4. Data yang berhasil masuk ke database lokal akan ditandai sebagai `TERSIMPAN` pada kolom khusus di Google Sheets agar tidak terjadi duplikasi penarikan.

---

## 2. Persiapan Google Form, Sheets, & Cloud Service Account

### A. Konfigurasi Google Form & Google Sheets
1. Buat Google Form dengan pertanyaan yang sesuai dengan kebutuhan tabel pasien (Contoh: **NIK**, **Nama Lengkap**, **No. HP**, **Jenis Vaksin**).
2. Buka tab **Responses** pada Google Form, lalu klik **Link to Sheets** untuk membuat *spreadsheet* tujuan.
3. Buka Google Sheets yang terhubung. Pada kolom kosong pertama setelah kolom pertanyaan terakhir (misal: **Kolom F**), tambahkan header `STATUS_SYNC` di baris pertama (`F1`).
4. Salin **Spreadsheet ID** dari URL Google Sheets Anda (string acak di antara `/d/` dan `/edit`).

### B. Pembuatan Kredensial Service Account
1. Buka [Google Cloud Console](https://console.cloud.google.com/) dan buat *Project* baru.
2. Masuk ke **APIs & Services > Library**, cari **Google Sheets API**, lalu klik **Enable**.
3. Masuk ke **APIs & Services > Credentials > Create Credentials > Service Account**.
4. Isi nama *Service Account* (misal: `vaksin-sync-bot`), lalu klik **Done**.
5. Klik email *Service Account* yang baru dibuat, buka tab **Keys > Add Key > Create new key**, pilih format **JSON**, lalu unduh file tersebut.
6. Ubah nama file JSON menjadi `google-credentials.json` dan letakkan di *root folder* proyek **NestJS** Anda.
   > **Penting:** Tambahkan `google-credentials.json` ke dalam file `.gitignore` agar kredensial tidak terunggah ke repositori publik.
7. Buka file `google-credentials.json`, salin alamat email pada properti `"client_email"`, lalu bagikan (*Share*) file Google Sheets Anda ke alamat email tersebut dengan hak akses **Editor**.

---

## 3. Implementasi Backend (NestJS)

### A. Instalasi Package
Jalankan perintah berikut di direktori proyek NestJS:
```bash
npm install googleapis @nestjs/schedule
```

### B. Registrasi Modul (`src/app.module.ts`)
Daftarkan `ScheduleModule`, *controller*, dan *service* sinkronisasi pada modul utama atau modul pasien:

```typescript
import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { GformSyncService } from './gform-sync.service';
import { GformSyncController } from './gform-sync.controller';

@Module({
  imports: [ScheduleModule.forRoot()],
  controllers: [GformSyncController],
  providers: [GformSyncService],
})
export class AppModule {}
```

### C. Pembuatan Controller (`src/gform-sync.controller.ts`)
*Endpoint* ini digunakan oleh perawat/dokter untuk memicu penarikan data secara manual dari antarmuka Next.js:

```typescript
import { Controller, Post } from '@nestjs/common';
import { GformSyncService } from './gform-sync.service';

@Controller('patients/sync')
export class GformSyncController {
  constructor(private readonly syncService: GformSyncService) {}

  @Post()
  async manualSync() {
    const addedCount = await this.syncService.syncPatientsFromSheet();
    return {
      message: 'Sinkronisasi selesai',
      newPatientsAdded: addedCount,
    };
  }
}
```

### D. Pembuatan Service (`src/gform-sync.service.ts`)
Service ini menangani penarikan data otomatis setiap 30 detik dan memperbarui status baris di Google Sheets:

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { google } from 'googleapis';
import * as path from 'path';

@Injectable()
export class GformSyncService {
  private readonly logger = new Logger(GformSyncService.name);
  private sheets;
  private isSyncing = false;
  private spreadsheetId = 'ISI_DENGAN_ID_SPREADSHEET_ANDA';

  constructor() {
    const auth = new google.auth.GoogleAuth({
      keyFile: path.join(process.cwd(), 'google-credentials.json'),
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    this.sheets = google.sheets({ version: 'v4', auth });
  }

  @Cron(CronExpression.EVERY_30_SECONDS)
  async handleCron() {
    await this.syncPatientsFromSheet();
  }

  async syncPatientsFromSheet(): Promise<number> {
    if (this.isSyncing) return 0;
    this.isSyncing = true;
    let addedCount = 0;

    try {
      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        // Asumsi: A=Timestamp, B=NIK, C=Nama, D=NoHP, E=JenisVaksin, F=STATUS_SYNC
        range: 'Form Responses 1!A2:F',
      });

      const rows = response.data.values;
      if (!rows || rows.length === 0) return 0;

      for (let i = 0; i < rows.length; i++) {
        const [timestamp, nik, nama, noHp, jenisVaksin, statusSync] = rows[i];

        if (statusSync !== 'TERSIMPAN' && nik && nama) {
          // TODO: Tambahkan validasi cek duplikasi NIK pada hari yang sama sebelum menyimpan
          // Contoh simpan ke Database Lokal (Prisma / TypeORM):
          // await this.patientRepository.save({ nik, nama, noHp, jenisVaksin });

          // Tandai baris di Google Sheets menjadi 'TERSIMPAN'
          const rowNumber = i + 2;
          await this.sheets.spreadsheets.values.update({
            spreadsheetId: this.spreadsheetId,
            range: `Form Responses 1!F${rowNumber}`,
            valueInputOption: 'USER_ENTERED',
            requestBody: { values: [['TERSIMPAN']] },
          });

          addedCount++;
          this.logger.log(`Pasien baru berhasil disinkronisasi: ${nama} (${nik})`);
        }
      }
      return addedCount;
    } catch (error) {
      this.logger.error('Gagal melakukan sinkronisasi Google Sheets:', error.message);
      return 0;
    } finally {
      this.isSyncing = false;
    }
  }
}
```

---

## 4. Implementasi Frontend (Next.js)

### A. Instalasi Package QR Code
Jalankan perintah berikut di direktori proyek Next.js:
```bash
npm install qrcode.react
```

### B. Komponen Panel Sinkronisasi & QR Code (`components/SyncAndQrPanel.tsx`)
Komponen ini menampilkan QR Code untuk pasien serta tombol bagi perawat untuk menarik data terbaru secara instan:

```tsx
'use client';
import { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';

export default function SyncAndQrPanel({ onSyncSuccess }: { onSyncSuccess: () => void }) {
  const [loading, setLoading] = useState(false);
  const gformUrl = 'https://forms.gle/LINK_GFORM_ANDA';

  const handleManualSync = async () => {
    setLoading(true);
    try {
      const res = await fetch('http://IP_LOKAL_NESTJS:3001/patients/sync', {
        method: 'POST',
      });
      const data = await res.json();
      alert(`Berhasil menarik ${data.newPatientsAdded} data pasien baru.`);
      onSyncSuccess(); // Memicu refresh tabel pasien di halaman utama
    } catch (err) {
      alert('Gagal melakukan sinkronisasi dengan server.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center gap-6 p-4 border rounded-lg bg-white shadow-sm">
      <div className="text-center">
        <QRCodeSVG value={gformUrl} size={120} />
        <p className="text-xs mt-2 text-gray-600">Scan untuk Registrasi</p>
      </div>
      <div>
        <h3 className="font-semibold text-lg">Sinkronisasi Data Pasien</h3>
        <p className="text-sm text-gray-500 mb-3">
          Data ditarik otomatis setiap 30 detik, atau klik tombol di bawah untuk menarik data sekarang.
        </p>
        <button
          onClick={handleManualSync}
          disabled={loading}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400"
        >
          {loading ? 'Menarik Data...' : 'Tarik Data GForm Sekarang'}
        </button>
      </div>
    </div>
  );
}
```

---

## 5. Catatan Penting & Mitigasi Risiko

* **Penanganan Duplikasi Input (Idempotensi):** Pasien terkadang mengisi Google Form lebih dari satu kali karena ragu apakah pengiriman pertama berhasil. Pastikan sebelum menyimpan ke database lokal di NestJS, lakukan pengecekan (`findOne` atau `upsert`) berdasarkan kombinasi `NIK` dan `tanggal pendaftaran` hari tersebut agar satu pasien tidak tercatat ganda di laporan.
* **Perubahan Urutan Kolom:** Jangan mengubah urutan kolom di Google Sheets setelah sistem berjalan, karena pembacaan array `rows[i]` di NestJS bergantung pada urutan indeks kolom (`A`, `B`, `C`, dst.).