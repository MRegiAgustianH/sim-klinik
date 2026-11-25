// apps/portal/src/lib/browser-url.ts
//
// Alamat aplikasi yang dibuka browser staf.
//
// Daftar aplikasi (menu Aplikasi) berisi alamat seperti http://localhost:8080.
// Alamat itu benar untuk komputer server, tetapi salah untuk PC lain di
// jaringan: di sana "localhost" berarti PC staf itu sendiri, sehingga tombol
// Buka Aplikasi gagal. Karena itu, bila alamatnya menunjuk ke komputer ini
// (localhost / 127.0.0.1 / 0.0.0.0 / ::1), host diganti dengan host yang
// dipakai browser untuk membuka portal — mis. 192.168.1.10 — dan hanya port
// serta protokol yang diambil dari daftar aplikasi. Pola yang sama dengan
// apps/simklinik-web/src/lib/portal-url.ts.
//
// Alamat yang sengaja diisi Superadmin dengan IP atau nama host lain tidak
// diubah sama sekali.

import type { NextRequest } from 'next/server';

const LOOPBACK = new Set(['localhost', '127.0.0.1', '0.0.0.0', '::1', '[::1]']);

export function browserFacingUrl(configuredUrl: string, request: NextRequest): string {
  let target: URL;
  try {
    target = new URL(configuredUrl);
  } catch {
    return configuredUrl;
  }
  if (!LOOPBACK.has(target.hostname)) return configuredUrl;

  const host = (request.headers.get('x-forwarded-host') || request.headers.get('host') || '').split(',')[0].trim();
  if (!host) return configuredUrl;

  let browserHost: string;
  try {
    browserHost = new URL(`http://${host}`).hostname;
  } catch {
    return configuredUrl;
  }

  target.hostname = browserHost;
  return target.toString().replace(/\/$/, '');
}
