// portal-dashboard/src/lib/service-keys.ts
//
// Service key antar-layanan.
//
// Setiap aplikasi punya kunci sendiri yang ditulis `npm run generate-key` ke
// data/service-keys/. Portal memakai kuncinya untuk dua hal: menukar token
// portal menjadi token aplikasi (/api/auth/mint), dan mengenali aplikasi mana
// yang menukar tiket SSO (/api/sso/redeem).
//
// Kunci tidak pernah dikirim ke browser.

import { readFileSync } from 'fs';
import path from 'path';

/** Kode aplikasi yang dikenal sistem. Harus sama dengan APP_CODES di layanan identitas. */
export const KNOWN_APPS = ['portal', 'simklinik', 'surat', 'laporan'] as const;
export type KnownApp = (typeof KNOWN_APPS)[number];

export function identityUrl(): string {
  return process.env.IDENTITY_SERVICE_URL || `http://127.0.0.1:${process.env.IDENTITY_PORT || '4010'}`;
}

function keyFilePath(app: KnownApp): string {
  // Penanda mode sama dengan seluruh aplikasi klinik: .env.local = development.
  // Kunci dev berakhiran -dev agar uji coba tidak memakai kunci production.
  const suffix = process.env.IDENTITY_MODE === 'development' ? '-dev' : '';
  return path.join(process.cwd(), '..', 'identity-service', 'data', 'service-keys', `${app}${suffix}.key`);
}

export function serviceKeyOf(app: KnownApp): string | null {
  // Hanya portal yang boleh membaca kunci dari variabel lingkungan: portal
  // memegang kuncinya sendiri dan tidak perlu membaca kunci aplikasi lain.
  if (app === 'portal' && process.env.IDENTITY_SERVICE_KEY) {
    return process.env.IDENTITY_SERVICE_KEY;
  }
  try {
    return readFileSync(keyFilePath(app), 'utf8').trim();
  } catch {
    return null;
  }
}

/**
 * Menentukan aplikasi pemanggil dari service key-nya.
 *
 * Header x-service-name saja tidak cukup dipercaya: pemanggil bisa menulis
 * nama apa pun. Dengan mencocokkan kunci terhadap file setiap aplikasi, hanya
 * pemegang kunci itu yang dikenali — inilah yang membuat tiket SSO tidak bisa
 * ditebus aplikasi lain.
 */
export function appFromKey(apiKey: string | null): KnownApp | null {
  if (!apiKey) return null;
  for (const app of KNOWN_APPS) {
    const expected = serviceKeyOf(app);
    if (expected && expected === apiKey) return app;
  }
  return null;
}
