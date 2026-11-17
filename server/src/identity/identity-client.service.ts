import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

// Klien ke layanan identitas (portal/identity-service, port 4010).
//
// Mode yang dipilih klinik: SIMKlinik GAGAL CEPAT bila layanan identitas tidak
// terjangkau. Pasien tidak bisa didaftarkan saat layanan mati, dan itu memang
// disengaja — lebih baik pendaftaran berhenti daripada dua sumber data pasien
// yang nanti harus digabung manual.
@Injectable()
export class IdentityClient {
  private readonly logger = new Logger(IdentityClient.name);

  private readonly baseUrl =
    process.env.IDENTITY_SERVICE_URL || 'http://127.0.0.1:4010';

  private readonly serviceName = process.env.IDENTITY_SERVICE_NAME || 'simklinik';

  // Kunci dibaca dari variabel lingkungan, atau dari file kunci milik mode ini.
  // File dipakai karena runner.js menyalakan server tanpa terminal interaktif,
  // jadi kunci tidak bisa diketik saat start.
  private readonly serviceKey = resolveServiceKey();

  // Timeout pendek: layanan berada di komputer yang sama, jadi respons di atas
  // beberapa detik berarti ada masalah, bukan beban tinggi.
  private readonly timeoutMs = 5000;

  get isConfigured(): boolean {
    return this.serviceKey.length > 0;
  }

  get serviceKeySource(): string {
    if (process.env.IDENTITY_SERVICE_KEY) return 'variabel lingkungan IDENTITY_SERVICE_KEY';
    return 'file portal/identity-service/data/service-keys/<mode>.key';
  }

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    if (!this.isConfigured) {
      throw new ServiceUnavailableException(
        'IDENTITY_SERVICE_KEY belum diset di server. Jalankan: npm run generate-key -- simklinik di folder portal/identity-service, lalu isi kunci tersebut di variabel lingkungan server.'
      );
    }

    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}${path}`, {
        ...init,
        headers: {
          'Content-Type': 'application/json',
          'x-service-name': this.serviceName,
          'x-service-key': this.serviceKey,
          ...(init.headers as Record<string, string>),
        },
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch (err) {
      this.logger.error(`Layanan identitas tidak terjangkau: ${err instanceof Error ? err.message : String(err)}`);
      throw new ServiceUnavailableException(
        'Layanan identitas (portal/identity-service, port 4010) tidak dapat dihubungi. Nyalakan layanan tersebut lalu coba lagi.'
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
      // Status asli diteruskan supaya staf menerima pesan yang tepat
      // (mis. "NIK sudah terdaftar" sebagai 409, bukan error umum 500).
      throw new IdentityError(response.status, message);
    }

    return body as T;
  }

  // Mencari pasien yang sudah ada. Dipanggil sebelum mendaftarkan pasien baru
  // agar NIK yang sama tidak menghasilkan dua identitas.
  async searchPatients(query: string, token: string) {
    const params = new URLSearchParams({ q: query, limit: '10' });
    return this.request<{ total: number; data: IdentityPatient[] }>(`/api/patients?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
  }

  async createPatient(payload: CreateIdentityPatient, token: string): Promise<IdentityPatient> {
    return this.request<IdentityPatient>('/api/patients', {
      method: 'POST',
      body: JSON.stringify(payload),
      headers: { Authorization: `Bearer ${token}` },
    });
  }

  async getPatient(id: number, token: string): Promise<IdentityPatient> {
    return this.request<IdentityPatient>(`/api/patients/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
  }

  async health() {
    return this.request<{ status: string; users: number; patients: number }>('/api/health');
  }
}

// Error dari layanan identitas membawa status HTTP aslinya supaya controller
// bisa meneruskan kode yang tepat (409 untuk NIK ganda, 400 untuk format salah).
export class IdentityError extends Error {
  constructor(
    public readonly status: number,
    message: string
  ) {
    super(message);
    this.name = 'IdentityError';
  }
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
  // App yang pertama kali mendaftarkan pasien ini, mis. 'simklinik'.
  // Dipakai agar staf tahu asal data, bukan mengira pasien pernah datang
  // ke layanan yang sedang dibukanya.
  sourceApp?: string | null;
}

export interface CreateIdentityPatient {
  nik?: string;
  fullName: string;
  gender: string;
  birthPlace?: string;
  birthDate?: string;
  email?: string;
  address?: string;
  phoneWa?: string;
  occupation?: string;
  maritalStatus?: string;
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

// Kunci layanan dibaca dari, berurutan:
//   1. variabel lingkungan IDENTITY_SERVICE_KEY (cara paling eksplisit)
//   2. server/.identity-key          (khusus SIMKlinik)
//   3. portal/identity-service/data/service-keys/simklinik.key
// Mode dev dan production memakai file berbeda, sama seperti database.
function resolveServiceKey(): string {
  if (process.env.IDENTITY_SERVICE_KEY) {
    return process.env.IDENTITY_SERVICE_KEY.trim();
  }

  const isDev = fs.existsSync(path.join(process.cwd(), '.env.local'));
  const candidates = [
    path.join(process.cwd(), '.identity-key'),
    path.resolve(
      process.cwd(),
      '..',
      'portal',
      'identity-service',
      'data',
      'service-keys',
      isDev ? 'simklinik-dev.key' : 'simklinik.key'
    ),
  ];

  for (const file of candidates) {
    try {
      if (fs.existsSync(file)) {
        const key = fs.readFileSync(file, 'utf8').trim();
        if (key.length > 0) return key;
      }
    } catch {
      // file tidak terbaca: lanjut ke kandidat berikutnya
    }
  }

  return '';
}
