import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { IS_DEV, SERVICE_KEYS_DIR } from '../config/paths';

// Klien ke layanan identitas (services/identity, port 4010).
//
// Sistem surat tidak punya tabel pengguna atau pasien sendiri: login, izin
// fitur, dan data pasien untuk surat keluar semuanya dibaca dari sini.
@Injectable()
export class IdentityClient {
  private readonly logger = new Logger(IdentityClient.name);
  private readonly baseUrl = process.env.IDENTITY_SERVICE_URL || 'http://127.0.0.1:4010';
  private readonly serviceName = 'surat';
  private readonly serviceKey = resolveServiceKey();
  private readonly timeoutMs = 5000;

  private async request<T>(urlPath: string, init: RequestInit = {}): Promise<T> {
    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}${urlPath}`, {
        ...init,
        headers: {
          'Content-Type': 'application/json',
          ...(this.serviceKey ? { 'x-service-name': this.serviceName, 'x-service-key': this.serviceKey } : {}),
          ...(init.headers as Record<string, string>),
        },
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch (err) {
      this.logger.error(`Layanan identitas tidak terjangkau: ${err instanceof Error ? err.message : String(err)}`);
      throw new ServiceUnavailableException(
        'Layanan identitas (services/identity, port 4010) tidak dapat dihubungi. Nyalakan layanan tersebut lalu coba lagi.'
      );
    }

    const text = await response.text();
    const body = text ? safeJson(text) : null;
    if (!response.ok) {
      const raw = body && typeof body === 'object' && 'message' in body ? (body as { message: unknown }).message : null;
      const message = Array.isArray(raw)
        ? raw.join(', ')
        : raw
          ? String(raw)
          : `Layanan identitas menolak permintaan (HTTP ${response.status}).`;
      throw new IdentityError(response.status, message);
    }
    return body as T;
  }

  /** Login dengan akun portal; token langsung diterbitkan untuk aplikasi surat. */
  login(username: string, password: string) {
    return this.request<{ accessToken: string }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password, audience: 'surat' }),
    });
  }

  /** Profil + fitur yang boleh dipakai di aplikasi surat. */
  me(token: string) {
    return this.request<IdentityMe>('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } });
  }

  changePassword(token: string, oldPassword: string, newPassword: string) {
    return this.request<{ message: string }>('/api/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ oldPassword, newPassword }),
      headers: { Authorization: `Bearer ${token}` },
    });
  }

  /** Mendaftarkan daftar fitur aplikasi surat agar bisa dicentang di portal. */
  registerCatalog(catalog: { permissions: unknown[]; presets: unknown[] }) {
    if (!this.serviceKey) {
      return Promise.reject(new Error('service key surat belum dibuat (npm run generate-key -- surat di services/identity)'));
    }
    return this.request<unknown>('/api/apps/service/catalog', { method: 'PUT', body: JSON.stringify(catalog) });
  }

  // Data pasien dibaca memakai token pengguna sendiri, sehingga hak akses
  // tetap diperiksa layanan identitas untuk setiap permintaan.
  searchPatients(q: string, token: string) {
    const params = new URLSearchParams({ q, limit: '15' });
    return this.request<{ total: number; data: IdentityPatient[] }>(`/api/patients?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
  }

  getPatient(id: number, token: string) {
    return this.request<IdentityPatient>(`/api/patients/${id}`, { headers: { Authorization: `Bearer ${token}` } });
  }
}

export interface IdentityMe {
  id: number;
  username: string;
  fullName: string;
  role: string;
  apps: string[];
  isSuperadmin: boolean;
  permissions: string[];
}

export interface IdentityPatient {
  id: number;
  nik: string | null;
  fullName: string;
  gender: string;
  birthPlace: string | null;
  birthDate: string | null;
  email: string | null;
  address: string | null;
  phoneWa: string | null;
  occupation: string | null;
  maritalStatus: string | null;
  age: number | null;
}

export class IdentityError extends Error {
  constructor(
    public readonly status: number,
    message: string
  ) {
    super(message);
    this.name = 'IdentityError';
  }
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

// Kunci layanan: variabel lingkungan IDENTITY_SERVICE_KEY, atau file
// secrets/service-keys/surat(-dev).key yang ditulis `npm run generate-key`.
function resolveServiceKey(): string {
  if (process.env.IDENTITY_SERVICE_KEY) return process.env.IDENTITY_SERVICE_KEY.trim();
  const file = path.join(SERVICE_KEYS_DIR, IS_DEV ? 'surat-dev.key' : 'surat.key');
  try {
    return fs.readFileSync(file, 'utf8').trim();
  } catch {
    return '';
  }
}
