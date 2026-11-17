// portal-dashboard/src/lib/sso.ts
//
// Perpindahan dari portal ke aplikasi klinik lain.
//
// Dua syarat harus terpenuhi sebelum staf boleh masuk ke aplikasi tujuan:
//   1. portal tahu aplikasi itu memang hidup (agar tidak terbuka halaman error);
//   2. portal menukar token portal menjadi token bertanda aud aplikasi itu.
//
// Langkah 2 dilakukan lewat endpoint /api/auth/mint di layanan identitas.
// Endpoint itu butuh service key portal. Karena browser tidak boleh memegang
// service key, penukaran dilakukan oleh route handler Next.js di
// /api/sso/handoff (lihat src/app/api/sso/handoff/route.ts).

export interface HandoffResult {
  ticket: string;
  redirectUrl: string;
  appName: string;
}

export interface SsoApp {
  code: string;
  name: string;
  frontendUrl: string | null;
  backendUrl: string | null;
  status: string;
}

/**
 * Meminta tiket sekali pakai untuk membuka aplikasi tujuan.
 * Token portal dikirim ke route handler milik portal sendiri (same-origin),
 * bukan ke layanan identitas secara langsung.
 */
export async function requestHandoff(
  appCode: string,
  portalToken: string
): Promise<HandoffResult> {
  const res = await fetch('/api/sso/handoff', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ appCode, portalToken }),
  });

  if (!res.ok) {
    let message = `Tidak dapat membuka aplikasi (HTTP ${res.status}).`;
    try {
      const body = await res.json();
      if (body?.message) {
        message = Array.isArray(body.message) ? body.message.join(', ') : body.message;
      }
    } catch {
      // Biarkan pesan bawaan bila respons bukan JSON.
    }
    throw new Error(message);
  }

  return (await res.json()) as HandoffResult;
}
