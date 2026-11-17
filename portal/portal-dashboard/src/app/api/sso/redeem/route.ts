// portal-dashboard/src/app/api/sso/redeem/route.ts
//
// Menukar tiket SSO menjadi token aplikasi. Dipanggil oleh server aplikasi
// tujuan (halaman /sso), bukan oleh browser secara langsung.
//
// Aplikasi pemanggil dikenali dari service key-nya, bukan dari header
// x-service-name. Header nama bisa ditulis apa pun oleh pemanggil; kunci tidak.
// Tanpa pemeriksaan ini, aplikasi mana pun bisa menukar tiket milik aplikasi
// lain dan pemisahan token antar aplikasi jadi tidak berarti.

import { NextRequest, NextResponse } from 'next/server';
import { redeemTicket } from '@/lib/sso-tickets';
import { appFromKey } from '@/lib/service-keys';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const headerKey = request.headers.get('x-service-key');
  const caller = appFromKey(headerKey);

  if (!caller) {
    return NextResponse.json({ message: 'Service key tidak valid atau belum dibuat.' }, { status: 401 });
  }

  let body: { ticket?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: 'Permintaan tidak dapat dibaca.' }, { status: 400 });
  }

  if (!body.ticket) {
    return NextResponse.json({ message: 'Tiket wajib dikirim.' }, { status: 400 });
  }

  const result = redeemTicket(body.ticket, caller);
  if (!result.ok) {
    const messages = {
      missing: 'Tiket tidak dikenal atau sudah dipakai.',
      expired: 'Tiket sudah kedaluwarsa. Silakan buka ulang dari portal.',
      'wrong-app': `Tiket ini bukan untuk aplikasi '${caller}'.`,
    } as const;
    const statuses = { missing: 404, expired: 410, 'wrong-app': 403 } as const;
    return NextResponse.json({ message: messages[result.reason] }, { status: statuses[result.reason] });
  }

  return NextResponse.json({ accessToken: result.appToken });
}
