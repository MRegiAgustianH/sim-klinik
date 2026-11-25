import { BadRequestException, Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { DEFAULT_SETTINGS } from '../database/seed';

// Kunci yang boleh diubah dari halaman Pengaturan. Kunci lain diabaikan agar
// tabel settings tidak terisi sampah dari permintaan sembarang.
const EDITABLE_KEYS = Object.keys(DEFAULT_SETTINGS);

@Injectable()
export class SettingsService {
  constructor(private readonly db: DatabaseService) {}

  all(): Record<string, string> {
    const rows = this.db.query<{ key: string; value: string }>('SELECT key, value FROM settings');
    const result: Record<string, string> = { ...DEFAULT_SETTINGS };
    for (const row of rows) {
      // Penanda internal (mis. seed_formulir_vaksinasi) bukan pengaturan.
      if (row.key.startsWith('seed_')) continue;
      result[row.key] = row.value ?? '';
    }
    return result;
  }

  value(key: string): string {
    return this.all()[key] ?? '';
  }

  update(body: Record<string, unknown>) {
    if (!body || typeof body !== 'object') throw new BadRequestException('Data pengaturan tidak valid.');
    const changes: Array<[string, string]> = [];
    for (const [key, raw] of Object.entries(body)) {
      if (!EDITABLE_KEYS.includes(key)) continue;
      const value = raw == null ? '' : String(raw).trim();
      if (key === 'digit_nomor' && !/^[1-6]$/.test(value)) {
        throw new BadRequestException('Jumlah digit nomor urut harus 1 sampai 6.');
      }
      if (key === 'pola_nomor' && !value.includes('{no}')) {
        throw new BadRequestException('Pola nomor wajib memuat {no}.');
      }
      changes.push([key, value]);
    }
    for (const [key, value] of changes) {
      this.db.run('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value', [
        key,
        value,
      ]);
    }
    return this.all();
  }

  // --- Penomoran ---

  counters() {
    return this.db.query<{ code: string; year: number; lastSeq: number }>(
      'SELECT code, year, lastSeq FROM letter_numbering ORDER BY year DESC, code ASC'
    );
  }

  /**
   * Mengatur nomor urut terakhir, mis. saat mulai memakai sistem di tengah
   * tahun dan nomor manual terakhir sudah 045. Tidak boleh lebih kecil dari
   * nomor yang sudah dipakai surat terbit, agar tidak ada nomor ganda.
   */
  setCounter(body: { code?: string; year?: number; lastSeq?: number }) {
    const code = String(body?.code || '').trim().toUpperCase();
    const year = Number(body?.year);
    const lastSeq = Number(body?.lastSeq);
    if (!code) throw new BadRequestException('Kode penomoran wajib diisi.');
    if (!Number.isInteger(year) || year < 2000 || year > 2100) throw new BadRequestException('Tahun tidak valid.');
    if (!Number.isInteger(lastSeq) || lastSeq < 0) throw new BadRequestException('Nomor urut terakhir harus bilangan bulat 0 atau lebih.');

    const used = this.db.get<{ maxSeq: number | null }>(
      'SELECT MAX(numberSeq) AS maxSeq FROM letters WHERE numberCode = ? AND numberYear = ? AND letterNumber IS NOT NULL',
      [code, year]
    )?.maxSeq;
    if (used != null && lastSeq < used) {
      throw new BadRequestException(
        `Nomor urut ${used} sudah dipakai surat terbit untuk kode ${code} tahun ${year}. Isi minimal ${used}.`
      );
    }

    this.db.run(
      `INSERT INTO letter_numbering (code, year, lastSeq) VALUES (?, ?, ?)
       ON CONFLICT(code, year) DO UPDATE SET lastSeq = excluded.lastSeq`,
      [code, year, lastSeq]
    );
    return this.counters();
  }
}
