// portal-dashboard/src/lib/sso-tickets.ts
//
// Tiket SSO sekali pakai. Diletakkan di modul tersendiri karena dipakai dua
// route handler (handoff dan redeem) yang harus melihat peta yang sama.
//
// Portal berjalan sebagai satu proses server di komputer klinik, sehingga
// memori proses adalah tempat yang tepat: tiket berumur 60 detik dan tidak
// boleh bertahan lebih lama dari itu.

export interface SsoTicket {
  appCode: string;
  appToken: string;
  expiresAt: number;
}

// Disimpan di globalThis agar tidak hilang bila bundler Next.js memuat modul
// lebih dari sekali (mis. saat fast refresh di mode development).
const store: Map<string, SsoTicket> = ((
  globalThis as unknown as { __portalSsoTickets?: Map<string, SsoTicket> }
).__portalSsoTickets ??= new Map<string, SsoTicket>());

export const TICKET_TTL_MS = 60_000;

export function issueTicket(ticket: SsoTicket) {
  sweepExpired(Date.now());
  store.set(ticket.appToken, ticket);
}

/**
 * Mengambil sekaligus menghapus tiket. Tiket yang tidak dikenali,
 * sudah kedaluwarsa, atau milik aplikasi lain tidak diberikan.
 */
export function redeemTicket(
  value: string,
  appCode: string
): { ok: true; appToken: string } | { ok: false; reason: 'missing' | 'expired' | 'wrong-app' } {
  const ticket = store.get(value);
  store.delete(value);

  if (!ticket) return { ok: false, reason: 'missing' };
  if (ticket.expiresAt <= Date.now()) return { ok: false, reason: 'expired' };
  if (ticket.appCode !== appCode) return { ok: false, reason: 'wrong-app' };

  return { ok: true, appToken: ticket.appToken };
}

function sweepExpired(now: number) {
  for (const [key, ticket] of store) {
    if (ticket.expiresAt <= now) store.delete(key);
  }
}
