// apps/simklinik-web/src/app/api/portal-info/route.ts
//
// Alamat portal untuk tombol "Portal SIMKlinik" dan "Kelola Pengguna", juga
// bagi staf yang login langsung di SIMKlinik tanpa lewat portal.

import { NextRequest, NextResponse } from 'next/server';
import { browserPortalUrl } from '@/lib/portal-url';

export const dynamic = 'force-dynamic';

export function GET(request: NextRequest) {
  return NextResponse.json({ portalUrl: browserPortalUrl(request) });
}
