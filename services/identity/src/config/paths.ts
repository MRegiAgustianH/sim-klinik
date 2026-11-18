import * as path from 'path';

// Lokasi data dan rahasia di root repositori.
//
// runner.js mengisi KLINIK_ROOT dengan path absolut root repo. Bila kosong
// (mis. `npm run generate-key` dijalankan manual), root dihitung dari folder
// layanan: skrip npm selalu berjalan dengan cwd = services/identity, dua
// tingkat di bawah root.
export const KLINIK_ROOT = process.env.KLINIK_ROOT || path.resolve(process.cwd(), '..', '..');

export const DATA_DIR = path.join(KLINIK_ROOT, 'data', 'identity');
export const SERVICE_KEYS_DIR = path.join(KLINIK_ROOT, 'secrets', 'service-keys');
export const SIMKLINIK_DATA_DIR = path.join(KLINIK_ROOT, 'data', 'simklinik');
