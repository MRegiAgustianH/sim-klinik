import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { google, sheets_v4 } from 'googleapis';
import * as path from 'path';
import * as fs from 'fs';
import { DatabaseService } from '../database/database.service';

export interface GformConfig {
  gformUrl: string;
  spreadsheetId: string;
  sheetName: string;
  syncEnabled: boolean;
  lastSyncTime: string | null;
  lastSyncStatus: string;
  hasCredentialsFile: boolean;
}

@Injectable()
export class GformSyncService {
  private readonly logger = new Logger(GformSyncService.name);
  private sheets: sheets_v4.Sheets | null = null;
  private isSyncing = false;
  private credentialsPath: string;

  constructor(private readonly db: DatabaseService) {
    const possiblePaths = [
      path.join(process.cwd(), 'google-credentials.json'),
      path.join(process.cwd(), 'server', 'google-credentials.json'),
      path.join(process.cwd(), '..', 'google-credentials.json'),
      path.join(__dirname, '..', '..', 'google-credentials.json'),
      path.join(__dirname, '..', '..', '..', 'google-credentials.json'),
    ];

    this.credentialsPath = possiblePaths[0];
    for (const p of possiblePaths) {
      if (fs.existsSync(p)) {
        this.credentialsPath = p;
        break;
      }
    }

    this.initGoogleClient();
  }

  private initGoogleClient() {
    try {
      if (fs.existsSync(this.credentialsPath)) {
        const auth = new google.auth.GoogleAuth({
          keyFile: this.credentialsPath,
          scopes: ['https://www.googleapis.com/auth/spreadsheets'],
        });
        this.sheets = google.sheets({ version: 'v4', auth });
        this.logger.log(`Google Sheets API berhasil diinisialisasi dari: ${this.credentialsPath}`);
      } else {
        this.sheets = null;
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Inisialisasi Google Auth gagal: ${msg}`);
      this.sheets = null;
    }
  }

  @Cron(CronExpression.EVERY_30_SECONDS)
  async handleCron() {
    const config = this.getConfig();
    if (config.syncEnabled && config.spreadsheetId) {
      await this.syncPatientsFromSheet();
    }
  }

  getConfig(): GformConfig {
    const getVal = (key: string, def = ''): string => {
      const row = this.db.get<{ value: string }>('SELECT value FROM app_settings WHERE key = ?', [key]);
      return row ? row.value : def;
    };

    const hasCreds = fs.existsSync(this.credentialsPath);
    const spId = getVal('gform_spreadsheet_id', '');
    const isScript = spId.includes('script.google.com');

    return {
      gformUrl: getVal('gform_url', 'https://forms.gle/UQbvWGhwFHSknGkv5'),
      spreadsheetId: spId,
      sheetName: getVal('gform_sheet_name', 'Form Responses 1'),
      syncEnabled: getVal('gform_sync_enabled', 'true') === 'true',
      lastSyncTime: getVal('gform_last_sync_time', null),
      lastSyncStatus: getVal(
        'gform_last_sync_status',
        isScript ? 'Siap (Google Apps Script)' : hasCreds ? 'Siap' : 'Menunggu konfigurasi'
      ),
      hasCredentialsFile: hasCreds || isScript,
    };
  }

  saveConfig(partial: { gformUrl?: string; spreadsheetId?: string; sheetName?: string; syncEnabled?: boolean }): GformConfig {
    const setVal = (key: string, val: string) => {
      this.db.run(
        `INSERT INTO app_settings (key, value, updatedAt) VALUES (?, ?, CURRENT_TIMESTAMP)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updatedAt = CURRENT_TIMESTAMP`,
        [key, val]
      );
    };

    if (partial.gformUrl !== undefined) setVal('gform_url', partial.gformUrl.trim());
    if (partial.spreadsheetId !== undefined) {
      let rawId = partial.spreadsheetId.trim();
      if (rawId.includes('/spreadsheets/d/')) {
        const match = rawId.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
        if (match && match[1]) {
          rawId = match[1];
        }
      }
      setVal('gform_spreadsheet_id', rawId);
    }
    if (partial.sheetName !== undefined) setVal('gform_sheet_name', partial.sheetName.trim());
    if (partial.syncEnabled !== undefined) setVal('gform_sync_enabled', partial.syncEnabled ? 'true' : 'false');

    this.initGoogleClient();
    return this.getConfig();
  }

  /**
   * Parser cerdas untuk Tempat & Tanggal Lahir dari teks bebas/paragraf.
   * Mendukung format nama bulan Indonesia/Inggris, numerik (DD/MM/YYYY),
   * serta ekstraksi otomatis tanggal lahir dari NIK 16 digit jika teks tidak memuat tanggal valid.
   */
  private parseTtlAdvanced(ttlStr: string, nik: string): { birthPlace: string; birthDate: string } {
    let birthPlace = 'Cianjur';
    let birthDate: string | null = null;

    if (ttlStr && ttlStr.trim()) {
      const raw = ttlStr.trim();

      // 1. Ekstrak kota lahir (sebelum koma atau sebelum angka pertama)
      const commaIndex = raw.indexOf(',');
      if (commaIndex !== -1) {
        birthPlace = raw.substring(0, commaIndex).trim();
      } else {
        const matchCity = raw.match(/^([a-zA-Z\s]+)/);
        if (matchCity && matchCity[1].trim()) {
          birthPlace = matchCity[1].trim();
        }
      }

      // 2. Ekstrak tanggal lahir dari teks
      const months: Record<string, string> = {
        januari: '01', februari: '02', maret: '03', april: '04', mei: '05', juni: '06',
        juli: '07', agustus: '08', september: '09', oktober: '10', november: '11', desember: '12',
        jan: '01', feb: '02', mar: '03', apr: '04', jun: '06', jul: '07',
        agu: '08', ags: '08', agt: '08', sep: '09', okt: '10', nop: '11', nov: '11', des: '12',
        january: '01', february: '02', march: '03', may: '05', june: '06',
        july: '07', august: '08', october: '10', december: '12',
      };

      // Format A: '18 Agustus 2003' atau '18 Ags 2003'
      const matchMonthName = raw.match(/(\d{1,2})\s+([a-zA-Z]+)\s+(\d{4})/);
      if (matchMonthName) {
        const day = matchMonthName[1].padStart(2, '0');
        const mName = matchMonthName[2].toLowerCase();
        const month = months[mName];
        const year = matchMonthName[3];
        if (month) {
          birthDate = `${year}-${month}-${day}`;
        }
      }

      // Format B: '18-08-2003' atau '18/08/2003' atau '18.08.2003'
      if (!birthDate) {
        const matchNumeric = raw.match(/(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})/);
        if (matchNumeric) {
          birthDate = `${matchNumeric[3]}-${matchNumeric[2].padStart(2, '0')}-${matchNumeric[1].padStart(2, '0')}`;
        }
      }

      // Format C: '2003-08-18' (ISO)
      if (!birthDate) {
        const matchIso = raw.match(/(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
        if (matchIso) {
          birthDate = `${matchIso[1]}-${matchIso[2].padStart(2, '0')}-${matchIso[3].padStart(2, '0')}`;
        }
      }
    }

    // 3. Fallback cerdas: Ekstraksi tanggal lahir langsung dari NIK KTP 16 digit!
    if (!birthDate && nik) {
      const cleanNik = nik.replace(/\D/g, '');
      if (cleanNik.length >= 12) {
        let day = parseInt(cleanNik.substring(6, 8), 10);
        const month = cleanNik.substring(8, 10);
        const yearTwoDigits = parseInt(cleanNik.substring(10, 12), 10);

        if (!isNaN(day) && !isNaN(yearTwoDigits)) {
          if (day > 40) day -= 40; // Algoritma resmi Dukcapil: perempuan hari lahir ditambah 40
          const currentYearMod = new Date().getFullYear() % 100;
          const fullYear = yearTwoDigits <= currentYearMod ? 2000 + yearTwoDigits : 1900 + yearTwoDigits;
          const dayStr = String(day).padStart(2, '0');
          const monthInt = parseInt(month, 10);
          if (monthInt >= 1 && monthInt <= 12 && day >= 1 && day <= 31) {
            birthDate = `${fullYear}-${month}-${dayStr}`;
          }
        }
      }
    }

    if (!birthDate) birthDate = '1995-01-01';
    return { birthPlace: birthPlace || 'Cianjur', birthDate };
  }

  private parsePlannedDate(dStr: string): string {
    if (!dStr) return new Date().toISOString().split('T')[0];
    const m = dStr.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
    if (m) {
      return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
    }
    return dStr.trim();
  }

  async syncPatientsFromSheet(): Promise<{ addedCount: number; message: string; configured: boolean }> {
    if (this.isSyncing) {
      return { addedCount: 0, message: 'Sinkronisasi sedang berlangsung.', configured: true };
    }

    const config = this.getConfig();
    const isScriptUrl = config.spreadsheetId && config.spreadsheetId.includes('script.google.com');

    if (!config.spreadsheetId || config.spreadsheetId.trim() === '') {
      const msg = 'Spreadsheet ID belum diisi pada menu konfigurasi.';
      this.updateSyncStatus(msg);
      return { addedCount: 0, message: msg, configured: false };
    }

    if (!isScriptUrl && !config.hasCredentialsFile) {
      const msg = 'Kredensial belum ada. Gunakan URL Google Apps Script Web App atau unggah google-credentials.json.';
      this.updateSyncStatus(msg);
      return { addedCount: 0, message: msg, configured: false };
    }

    if (!isScriptUrl && !this.sheets) {
      this.initGoogleClient();
      if (!this.sheets) {
        const msg = 'Koneksi ke Google Sheets API gagal diinisialisasi.';
        this.updateSyncStatus(msg);
        return { addedCount: 0, message: msg, configured: false };
      }
    }

    this.isSyncing = true;
    let addedCount = 0;
    const sheetName = config.sheetName || 'Form Responses 1';

    try {
      this.logger.log(`Memulai penarikan data Google Sheets ID: ${config.spreadsheetId} (${sheetName})...`);

      let rows: unknown[][];

      if (isScriptUrl) {
        const fetchRes = await fetch(config.spreadsheetId, { redirect: 'follow' });
        if (!fetchRes.ok) {
          throw new Error(`Google Apps Script HTTP ${fetchRes.status}: ${fetchRes.statusText}`);
        }
        rows = (await fetchRes.json()) as unknown[][];
      } else {
        const response = await this.sheets!.spreadsheets.values.get({
          spreadsheetId: config.spreadsheetId,
          range: `'${sheetName}'!A1:Z`,
        });
        rows = (response.data.values || []) as unknown[][];
      }

      if (!rows || rows.length <= 1) {
        const msg = 'Tidak ada baris data pada Google Sheets.';
        this.updateSyncStatus(msg);
        return { addedCount: 0, message: msg, configured: true };
      }

      const headerRow = (rows[0] as string[]).map((h) => (h ? h.toString().toLowerCase().trim() : ''));

      // Kolom STATUS_SYNC HARUS EKSPLISIT (tidak boleh match 'status pernikahan')
      let colSync = headerRow.findIndex((h) =>
        h === 'status_sync' ||
        h === 'status sync' ||
        h === 'sync' ||
        (h.includes('sync') && !h.includes('pernikahan') && !h.includes('nikah'))
      );

      let colNik = headerRow.findIndex((h) => h.includes('nik'));
      let colNama = headerRow.findIndex((h) => h.includes('nama lengkap') || h.includes('nama'));
      let colPassport = headerRow.findIndex((h) => h.includes('passport') || h.includes('paspor'));
      let colGender = headerRow.findIndex((h) => h.includes('kelamin') || h.includes('gender'));
      let colTtl = headerRow.findIndex((h) => h.includes('tempat') || h.includes('tanggal lahir') || h.includes('lahir'));
      let colEmail = headerRow.findIndex((h) => h.includes('email') && h.includes('aktif'));
      if (colEmail === -1) {
        colEmail = headerRow.findIndex((h) => h.includes('email') && !h.includes('address'));
      }
      if (colEmail === -1) {
        colEmail = headerRow.findIndex((h) => h.includes('email'));
      }
      let colAlamat = headerRow.findIndex((h) => h.includes('alamat'));
      let colHp = headerRow.findIndex((h) => h.includes('whatsapp') || h.includes('wa') || h.includes('telepon') || h.includes('hp'));
      let colPekerjaan = headerRow.findIndex((h) => h.includes('pekerjaan') || h.includes('profesi'));
      let colNikah = headerRow.findIndex((h) => (h.includes('pernikahan') || h.includes('nikah')) && !h.includes('sync'));
      let colVaksin = headerRow.findIndex((h) => h.includes('vaksin'));
      let colTglKunjungan = headerRow.findIndex((h) => h.includes('rencana') && (h.includes('hari') || h.includes('tanggal')));
      let colJamKunjungan = headerRow.findIndex((h) => h.includes('jam'));
      let colInfoSource = headerRow.findIndex((h) => h.includes('informasi') || h.includes('sumber'));
      let colWus = headerRow.findIndex((h) => h.includes('hamil') || h.includes('kehamilan') || h.includes('wus'));

      // Fallback index sesuai format formulir riil
      if (colNik === -1) colNik = 2;
      if (colNama === -1) colNama = 3;
      if (colPassport === -1) colPassport = 4;
      if (colGender === -1) colGender = 5;
      if (colTtl === -1) colTtl = 6;
      if (colEmail === -1) colEmail = 7;
      if (colAlamat === -1) colAlamat = 8;
      if (colHp === -1) colHp = 9;
      if (colPekerjaan === -1) colPekerjaan = 10;
      if (colNikah === -1) colNikah = 11;
      if (colVaksin === -1) colVaksin = 12;
      if (colTglKunjungan === -1) colTglKunjungan = 13;
      if (colJamKunjungan === -1) colJamKunjungan = 14;
      if (colInfoSource === -1) colInfoSource = 15;
      if (colSync === -1) colSync = 16; // Kolom Q

      const todayStr = new Date().toISOString().split('T')[0];
      const nowTimeStr = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WIB';
      const colSyncLetter = String.fromCharCode(65 + colSync);

      this.logger.log(`Kolom terdeteksi: NIK=${colNik}, Nama=${colNama}, TTL=${colTtl}, Sync=${colSync} (${colSyncLetter})`);

      for (let i = 1; i < rows.length; i++) {
        const row = rows[i] as string[];
        let rawNik = colNik !== -1 && row[colNik] ? row[colNik].toString().trim() : '';
        const rawNama = colNama !== -1 && row[colNama] ? row[colNama].toString().trim() : '';

        // Bersihkan NIK jika memuat angka, atau pertahankan teks jika input uji coba (misal 'snan')
        const nikDigitsOnly = rawNik.replace(/\D/g, '');
        if (nikDigitsOnly.length > 0) {
          rawNik = nikDigitsOnly;
        }

        // Jika baris kosong tanpa nama dan tanpa NIK, lewati
        if (!rawNama && !rawNik) {
          continue;
        }

        // Jika ada nama namun NIK kosong di Google Sheets, buatkan ID pengganti otomatis
        if (!rawNik && rawNama) {
          rawNik = `GEN${Date.now().toString().slice(-13)}`;
        }

        const cleanNama = rawNama || 'Pasien Tanpa Nama';
        const rawPassport = colPassport !== -1 && row[colPassport] ? row[colPassport].toString().trim() : '';
        const rawGenderStr = colGender !== -1 && row[colGender] ? row[colGender].toString().trim().toLowerCase() : '';
        const rawTtl = colTtl !== -1 && row[colTtl] ? row[colTtl].toString().trim() : '';
        const rawEmail = colEmail !== -1 && row[colEmail] ? row[colEmail].toString().trim() : null;
        const rawAlamat = colAlamat !== -1 && row[colAlamat] ? row[colAlamat].toString().trim() : 'Cianjur';
        const rawHp = colHp !== -1 && row[colHp] ? row[colHp].toString().trim() : '08123456789';
        const rawPekerjaan = colPekerjaan !== -1 && row[colPekerjaan] ? row[colPekerjaan].toString().trim() : 'Lainnya';
        const rawNikah = colNikah !== -1 && row[colNikah] ? row[colNikah].toString().trim() : 'Belum Kawin';
        const rawVaksin = colVaksin !== -1 && row[colVaksin] ? row[colVaksin].toString().trim() : 'Meningitis Meningokokus ACYW-135';
        const rawTglKunjungan = colTglKunjungan !== -1 && row[colTglKunjungan] ? row[colTglKunjungan].toString().trim() : '';
        const rawJamKunjungan = colJamKunjungan !== -1 && row[colJamKunjungan] ? row[colJamKunjungan].toString().trim() : '';
        const rawInfoSource = colInfoSource !== -1 && row[colInfoSource] ? row[colInfoSource].toString().trim() : 'Sosial Media';
        const currentSync = colSync !== -1 && row[colSync] ? row[colSync].toString().trim() : '';

        const rowNumber = i + 1;

        // Idempotensi: Cek apakah data pasien ini sudah ada di database lokal
        const existing = this.db.get<{ id: number; fullName: string }>(
          `SELECT id, fullName FROM vaccination_records
           WHERE nik = ? AND (plannedDate = ? OR SUBSTR(createdAt, 1, 10) = ?)`,
          [rawNik, todayStr, todayStr]
        );

        // Jika di sheet sudah TERSIMPAN dan datanya memang sudah tercatat di DB -> lewati
        if (currentSync.startsWith('TERSIMPAN') && existing) {
          continue;
        }

        // Jika data sudah tercatat di DB namun di sheet belum TERSIMPAN -> tandai TERSIMPAN (DUPLIKAT)
        if (existing) {
          await this.markRowSync(config.spreadsheetId, sheetName, colSyncLetter, rowNumber, colSync + 1, 'TERSIMPAN (DUPLIKAT)');
          this.logger.log(`Data dilewati karena sudah terdaftar hari ini (Duplikat): ${cleanNama} (${rawNik})`);
          continue;
        }

        // Tentukan gender
        let gender: 'Laki-laki' | 'Perempuan' = 'Laki-laki';
        if (rawGenderStr) {
          if (rawGenderStr.includes('p') || rawGenderStr.includes('wanita') || rawGenderStr.includes('perempuan')) {
            gender = 'Perempuan';
          }
        }

        // Parse Tempat & Tanggal Lahir Cerdas (mendukung teks bebas dan ekstraksi NIK)
        const { birthPlace, birthDate } = this.parseTtlAdvanced(rawTtl, rawNik);

        // Parse Jadwal Kunjungan
        const plannedDate = this.parsePlannedDate(rawTglKunjungan) || todayStr;
        let plannedTime = rawJamKunjungan || nowTimeStr;
        if (!plannedTime.includes('WIB')) plannedTime += ' WIB';

        // Parse Status Nikah
        let maritalStatus = 'Belum Kawin';
        if (rawNikah.toLowerCase().includes('kawin') && !rawNikah.toLowerCase().includes('belum')) maritalStatus = 'Kawin';
        else if (rawNikah.toLowerCase().includes('hidup')) maritalStatus = 'Cerai Hidup';
        else if (rawNikah.toLowerCase().includes('mati')) maritalStatus = 'Cerai Mati';

        // Skrining Kehamilan WUS: jika di Google Form ada pertanyaan kehamilan, tangkap nilainya.
        // Jika tidak ada di form (default SOP klinik), tetap 'Tidak Dilakukan' agar diverifikasi objektif oleh dokter/perawat.
        let pregnancyTestResult: 'Negatif' | 'Positif' | 'Tidak Dilakukan' = 'Tidak Dilakukan';
        if (gender === 'Perempuan' && colWus !== -1 && row[colWus]) {
          const rawWus = row[colWus].toString().trim().toLowerCase();
          if (rawWus.includes('positif') || rawWus.includes('hamil') || rawWus === 'ya') {
            pregnancyTestResult = 'Positif';
          } else if (rawWus.includes('negatif') || rawWus.includes('tidak') || rawWus === 'bukan') {
            pregnancyTestResult = 'Negatif';
          }
        }

        // Notes / Keterangan
        const notes = rawPassport && rawPassport !== '-' ? `No. Paspor: ${rawPassport}` : 'Pendaftaran mandiri via Google Form';

        // Simpan ke database lokal SQLite
        this.db.run(
          `INSERT INTO vaccination_records (
            nik, fullName, gender, birthPlace, birthDate, email, address, phoneWa,
            occupation, maritalStatus, vaccineType, plannedDate, plannedTime,
            doctorApproval, doctorNotes, status, doctorName, nurseName, adminName,
            notes, infoSource, icvNumber, monthYear, pregnancyTestResult, batchNumber
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            rawNik.padEnd(16, '0').substring(0, 16),
            cleanNama,
            gender,
            birthPlace,
            birthDate,
            rawEmail,
            rawAlamat,
            rawHp,
            rawPekerjaan,
            maritalStatus,
            rawVaksin,
            plannedDate,
            plannedTime,
            'Menunggu Persetujuan',
            'Pendaftaran mandiri pasien via Google Form QR Code',
            'Belum',
            '-',
            '-',
            'Registrasi Mandiri (GForm)',
            notes,
            rawInfoSource,
            null,
            plannedDate.substring(0, 7),
            pregnancyTestResult,
            null,
          ]
        );

        // Update baris Google Sheet menjadi 'TERSIMPAN'
        await this.markRowSync(config.spreadsheetId, sheetName, colSyncLetter, rowNumber, colSync + 1, 'TERSIMPAN');

        addedCount++;
        this.logger.log(`[GForm Sync] Pasien baru berhasil disimpan: ${rawNama} (${rawNik}) - TTL: ${birthPlace}, ${birthDate}`);
      }

      const successMsg = `Sinkronisasi berhasil: ${addedCount} pasien baru ditambahkan.`;
      this.updateSyncStatus(successMsg, true);
      return { addedCount, message: successMsg, configured: true };
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      this.logger.error(`Gagal sinkronisasi Google Sheets: ${errMsg}`);
      this.updateSyncStatus(`Gagal sinkronisasi: ${errMsg}`);
      return { addedCount, message: `Gagal: ${errMsg}`, configured: true };
    } finally {
      this.isSyncing = false;
    }
  }

  private async markRowSync(
    spreadsheetIdOrUrl: string,
    sheetName: string,
    colLetter: string,
    rowNumber: number,
    colNumber: number,
    statusText: string
  ) {
    const isScriptUrl = spreadsheetIdOrUrl.includes('script.google.com');
    if (isScriptUrl) {
      try {
        await fetch(spreadsheetIdOrUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ row: rowNumber, col: colNumber, value: statusText }),
          redirect: 'follow',
        });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.warn(`Gagal update Apps Script row ${rowNumber}: ${msg}`);
      }
    } else {
      await this.updateSheetCell(spreadsheetIdOrUrl, sheetName, `${colLetter}${rowNumber}`, statusText);
    }
  }

  private async updateSheetCell(spreadsheetId: string, sheetName: string, cellRange: string, value: string) {
    if (!this.sheets) return;
    try {
      await this.sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `'${sheetName}'!${cellRange}`,
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: [[value]] },
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Gagal memperbarui sel ${cellRange} di Google Sheets: ${msg}`);
    }
  }

  private updateSyncStatus(statusMsg: string, updateTimestamp = false) {
    const nowIso = new Date().toISOString();
    this.db.run(
      `INSERT INTO app_settings (key, value, updatedAt) VALUES ('gform_last_sync_status', ?, CURRENT_TIMESTAMP)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updatedAt = CURRENT_TIMESTAMP`,
      [statusMsg]
    );

    if (updateTimestamp) {
      this.db.run(
        `INSERT INTO app_settings (key, value, updatedAt) VALUES ('gform_last_sync_time', ?, CURRENT_TIMESTAMP)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updatedAt = CURRENT_TIMESTAMP`,
        [nowIso]
      );
    }
  }
}
