# Identity Service — Layanan Identitas Portal SIMKlinik

Satu sumber data **pengguna** dan **pasien** untuk semua app klinik. App lain (SIMKlinik, sistem surat & laporan, app berikutnya) tidak lagi menyimpan identitas pasien sendiri, melainkan menyimpan `patientId` dan mengambil datanya dari layanan ini.

Rancangan lengkap: `../../README.md` bagian 5.

| | |
| :--- | :--- |
| Port | `4010` (atur dengan `PORT`) |
| Database dev | `data/identity/identity-dev.sqlite` (di root repo) |
| Database prod | `data/identity/identity.sqlite` (di root repo) |
| Health check | `GET http://localhost:4010/api/health` |

Penanda mode sama dengan SIMKlinik: keberadaan file `.env.local` = mode development.

---

## Menjalankan

Requirement: **Node.js 22.13+** (memakai modul `node:sqlite`).

```bat
cd services\identity
npm install
npm start
```

Layar pertama menampilkan peringatan bila `JWT_SECRET` belum diset. Untuk production, set variabel itu sebelum start (nilainya harus **sama** di semua app):

```bat
set JWT_SECRET=<kunci-panjang-acak>
set PORT=4010
npm start
```

Akun awal: `superadmin / admin123`, `dokter / dokter123`, `perawat / perawat123`, `admin / admin123`. **Ganti sebelum dipakai.**

---

## Endpoint

### Publik
| Method | Path | Fungsi |
| :--- | :--- | :--- |
| POST | `/api/auth/login` | Login, terbitkan token. Body: `{ username, password, audience? }`. `audience` = `portal` (default), `simklinik`, `surat`, `laporan`. |
| GET | `/api/health` | Status layanan + jumlah pengguna & pasien |

### Butuh token pengguna (`Authorization: Bearer <token>` atau `?token=`)
| Method | Path | Fungsi |
| :--- | :--- | :--- |
| GET | `/api/auth/profile` | Profil + daftar app yang boleh dibuka |
| POST | `/api/auth/change-password` | Ubah kata sandi sendiri |
| GET | `/api/apps` | Daftar app yang boleh dibuka pengguna ini |
| GET | `/api/apps/health` | Status hidup/mati setiap app |
| GET | `/api/patients?q=&limit=&offset=` | Cari pasien (NIK 16 digit, nama, telepon) |
| GET | `/api/patients/batch?ids=1,2,3` | Beberapa pasien sekaligus |
| GET | `/api/patients/:id` | Detail pasien (+ `age` dihitung dari tanggal lahir) |
| POST | `/api/patients` | Daftar pasien baru |
| PUT/PATCH | `/api/patients/:id` | Ubah pasien |

### Khusus Superadmin
| Method | Path | Fungsi |
| :--- | :--- | :--- |
| GET | `/api/users` | Daftar pengguna + akses app |
| POST | `/api/users` | Buat pengguna (opsional `appCodes`) |
| PUT | `/api/users/:id` | Ubah nama, peran, status aktif, reset kata sandi |
| PUT | `/api/users/:id/apps` | Atur akses app: `{ appCodes: ["simklinik","surat"] }` |
| GET | `/api/apps/all` | Semua app termasuk yang nonaktif |
| POST | `/api/apps` | Daftarkan / ubah app di portal |

### Antar-layanan (header `x-service-name` + `x-service-key`)
| Method | Path | Fungsi |
| :--- | :--- | :--- |
| POST | `/api/auth/verify` | Verifikasi token. Opsional header `x-app-code` untuk memastikan token milik app itu. |
| POST | `/api/auth/verify-any` | Hanya portal: verifikasi token app apa pun |
| POST | `/api/auth/mint` | Hanya portal: tukar token portal → token app tujuan (header `x-target-aud`) |

---

## Membuat service key

Kunci hanya ditampilkan sekali; database menyimpan hash bcrypt-nya.

```bat
npm run generate-key -- portal --portal
npm run generate-key -- simklinik
npm run generate-key -- surat
```

Salin hasilnya ke file `.env` backend app terkait:

```
IDENTITY_SERVICE_URL=http://127.0.0.1:4010
IDENTITY_SERVICE_NAME=surat
IDENTITY_SERVICE_KEY=<kunci>
```

---

## Impor pasien lama dari SIMKlinik

Membaca `data/simklinik/vaksinku.sqlite` **read-only** dan menulis ke database identity service. Database SIMKlinik tidak diubah.

```bat
npm run import:patients -- --dry-run     :: lihat hasil dulu, tidak menulis
npm run import:patients                  :: impor sebenarnya
```

Yang perlu diketahui:

- Hanya baris dengan **NIK 16 digit** yang diimpor. NIK kosong/pendek dilewati dan dihitung di ringkasan — pasien tanpa NIK tidak bisa dicocokkan, jadi dibuat manual lewat portal.
- Sumber diurutkan dari kunjungan terlama. NIK yang sama digabung jadi satu pasien.
- Field kosong diisi dari data baru; field yang **sudah terisi tidak ditimpa**.
- **Bentrok** = NIK sama tetapi nama atau tanggal lahir berbeda. Baris tidak diubah dan dilaporkan; periksa manual sebelum dipakai.
- MCU tanpa tanggal lahir mengambil perkiraan dari usia saat periksa; gender disimpulkan dari teks `ageGender`.
- Impor boleh diulang (idempoten), tetapi cadangkan `data/identity/identity.sqlite` dulu.

---

## Memeriksa

```bash
curl http://localhost:4010/api/health
curl -X POST http://localhost:4010/api/auth/login -H "Content-Type: application/json" -d "{\"username\":\"superadmin\",\"password\":\"admin123\"}"
```

---

## Hal yang sengaja belum ada

- **Denormalisasi ke token saat login**: `apps` dibaca ulang dari database setiap request, sehingga pencabutan akses berlaku seketika. Token tetap membawa `aud` untuk mencegah token app A dipakai di app B.
- **Endpoint hapus pasien**: belum ada. Menghapus identitas akan memutus rujukan rekam medis di app lain tanpa jejak.
- **Refresh token**: token berlaku 12 jam lalu pengguna login ulang.
