// portal-dashboard/src/app/api/[...path]/route.ts
//
// Meneruskan /api/* ke layanan identitas.
//
// Sebelumnya ini dilakukan lewat `rewrites` di next.config.mjs. Masalahnya,
// tujuan rewrite ikut ter-compile saat `next build`, sehingga hasil build
// terpaku pada satu port. Portal production (identitas di 4010) lalu tidak bisa
// dipakai untuk mode development (identitas di 4011): semua permintaan diarahkan
// ke port yang salah dan gagal 500. Di sini port dibaca saat permintaan datang.
//
// Route handler yang lebih spesifik tetap menang: /api/sso/handoff dan
// /api/sso/redeem ditangani berkasnya masing-masing dan tidak diteruskan.

import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

function identityUrl(): string {
  return process.env.IDENTITY_SERVICE_URL || `http://127.0.0.1:${process.env.IDENTITY_PORT || '4010'}`;
}

// Header yang tidak boleh diteruskan apa adanya: host harus menunjuk tujuan,
// dan content-length dihitung ulang oleh fetch.
const STRIPPED_REQUEST_HEADERS = new Set([
  'host',
  'connection',
  'content-length',
  'accept-encoding',
]);

const STRIPPED_RESPONSE_HEADERS = new Set([
  'content-encoding',
  'content-length',
  'transfer-encoding',
  'connection',
]);

async function proxy(request: NextRequest, path: string[]): Promise<NextResponse> {
  const query = request.nextUrl.search;
  const url = `${identityUrl()}/api/${path.map(encodeURIComponent).join('/')}${query}`;

  const headers = new Headers();
  request.headers.forEach((value, key) => {
    if (!STRIPPED_REQUEST_HEADERS.has(key.toLowerCase())) headers.set(key, value);
  });

  // Body dibaca sebagai buffer: layanan identitas memakai JSON, dan membaca
  // sebagai teks bisa merusak karakter non-ASCII pada nama pasien.
  const method = request.method;
  const hasBody = method !== 'GET' && method !== 'HEAD';
  const body = hasBody ? await request.arrayBuffer() : undefined;

  let upstream: Response;
  try {
    upstream = await fetch(url, {
      method,
      headers,
      body,
      redirect: 'manual',
      signal: AbortSignal.timeout(15000),
    });
  } catch {
    // Kegagalan yang paling sering terjadi di klinik: layanan identitas belum
    // dinyalakan. Pesan dibuat jelas agar tidak tampak seperti error aplikasi.
    return NextResponse.json(
      {
        message:
          'Layanan identitas tidak dapat dihubungi. Pastikan portal dinyalakan lewat portal/runner.js, bukan hanya npm run start.',
      },
      { status: 503 }
    );
  }

  const responseHeaders = new Headers();
  upstream.headers.forEach((value, key) => {
    if (!STRIPPED_RESPONSE_HEADERS.has(key.toLowerCase())) responseHeaders.set(key, value);
  });

  return new NextResponse(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: responseHeaders,
  });
}

export async function GET(request: NextRequest, { params }: { params: { path: string[] } }) {
  return proxy(request, params.path);
}
export async function POST(request: NextRequest, { params }: { params: { path: string[] } }) {
  return proxy(request, params.path);
}
export async function PUT(request: NextRequest, { params }: { params: { path: string[] } }) {
  return proxy(request, params.path);
}
export async function PATCH(request: NextRequest, { params }: { params: { path: string[] } }) {
  return proxy(request, params.path);
}
export async function DELETE(request: NextRequest, { params }: { params: { path: string[] } }) {
  return proxy(request, params.path);
}
