// apps/simklinik-web/src/app/api/sso/redeem/route.ts
//
// Jembatan antara browser pengguna dan Portal SIMKlinik.
//
// Halaman /sso memanggil route ini (same-origin, tanpa CORS). Route ini
// meneruskan permintaan ke server portal sambil menambahkan service key
// SIMKlinik. Service key tidak pernah sampai ke browser, dan browser hanya
// berbicara dengan satu origin — alamat portal tidak perlu diketahui frontend.
//
// Alur lengkapnya:
//   halaman /sso -> route ini -> server portal (tukar tiket) -> token SIMKlinik
//   lalu profil diambil dari backend SIMKlinik. Id dan peran di layanan
//   identitas tidak sama dengan tabel users SIMKlinik, dan halaman SIMKlinik
//   memakai id serta peran milik SIMKlinik. Backend juga menolak token bila
//   username portal tidak terdaftar di SIMKlinik, sehingga kegagalan itu
//   terlihat di sini, bukan di halaman pertama setelah login.
//
// Service key dibaca langsung dari file yang ditulis `npm run generate-key`.
// Tidak ada penyalinan kunci ke variabel lingkungan: satu sumber kebenaran
// berarti tidak ada kunci basi yang tertinggal setelah kunci dibuat ulang.

import { NextRequest, NextResponse } from 'next/server';
import { readFileSync } from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

function portalUrl(): string {
  return process.env.PORTAL_URL || 'http://127.0.0.1:8082';
}

function backendUrl(): string {
  return `http://127.0.0.1:${process.env.BACKEND_PORT || '4000'}`;
}

// Penanda mode: keberadaan .env.local (dibuat runner untuk mode development)
// berarti kunci dev yang dipakai. Sama seperti DatabaseService backend.
function serviceKey(): string | null {
  if (process.env.IDENTITY_SERVICE_KEY) return process.env.IDENTITY_SERVICE_KEY;

  const devMode = process.env.NODE_ENV === 'development';
  const suffix = devMode ? '-dev' : '';
  // runner.js mengisi KLINIK_ROOT; tanpa itu, Next.js berjalan dengan
  // cwd = apps/simklinik-web, dua tingkat di bawah root repo.
  const root = process.env.KLINIK_ROOT || path.resolve(process.cwd(), '..', '..');
  const keyFile =
    process.env.IDENTITY_SERVICE_KEY_FILE || path.join(root, 'secrets', 'service-keys', `simklinik${suffix}.key`);

  try {
    return readFileSync(keyFile, 'utf8').trim();
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  let body: { ticket?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: 'Permintaan tidak dapat dibaca.' }, { status: 400 });
  }

  if (!body.ticket) {
    return NextResponse.json({ message: 'Tiket login tidak ditemukan.' }, { status: 400 });
  }

  const key = serviceKey();
  if (!key) {
    return NextResponse.json(
      {
        message:
          'Service key SIMKlinik belum dibuat. Jalankan: npm run generate-key -- simklinik di services/identity, lalu buka ulang aplikasi ini dari portal.',
      },
      { status: 503 }
    );
  }

  let accessToken: string;
  try {
    const res = await fetch(`${portalUrl()}/api/sso/redeem`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-service-name': 'simklinik',
        'x-service-key': key,
      },
      body: JSON.stringify({ ticket: body.ticket }),
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) {
      return NextResponse.json({ message: await errorMessage(res) }, { status: res.status });
    }

    const redeemed = await res.json();
    if (!redeemed?.accessToken) {
      return NextResponse.json({ message: 'Portal tidak mengembalikan token sesi.' }, { status: 502 });
    }
    accessToken = redeemed.accessToken;
  } catch {
    return NextResponse.json(
      { message: 'Portal SIMKlinik tidak dapat dihubungi. Pastikan portal sedang berjalan.' },
      { status: 503 }
    );
  }

  let user: unknown;
  try {
    const res = await fetch(`${backendUrl()}/api/auth/profile`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) {
      return NextResponse.json({ message: await errorMessage(res) }, { status: res.status });
    }
    user = await res.json();
  } catch {
    return NextResponse.json(
      { message: 'Backend SIMKlinik tidak dapat dihubungi. Pastikan SIMKlinik sedang berjalan.' },
      { status: 503 }
    );
  }

  return NextResponse.json({ accessToken, user, portalUrl: portalUrl() });
}

async function errorMessage(res: Response): Promise<string> {
  try {
    const body = await res.json();
    if (body?.message) return Array.isArray(body.message) ? body.message.join(', ') : body.message;
  } catch {
    // Respons bukan JSON — pakai pesan bawaan.
  }
  return `Portal menolak tiket ini (HTTP ${res.status}).`;
}
