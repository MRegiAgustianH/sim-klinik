// apps/simklinik-web/src/lib/portal-url.ts
//
// Alamat portal yang dibuka browser staf.
//
// PORTAL_URL dari runner berisi 127.0.0.1, yang benar untuk panggilan antar
// server di komputer yang sama tetapi salah untuk browser di komputer lain:
// 127.0.0.1 di sana menunjuk komputer staf itu sendiri. Karena itu host
// diambil dari alamat yang dipakai browser untuk membuka SIMKlinik, dan hanya
// port (serta protokol) yang diambil dari PORTAL_URL.

import type { NextRequest } from 'next/server';

export function serverPortalUrl(): string {
  return process.env.PORTAL_URL || 'http://127.0.0.1:8082';
}

export function browserPortalUrl(request: NextRequest): string {
  const portal = new URL(serverPortalUrl());
  const host = (request.headers.get('x-forwarded-host') || request.headers.get('host') || '').split(',')[0].trim();
  const hostname = host ? new URL(`http://${host}`).hostname : portal.hostname;
  return `${portal.protocol}//${hostname}:${portal.port || (portal.protocol === 'https:' ? '443' : '80')}`;
}
