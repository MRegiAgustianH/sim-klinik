import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService, SqliteParam } from '../database/database.service';
import { AuthUser } from '../auth/jwt.strategy';

export interface AppRow {
  id: number;
  code: string;
  name: string;
  description: string | null;
  frontendUrl: string | null;
  backendUrl: string | null;
  icon: string | null;
  sortOrder: number;
  isActive: number;
}

export interface HealthStatus {
  code: string;
  name: string;
  frontendUrl: string | null;
  backendUrl: string | null;
  status: 'aktif' | 'tidak aktif' | 'tidak dapat dihubungi' | 'url belum diisi';
  httpStatus: number | null;
  latencyMs: number | null;
}

const HEALTH_TIMEOUT_MS = 2500;

@Injectable()
export class AppsService {
  constructor(private readonly db: DatabaseService) {}

  private findActive(): AppRow[] {
    return this.db.query<AppRow>(
      'SELECT * FROM app_registry WHERE isActive = 1 ORDER BY sortOrder ASC, name ASC'
    );
  }

  // Daftar untuk portal: hanya app yang boleh dibuka pengguna ini. Penyaringan
  // dilakukan di sini, bukan di frontend, agar app yang tidak berhak tidak
  // pernah sampai ke browser.
  listForUser(user: AuthUser) {
    const apps = user.role === 'Superadmin' ? this.findActive() : this.findActive().filter((app) => user.apps.includes(app.code));
    return { data: apps };
  }

  listAll() {
    const apps = this.db.query<AppRow & { updatedAt: string }>(
      'SELECT * FROM app_registry ORDER BY sortOrder ASC, name ASC'
    );
    return { data: apps };
  }

  // Untuk pemanggil antar-layanan (portal saat menukar tiket SSO). Berisi
  // aplikasi aktif saja: aplikasi yang dinonaktifkan tidak boleh menjadi
  // tujuan pengalihan.
  listForService() {
    return { data: this.findActive() };
  }

  findOne(code: string) {
    const app = this.db.get<AppRow>('SELECT * FROM app_registry WHERE code = ?', [code]);
    if (!app) {
      throw new NotFoundException(`Aplikasi '${code}' belum terdaftar di portal.`);
    }
    return app;
  }

  upsert(body: {
    code: string;
    name: string;
    description?: string;
    frontendUrl?: string;
    backendUrl?: string;
    icon?: string;
    sortOrder?: number;
    isActive?: number;
  }) {
    const existing = this.db.get<{ id: number }>('SELECT id FROM app_registry WHERE code = ?', [body.code]);

    const params: SqliteParam[] = [
      body.name,
      body.description ?? null,
      body.frontendUrl ?? null,
      body.backendUrl ?? null,
      body.icon ?? null,
      body.sortOrder ?? 0,
      body.isActive ?? 1,
    ];

    if (existing) {
      this.db.run(
        `UPDATE app_registry SET name = ?, description = ?, frontendUrl = ?, backendUrl = ?,
         icon = ?, sortOrder = ?, isActive = ?, updatedAt = CURRENT_TIMESTAMP WHERE code = ?`,
        [...params, body.code]
      );
    } else {
      this.db.run(
        `INSERT INTO app_registry (name, description, frontendUrl, backendUrl, icon, sortOrder, isActive, code)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [...params, body.code]
      );
    }

    return this.findOne(body.code);
  }

  // Status dihitung saat diminta. Portal memanggil ini untuk menampilkan app
  // mana yang sedang hidup; kegagalan satu app tidak boleh menggagalkan yang lain.
  async health(): Promise<{ data: HealthStatus[] }> {
    const apps = this.findActive();
    const results = await Promise.all(apps.map((app) => this.checkOne(app)));
    return { data: results };
  }

  private async checkOne(app: AppRow): Promise<HealthStatus> {
    const base: HealthStatus = {
      code: app.code,
      name: app.name,
      frontendUrl: app.frontendUrl,
      backendUrl: app.backendUrl,
      status: 'url belum diisi',
      httpStatus: null,
      latencyMs: null,
    };

    if (!app.backendUrl) return base;

    const startedAt = Date.now();
    try {
      const response = await fetch(`${app.backendUrl.replace(/\/$/, '')}/api/health`, {
        signal: AbortSignal.timeout(HEALTH_TIMEOUT_MS),
      });
      return {
        ...base,
        status: response.ok ? 'aktif' : 'tidak aktif',
        httpStatus: response.status,
        latencyMs: Date.now() - startedAt,
      };
    } catch {
      return { ...base, status: 'tidak dapat dihubungi', latencyMs: Date.now() - startedAt };
    }
  }
}
