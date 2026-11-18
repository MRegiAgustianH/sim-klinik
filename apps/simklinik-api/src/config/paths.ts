import * as path from 'path';

// Lokasi data, rahasia, dan aset bersama di root repositori.
//
// runner.js mengisi KLINIK_ROOT dengan path absolut root repo. Bila kosong
// (mis. skrip npm dijalankan manual), root dihitung dari folder aplikasi:
// skrip npm selalu berjalan dengan cwd = apps/simklinik-api, dua tingkat di
// bawah root.
export const KLINIK_ROOT = process.env.KLINIK_ROOT || path.resolve(process.cwd(), '..', '..');

export const DATA_DIR = path.join(KLINIK_ROOT, 'data', 'simklinik');
export const IDENTITY_DATA_DIR = path.join(KLINIK_ROOT, 'data', 'identity');
export const SERVICE_KEYS_DIR = path.join(KLINIK_ROOT, 'secrets', 'service-keys');

// Satu lokasi pasti. Sebelumnya kredensial dicari di lima tempat dan yang
// terpakai bergantung pada folder tempat backend dijalankan.
export const GOOGLE_CREDENTIALS_PATH =
  process.env.GOOGLE_CREDENTIALS_PATH || path.join(KLINIK_ROOT, 'secrets', 'google-credentials.json');

export const HEADER_IMAGE_PATH = path.join(KLINIK_ROOT, 'assets', 'header-hasil.jpeg');
