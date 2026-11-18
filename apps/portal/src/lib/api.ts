// apps/portal/src/lib/api.ts

// Browser memakai path relatif: Next.js rewrite meneruskan /api/* ke layanan
// identitas (lihat next.config.mjs), jadi satu-satunya port yang perlu
// diketahui browser adalah port portal itu sendiri.
export function getApiBaseUrl(): string {
  if (typeof window !== 'undefined') {
    return '';
  }
  return process.env.NEXT_PUBLIC_IDENTITY_URL || `http://127.0.0.1:${process.env.IDENTITY_PORT || '4010'}`;
}

export interface ApiFetchOptions extends RequestInit {
  token?: string | null;
}

export async function apiFetch<T = unknown>(endpoint: string, options: ApiFetchOptions = {}): Promise<T> {
  const baseUrl = getApiBaseUrl();
  const url = `${baseUrl}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  const token = options.token ?? (typeof window !== 'undefined' ? localStorage.getItem('portal_token') : null);
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(url, { ...options, headers });

  if (!res.ok) {
    let errorMessage = `HTTP Error ${res.status}: ${res.statusText}`;
    try {
      const errJson = await res.json();
      if (errJson && errJson.message) {
        errorMessage = Array.isArray(errJson.message) ? errJson.message.join(', ') : errJson.message;
      }
    } catch {
      // Respons bukan JSON (mis. layanan mati) — pesan bawaan dipertahankan.
    }
    throw new Error(errorMessage);
  }

  const contentType = res.headers.get('content-type');
  if (contentType && (contentType.includes('application/pdf') || contentType.includes('octet-stream'))) {
    return res.blob() as unknown as T;
  }

  return res.json() as Promise<T>;
}
