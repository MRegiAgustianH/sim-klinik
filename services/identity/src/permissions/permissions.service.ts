import { Injectable, BadRequestException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

export interface PermissionDef {
  code: string;
  label: string;
  group?: string;
  description?: string;
}

export interface PresetDef {
  code: string;
  label: string;
  permissions: string[];
}

export interface AppCatalog {
  appCode: string;
  permissions: PermissionDef[];
  presets: PresetDef[];
}

const CODE_PATTERN = /^[a-z][a-z0-9_.-]{1,63}$/;

// Hak akses fitur per aplikasi.
//
// Katalog fitur milik aplikasi: setiap aplikasi mendaftarkannya sendiri saat
// start (lihat registerCatalog), karena hanya aplikasi itu yang tahu fitur
// apa yang ia punya. Layanan identitas hanya menyimpan katalog dan centang
// per orang, lalu menjawab "fitur apa yang boleh dipakai orang ini di app X".
//
// Superadmin selalu boleh semua fitur di semua aplikasi dan tidak disimpan di
// user_permissions, sama seperti akses aplikasinya.
@Injectable()
export class PermissionsService {
  constructor(private readonly db: DatabaseService) {}

  registerCatalog(appCode: string, permissions: PermissionDef[], presets: PresetDef[]): AppCatalog {
    if (!Array.isArray(permissions) || permissions.length === 0) {
      throw new BadRequestException('Katalog fitur kosong.');
    }
    const codes = new Set<string>();
    for (const p of permissions) {
      if (!p || typeof p.code !== 'string' || !CODE_PATTERN.test(p.code) || typeof p.label !== 'string' || !p.label.trim()) {
        throw new BadRequestException(`Fitur tidak valid: ${JSON.stringify(p)}`);
      }
      if (codes.has(p.code)) throw new BadRequestException(`Kode fitur ganda: ${p.code}`);
      codes.add(p.code);
    }
    for (const preset of presets ?? []) {
      if (!preset || !CODE_PATTERN.test(String(preset.code)) || !Array.isArray(preset.permissions)) {
        throw new BadRequestException(`Preset tidak valid: ${JSON.stringify(preset)}`);
      }
      const unknown = preset.permissions.filter((code) => !codes.has(code));
      if (unknown.length > 0) {
        throw new BadRequestException(`Preset '${preset.code}' memuat fitur tak dikenal: ${unknown.join(', ')}`);
      }
    }

    // Katalog diganti utuh. Centang yang sudah diberikan ke pengguna tidak
    // dihapus walaupun kodenya hilang dari katalog: bila aplikasi sempat
    // mengirim katalog yang keliru, hak akses staf tidak ikut lenyap.
    const db = this.db.getDb();
    db.exec('BEGIN');
    try {
      this.db.run('DELETE FROM app_permissions WHERE appCode = ?', [appCode]);
      this.db.run('DELETE FROM app_permission_presets WHERE appCode = ?', [appCode]);
      permissions.forEach((p, index) => {
        this.db.run(
          'INSERT INTO app_permissions (appCode, code, label, groupName, description, sortOrder) VALUES (?, ?, ?, ?, ?, ?)',
          [appCode, p.code, p.label.trim(), p.group ?? null, p.description ?? null, index]
        );
      });
      (presets ?? []).forEach((preset, index) => {
        this.db.run(
          'INSERT INTO app_permission_presets (appCode, code, label, permissions, sortOrder) VALUES (?, ?, ?, ?, ?)',
          [appCode, preset.code, preset.label, JSON.stringify([...new Set(preset.permissions)]), index]
        );
      });
      db.exec('COMMIT');
    } catch (err) {
      db.exec('ROLLBACK');
      throw err;
    }
    return this.getCatalog(appCode);
  }

  getCatalog(appCode: string): AppCatalog {
    const permissions = this.db
      .query<{ code: string; label: string; groupName: string | null; description: string | null }>(
        'SELECT code, label, groupName, description FROM app_permissions WHERE appCode = ? ORDER BY sortOrder, code',
        [appCode]
      )
      .map((row) => ({
        code: row.code,
        label: row.label,
        group: row.groupName ?? undefined,
        description: row.description ?? undefined,
      }));
    const presets = this.db
      .query<{ code: string; label: string; permissions: string }>(
        'SELECT code, label, permissions FROM app_permission_presets WHERE appCode = ? ORDER BY sortOrder, code',
        [appCode]
      )
      .map((row) => ({ code: row.code, label: row.label, permissions: safeArray(row.permissions) }));
    return { appCode, permissions, presets };
  }

  private catalogCodes(appCode: string): string[] {
    return this.db
      .query<{ code: string }>('SELECT code FROM app_permissions WHERE appCode = ? ORDER BY sortOrder', [appCode])
      .map((row) => row.code);
  }

  /** Fitur yang boleh dipakai pengguna di satu aplikasi. */
  permissionsOf(userId: number, role: string, appCode: string): string[] {
    if (role === 'Superadmin') return this.catalogCodes(appCode);
    // Hanya kode yang masih ada di katalog yang dikembalikan, agar fitur yang
    // sudah dihapus aplikasinya tidak terbawa ke token sesi.
    return this.db
      .query<{ permission: string }>(
        `SELECT up.permission FROM user_permissions up
         JOIN app_permissions ap ON ap.appCode = up.appCode AND ap.code = up.permission
         WHERE up.userId = ? AND up.appCode = ? ORDER BY ap.sortOrder`,
        [userId, appCode]
      )
      .map((row) => row.permission);
  }

  /** Seluruh centang milik pengguna, dikelompokkan per aplikasi (untuk portal). */
  permissionsByApp(userId: number): Record<string, string[]> {
    const result: Record<string, string[]> = {};
    for (const row of this.db.query<{ appCode: string; permission: string }>(
      'SELECT appCode, permission FROM user_permissions WHERE userId = ? ORDER BY appCode, permission',
      [userId]
    )) {
      (result[row.appCode] ??= []).push(row.permission);
    }
    return result;
  }

  setUserPermissions(userId: number, appCode: string, permissions: string[]) {
    const known = new Set(this.catalogCodes(appCode));
    if (known.size === 0) {
      throw new BadRequestException(
        `Aplikasi '${appCode}' belum mendaftarkan daftar fiturnya. Nyalakan aplikasi tersebut sekali, lalu coba lagi.`
      );
    }
    const unknown = permissions.filter((code) => !known.has(code));
    if (unknown.length > 0) {
      throw new BadRequestException(`Fitur tidak dikenal untuk '${appCode}': ${unknown.join(', ')}.`);
    }

    const db = this.db.getDb();
    db.exec('BEGIN');
    try {
      this.db.run('DELETE FROM user_permissions WHERE userId = ? AND appCode = ?', [userId, appCode]);
      for (const code of new Set(permissions)) {
        this.db.run('INSERT INTO user_permissions (userId, appCode, permission) VALUES (?, ?, ?)', [userId, appCode, code]);
      }
      db.exec('COMMIT');
    } catch (err) {
      db.exec('ROLLBACK');
      throw err;
    }
  }
}

function safeArray(text: string): string[] {
  try {
    const value = JSON.parse(text);
    return Array.isArray(value) ? value.filter((v) => typeof v === 'string') : [];
  } catch {
    return [];
  }
}
