// client/src/lib/api.ts

export function getApiBaseUrl(): string {
  if (typeof window !== 'undefined') {
    // Relative path memanfaatkan reverse-proxy Next.js rewrites:
    // browser -> port 8080/api/... -> Next.js forward ke backend 127.0.0.1:4000/api/...
    return '';
  }
  return process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:4000';
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

  const token = options.token ?? (typeof window !== 'undefined' ? localStorage.getItem('vaksinku_token') : null);
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(url, {
    ...options,
    headers,
  });

  if (!res.ok) {
    let errorMessage = `HTTP Error ${res.status}: ${res.statusText}`;
    try {
      const errJson = await res.json();
      if (errJson && errJson.message) {
        errorMessage = Array.isArray(errJson.message) ? errJson.message.join(', ') : errJson.message;
      }
    } catch {
      // fallback jika bukan JSON
    }
    throw new Error(errorMessage);
  }

  // Jika response berupa blob / file stream
  const contentType = res.headers.get('content-type');
  if (contentType && (contentType.includes('application/pdf') || contentType.includes('spreadsheetml') || contentType.includes('octet-stream'))) {
    return res.blob() as unknown as T;
  }

  return res.json() as Promise<T>;
}
