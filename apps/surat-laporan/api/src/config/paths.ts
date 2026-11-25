import * as fs from 'fs';
import * as path from 'path';

// Lokasi data, rahasia, dan aset bersama di root repositori.
//
// runner.js mengisi KLINIK_ROOT dengan path absolut root repo. Bila kosong
// (mis. skrip npm dijalankan manual), root dihitung dari folder aplikasi:
// cwd = apps/surat-laporan/api, tiga tingkat di bawah root.
export const KLINIK_ROOT = process.env.KLINIK_ROOT || path.resolve(process.cwd(), '..', '..', '..');

export const DATA_DIR = path.join(KLINIK_ROOT, 'data', 'surat');
export const SERVICE_KEYS_DIR = path.join(KLINIK_ROOT, 'secrets', 'service-keys');
export const HEADER_IMAGE_PATH = path.join(KLINIK_ROOT, 'assets', 'header-hasil.jpeg');
// Kop klinik yang ruang kosongnya sudah dipotong, untuk template formulir.
export const FORM_KOP_IMAGE_PATH = path.join(KLINIK_ROOT, 'assets', 'kop-formulir.jpeg');

// Penanda mode sama dengan seluruh aplikasi klinik: .env.local di folder
// backend = development (database dan service key -dev). Dibuat dan dihapus
// otomatis oleh runner.js.
export const IS_DEV = fs.existsSync(path.join(process.cwd(), '.env.local'));

// Gambar kop dan gambar yang disisipkan di editor. Dipisah per mode agar
// unggahan uji coba tidak tercampur dengan production.
export const UPLOADS_DIR = path.join(DATA_DIR, IS_DEV ? 'uploads-dev' : 'uploads');
