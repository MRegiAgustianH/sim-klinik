// apps/portal/src/app/api/sso/handoff/route.ts
//
// Penukaran token portal menjadi token aplikasi tujuan.
//
// Endpoint /api/auth/mint di layanan identitas hanya menerima service key, dan
// service key tidak boleh sampai ke browser. Karena itu penukaran dilakukan di
// server portal ini: browser mengirim token portal (same-origin), server
// menambahkan service key, lalu mengembalikan URL pengalihan.
//
// Yang dikembalikan bukan token, melainkan tiket sekali pakai. Alasannya:
// token 12 jam yang tertinggal di riwayat browser atau log akses server adalah
// kebocoran yang tidak perlu. Tiket mati setelah dipakai atau setelah 60 detik.

import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { issueTicket, TICKET_TTL_MS } from '@/lib/sso-tickets';
import { identityUrl, serviceKeyOf } from '@/lib/service-keys';
import { browserFacingUrl } from '@/lib/browser-url';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  let body: { appCode?: string; portalToken?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: 'Permintaan tidak dapat dibaca.' }, { status: 400 });
  }

  const { appCode, portalToken } = body;
  if (!appCode || !portalToken) {
    return NextResponse.json({ message: 'appCode dan portalToken wajib dikirim.' }, { status: 400 });
  }

  const key = serviceKeyOf('portal');
  if (!key) {
    return NextResponse.json({ message: 'Service key portal belum dibuat. Jalankan npm run generate-key -- portal --portal di services/identity.' }, { status: 503 });
  }

  let minted: { accessToken?: string };
  try {
    const res = await fetch(`${identityUrl()}/api/auth/mint`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-service-name': 'portal',
        'x-service-key': key,
        'x-target-aud': appCode,
      },
      body: JSON.stringify({ token: portalToken }),
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) {
      // Layanan identitas yang memutuskan apakah akun ini berhak membuka app
      // tersebut, dan pesannya sudah spesifik — diteruskan apa adanya.
      return NextResponse.json({ message: await errorMessage(res) }, { status: res.status });
    }

    minted = await res.json();
  } catch {
    return NextResponse.json(
      { message: 'Layanan identitas tidak dapat dihubungi. Pastikan portal dijalankan lewat portal/runner.js.' },
      { status: 503 }
    );
  }

  if (!minted.accessToken) {
    return NextResponse.json({ message: 'Layanan identitas tidak mengembalikan token.' }, { status: 502 });
  }

  // Alamat tujuan diambil dari app_registry lewat endpoint daftar aplikasi,
  // bukan dari body permintaan. Kalau diambil dari body, siapa pun yang bisa
  // memanggil route ini dapat mengarahkan staf ke situs lain bersama tokennya.
  // Dengan cara ini hanya aplikasi yang terdaftar di portal yang bisa menjadi
  // tujuan pengalihan.
  const target = await resolveApp(appCode, key);
  if ('error' in target) {
    return NextResponse.json({ message: target.error }, { status: target.status });
  }

  const ticket = randomBytes(32).toString('hex');
  issueTicket(ticket, { appCode, appToken: minted.accessToken, expiresAt: Date.now() + TICKET_TTL_MS });

  // Halaman /sso di aplikasi tujuan menukar tiket ini menjadi token. Token
  // tidak pernah muncul di URL, jadi riwayat browser dan log akses server
  // tetap bersih meski tautannya tersalin ke mana-mana.
  //
  // localhost di daftar aplikasi diganti alamat yang dipakai browser staf
  // untuk membuka portal, agar tombol Buka juga berfungsi dari PC lain di
  // jaringan klinik (lihat lib/browser-url.ts).
  const frontendUrl = browserFacingUrl(target.frontendUrl, request);
  const separator = frontendUrl.includes('?') ? '&' : '?';
  return NextResponse.json({
    ticket,
    appName: target.name,
    redirectUrl: `${frontendUrl.replace(/\/$/, '')}/sso${separator}sso_ticket=${ticket}`,
  });
}

async function resolveApp(
  appCode: string,
  key: string
): Promise<{ name: string; frontendUrl: string } | { error: string; status: number }> {
  // Memakai endpoint antar-layanan GET /api/apps/service/list. GET
  // /api/apps/:code tidak bisa dipakai di jalur ini karena hanya menerima
  // token pengguna Superadmin, sedangkan di sini yang dikirim service key.
  // (Kesalahan itu dulu dilaporkan sebagai "aplikasi tidak terdaftar", padahal
  // aplikasinya ada dan kartunya tampil aktif di beranda.)
  try {
    const res = await fetch(`${identityUrl()}/api/apps/service/list`, {
      headers: {
        'Content-Type': 'application/json',
        'x-service-name': 'portal',
        'x-service-key': key,
      },
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) {
      // Status dibedakan agar tidak tertukar dengan "aplikasi tidak ada":
      // 401/403 berarti service key bermasalah, bukan aplikasinya.
      const reason =
        res.status === 401 || res.status === 403
          ? 'Service key portal ditolak layanan identitas. Buat ulang dengan npm run generate-key -- portal --portal.'
          : `Gagal membaca daftar aplikasi portal (HTTP ${res.status}).`;
      return { error: reason, status: res.status === 401 || res.status === 403 ? 502 : 503 };
    }

    const body = await res.json();
    const app = (body?.data ?? []).find((item: { code: string }) => item.code === appCode);

    if (!app) {
      return { error: `Aplikasi '${appCode}' tidak terdaftar di portal.`, status: 404 };
    }
    if (app.isActive !== 1) {
      return { error: `Aplikasi '${appCode}' sedang dinonaktifkan di portal.`, status: 409 };
    }
    if (!app.frontendUrl) {
      return { error: `Alamat aplikasi '${appCode}' belum diisi di portal.`, status: 409 };
    }

    return { name: app.name || appCode, frontendUrl: app.frontendUrl };
  } catch {
    return { error: 'Layanan identitas tidak dapat dihubungi.', status: 503 };
  }
}

async function errorMessage(res: Response): Promise<string> {
  try {
    const body = await res.json();
    if (body?.message) return Array.isArray(body.message) ? body.message.join(', ') : body.message;
  } catch {
    // Respons bukan JSON — pakai pesan bawaan.
  }
  return `Layanan identitas menolak permintaan (HTTP ${res.status}).`;
}
