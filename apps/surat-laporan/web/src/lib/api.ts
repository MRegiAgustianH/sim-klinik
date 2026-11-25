// Panggilan ke backend sistem surat. Path relatif memakai rewrite Next.js:
// browser -> :8084/api/... -> backend 127.0.0.1:4002/api/...

export const TOKEN_KEY = 'surat_token';
export const USER_KEY = 'surat_user';
export const PORTAL_URL_KEY = 'surat_portal_url';

export interface ApiFetchOptions extends RequestInit {
  token?: string | null;
}

export async function apiFetch<T = unknown>(endpoint: string, options: ApiFetchOptions = {}): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  const token = options.token ?? (typeof window !== 'undefined' ? localStorage.getItem(TOKEN_KEY) : null);
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(endpoint, { ...options, headers });
  if (!res.ok) {
    let message = `Permintaan gagal (HTTP ${res.status}).`;
    try {
      const body = await res.json();
      if (body?.message) message = Array.isArray(body.message) ? body.message.join(', ') : body.message;
    } catch {
      // bukan JSON
    }
    if (res.status === 502 || res.status === 504) message = 'Backend sistem surat tidak dapat dihubungi. Pastikan sudah dijalankan lewat JALANKAN.bat.';
    throw Object.assign(new Error(message), { status: res.status });
  }
  const text = await res.text();
  return (text ? JSON.parse(text) : null) as T;
}

/** Mengunggah gambar (dari editor atau form kop) dan mengembalikan URL-nya. */
export function uploadImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Gambar tidak dapat dibaca.'));
    reader.onload = async () => {
      try {
        const res = await apiFetch<{ url: string }>('/api/uploads', {
          method: 'POST',
          body: JSON.stringify({ dataUrl: reader.result }),
        });
        resolve(res.url);
      } catch (err) {
        reject(err);
      }
    };
    reader.readAsDataURL(file);
  });
}

export function errorMessage(err: unknown, fallback = 'Terjadi kesalahan.'): string {
  return err instanceof Error ? err.message : fallback;
}
