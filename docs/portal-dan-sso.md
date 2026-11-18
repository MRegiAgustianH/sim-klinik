# Portal SIMKlinik — Dashboard & Layanan Identitas

Pintu masuk tunggal ke seluruh aplikasi klinik. Satu akun untuk semua aplikasi, satu data induk pasien, dan satu tempat melihat aplikasi mana yang sedang berjalan.

Rancangan lengkap: [arsitektur-integrasi.md](arsitektur-integrasi.md).

| Bagian | Port (production) | Port (development) | Isi |
| :--- | :--- | :--- | :--- |
| `services/identity/` | `4010` | `4011` | Pengguna, pasien, daftar aplikasi, hak akses, penerbit token |
| `apps/portal/` | `8082` | `8083` | Halaman login, beranda kartu aplikasi, data pasien, pengguna, profil |

---

## Menjalankan

Requirement: **Node.js 22.13+** (memakai modul `node:sqlite`).

**Di komputer utama klinik, cukup satu klik:**

```bat
JALANKAN.bat
```

Itu menyalakan **semua** yang dibutuhkan — layanan identitas, portal, dan SIMKlinik — dari satu jendela. Biarkan jendela itu terbuka; **CTRL + C** mematikan semuanya.

| Akses | Alamat |
| :--- | :--- |
| Portal (pintu masuk) | `http://<IP-server>:8082` |
| SIMKlinik (pelayanan) | `http://<IP-server>:8080` |

Staf cukup membuka portal di 8082. SIMKlinik di 8080 menyala otomatis dan dibuka lewat tombol **Buka Aplikasi** di portal.

`JALANKAN.bat` sudah menyalakan SIMKlinik. `scripts\JALANKAN_SIMKLINIK_SAJA.bat` hanya untuk menguji SIMKlinik tanpa portal; menjalankan keduanya bersamaan memicu pesan "port sudah dipakai".

Untuk menguji tanpa mengganggu klinik:

```bat
MODE_PENGEMBANGAN.bat
```

Portal dev di 8083, SIMKlinik dev di 8081, database terpisah. Production di 8080/8082 tetap berjalan.

**Akun awal:** `superadmin / admin123`, `dokter / dokter123`, `perawat / perawat123`, `admin / admin123`. Ganti sebelum dipakai di klinik.

---

## Cara staf memakai portal

1. Buka `http://<IP-server>:8082` → login dengan akun klinik.
2. Beranda menampilkan kartu setiap aplikasi yang **boleh dibuka akun itu**, lengkap dengan status hidup/mati.
3. Tombol **Buka Aplikasi** membuka aplikasi tujuan di **tab baru** tanpa login ulang (SSO). Portal tetap terbuka di tab semula, jadi staf bisa membuka beberapa aplikasi sekaligus.
4. Di dalam SIMKlinik, tombol **Portal SIMKlinik** di sidebar mengembalikan ke portal.

Staf yang tidak lewat portal tetap bisa login langsung ke SIMKlinik seperti sebelumnya.

---

## Cara SSO bekerja

```
browser  ──login──►  portal (8082)  ──►  layanan identitas (4010)
                          │
                          │ 1. minta tiket untuk app tujuan
                          ▼
                   server portal ──mint(token portal)──► layanan identitas
                          │                                     │
                          │ 2. terbitkan token ber-aud app itu  │
                          ▼                                     │
   redirect ke {app}/sso?sso_ticket=… ────────────────────────►─┘
                          │
                          ▼
   server app tujuan ──tukar tiket──► server portal ──► token app
                          │
                          ▼
   token disimpan seperti hasil login biasa → masuk ke dashboard app
```

Empat hal yang membuat alur ini aman:

- **Service key tidak pernah ke browser.** Penukaran token dilakukan server portal; browser hanya memanggil portal sendiri (same-origin).
- **Token tidak pernah di URL.** Yang berpindah lewat URL adalah **tiket sekali pakai** berumur 60 detik. Menyalin tautan dari riwayat browser tidak berguna.
- **Alamat tujuan tidak diambil dari permintaan.** Portal membacanya dari `app_registry`, jadi tidak bisa dipakai mengarahkan staf ke situs lain bersama tokennya.
- **Tiket tidak bisa ditebus aplikasi lain.** Aplikasi pemanggil dikenali dari service key-nya, bukan dari nama yang ditulis di header.

Token portal ber-aud `portal`, jadi tidak bisa dipakai di aplikasi pelayanan; sebaliknya token aplikasi pelayanan ditolak portal dan aplikasi lain.

**Endpoint antar-layanan yang dipakai portal:** `GET /api/apps/service/list` pada layanan identitas (header `x-service-name` + `x-service-key`), untuk membaca nama dan alamat aplikasi tujuan saat menukar tiket. Endpoint ini hanya membuka data yang sudah tampil di beranda portal bagi setiap pengguna yang login.

---

## Menambah aplikasi baru

Tidak perlu mengubah kode portal — cukup daftarkan di menu **Aplikasi** (Superadmin):

| Isi | Contoh |
| :--- | :--- |
| Kode | `apotek` (huruf kecil, dipakai di token dan hak akses) |
| Nama | Apotek Klinik |
| Alamat frontend | `http://localhost:8084` |
| Alamat API | `http://localhost:4002` |

Kartu aplikasi langsung muncul di beranda bagi akun yang diberi akses, dan statusnya diperiksa dari `GET {alamat API}/api/health` dengan pola yang sudah dipakai SIMKlinik.

Agar aplikasi baru bisa dibuka dengan SSO, tambahkan halaman `/sso` yang menukar tiket — pola yang sama dengan `apps/simklinik-web/src/app/sso/page.tsx` dan `apps/simklinik-web/src/app/api/sso/redeem/route.ts`. Bila aplikasi baru tidak punya halaman itu, kartunya tetap tampil tetapi tombol Buka hanya mengarah ke halaman depan aplikasi tersebut.

---

## Service key

Kunci dibuat otomatis oleh launcher saat pertama dijalankan, dan disimpan sebagai hash bcrypt di database — kunci aslinya hanya ada di file:

```
secrets/service-keys/portal.key       (kunci portal, boleh verify token app mana pun)
secrets/service-keys/simklinik.key    (kunci SIMKlinik)
```

Membuat ulang satu kunci (kunci lama langsung tidak berlaku):

```bat
cd services\identity
npm run generate-key -- portal --portal
npm run generate-key -- simklinik
npm run generate-key -- surat
```

Folder `data/` dan `secrets/` sudah masuk `.gitignore` — **jangan pernah** di-commit.

---

## Impor pasien lama dari SIMKlinik

Membaca `data/simklinik/vaksinku.sqlite` **read-only**; database SIMKlinik tidak diubah.

```bat
cd services\identity
npm run import:patients -- --dry-run     :: lihat hasil dulu, tidak menulis
npm run import:patients                  :: impor sebenarnya
```

- Hanya baris dengan **NIK 16 digit** yang diimpor; NIK kosong/pendek dilewati dan dihitung di ringkasan.
- NIK yang sama digabung jadi satu pasien; field yang sudah terisi tidak ditimpa.
- **Bentrok** (NIK sama, nama atau tanggal lahir berbeda) tidak diubah dan dilaporkan — periksa manual.
- Cadangkan `data/identity/identity.sqlite` sebelum menjalankan impor sungguhan.

---

## Memeriksa

```bash
curl http://localhost:4010/api/health
curl -X POST http://localhost:4010/api/auth/login -H "Content-Type: application/json" -d "{\"username\":\"superadmin\",\"password\":\"admin123\",\"audience\":\"portal\"}"
```

| Gejala | Tindakan |
| :--- | :--- |
| Portal terbuka tetapi login gagal `tidak memiliki akses ke aplikasi 'portal'` | Beri akun itu akses `portal` di menu Pengguna, atau jalankan `INSERT OR IGNORE INTO app_access` seperti seeding |
| Tombol Buka gagal: "Service key portal belum dibuat" | Jalankan `npm run generate-key -- portal --portal` di `services/identity`, lalu nyalakan ulang |
| Tombol Buka gagal: "Service key portal ditolak" | Kunci dibuat ulang setelah portal berjalan. Nyalakan ulang lewat `JALANKAN.bat` |
| Tombol Buka gagal: "aplikasi tidak terdaftar" | Kode aplikasi di `app_registry` berbeda dari kode di kartu. Cek menu **Aplikasi** |
| Tiket ditolak: "Tiket tidak dikenal atau sudah dipakai" | Tiket hanya sekali pakai dan berumur 60 detik. Buka ulang aplikasi dari portal |
| Login 500 / "Layanan identitas tidak dapat dihubungi" | Layanan identitas tidak berjalan. Pakai `JALANKAN.bat`, bukan `npm run start` di folder portal |
| Kartu aplikasi tidak muncul | Cek `frontendUrl` di menu Aplikasi; kartu tanpa alamat tetap tampil tetapi tombolnya mati |
| Status aplikasi "tidak dapat dihubungi" | Aplikasi tujuan belum berjalan. Nyalakan lewat `JALANKAN.bat` |

---

## Yang sengaja belum ada

- **Endpoint hapus pasien** — menghapus identitas akan memutus rujukan rekam medis di aplikasi lain tanpa jejak.
- **Refresh token** — token berlaku 12 jam lalu pengguna login ulang. Hak akses aplikasi tetap dibaca ulang dari database setiap permintaan, jadi pencabutan berlaku seketika.
- **Logout terpusat (single logout)** — keluar dari portal tidak mengakhiri sesi di aplikasi yang sedang terbuka; token aplikasi berumur 12 jam dan disimpan di browser aplikasi itu.
