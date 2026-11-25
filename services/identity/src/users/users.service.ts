import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { DatabaseService, APP_CODES } from '../database/database.service';
import { UserRole } from '../auth/jwt.strategy';
import { CreateUserDto, UpdateUserDto } from './users.dto';
import { PermissionsService } from '../permissions/permissions.service';

interface UserRow {
  id: number;
  username: string;
  fullName: string;
  role: UserRole;
  isActive: number;
  createdAt: string;
}

@Injectable()
export class UsersService {
  constructor(
    private readonly db: DatabaseService,
    private readonly permissions: PermissionsService,
  ) {}


  private present(row: UserRow) {
    return { ...row, apps: this.db.appsForUser(row.id, row.role), permissions: this.permissions.permissionsByApp(row.id) };
  }

  private assertAppCodes(codes: string[]) {
    const unknown = codes.filter((code) => !APP_CODES.includes(code as never));
    if (unknown.length > 0) {
      throw new BadRequestException(`Kode aplikasi tidak dikenal: ${unknown.join(', ')}.`);
    }
  }

  // Superadmin selalu punya akses ke semua app, jadi app_access-nya tidak perlu
  // disimpan. App baru yang didaftarkan otomatis bisa dibuka Superadmin.
  private syncAppAccess(userId: number, codes: string[], role: UserRole) {
    this.db.run('DELETE FROM app_access WHERE userId = ?', [userId]);
    if (role === 'Superadmin') return;
    for (const code of [...new Set(codes)]) {
      this.db.run('INSERT INTO app_access (userId, appCode) VALUES (?, ?)', [userId, code]);
    }
  }

  list() {
    const rows = this.db.query<UserRow>(
      'SELECT id, username, fullName, role, isActive, createdAt FROM users ORDER BY id ASC'
    );
    return { data: rows.map((row) => this.present(row)) };
  }

  findOne(id: number) {
    const row = this.db.get<UserRow>(
      'SELECT id, username, fullName, role, isActive, createdAt FROM users WHERE id = ?',
      [id]
    );
    if (!row) {
      throw new NotFoundException(`Pengguna dengan ID ${id} tidak ditemukan.`);
    }
    return this.present(row);
  }

  create(dto: CreateUserDto) {
    const username = dto.username.trim().toLowerCase();
    if (dto.appCodes) this.assertAppCodes(dto.appCodes);

    if (this.db.get('SELECT id FROM users WHERE username = ?', [username])) {
      throw new ConflictException(`Username '${username}' sudah dipakai.`);
    }

    const result = this.db.run(
      'INSERT INTO users (username, password, fullName, role) VALUES (?, ?, ?, ?)',
      [username, bcrypt.hashSync(dto.password, bcrypt.genSaltSync(10)), dto.fullName.trim(), dto.role]
    );
    const id = Number(result.lastInsertRowid);

    this.syncAppAccess(id, dto.appCodes ?? [], dto.role);
    return this.findOne(id);
  }

  update(id: number, dto: UpdateUserDto) {
    const current = this.findOne(id);

    const updates: string[] = [];
    const params: (string | number)[] = [];

    if (dto.fullName !== undefined) {
      updates.push('fullName = ?');
      params.push(dto.fullName.trim());
    }
    if (dto.role !== undefined) {
      updates.push('role = ?');
      params.push(dto.role);
    }
    if (dto.isActive !== undefined) {
      // Jangan sampai tidak ada Superadmin aktif yang tersisa.
      if (!dto.isActive && current.role === 'Superadmin') {
        const activeAdmins = this.db.get<{ count: number }>(
          "SELECT COUNT(*) as count FROM users WHERE role = 'Superadmin' AND isActive = 1 AND id <> ?",
          [id]
        );
        if (!activeAdmins || activeAdmins.count === 0) {
          throw new BadRequestException('Tidak bisa menonaktifkan Superadmin terakhir yang masih aktif.');
        }
      }
      updates.push('isActive = ?');
      params.push(dto.isActive ? 1 : 0);
    }
    if (dto.password !== undefined) {
      updates.push('password = ?');
      params.push(bcrypt.hashSync(dto.password, bcrypt.genSaltSync(10)));
    }

    if (updates.length > 0) {
      params.push(id);
      this.db.run(`UPDATE users SET ${updates.join(', ')}, updatedAt = CURRENT_TIMESTAMP WHERE id = ?`, params);
    }

    // Perubahan peran dari/ke Superadmin mengubah cara akses app disimpan.
    if (dto.role !== undefined) {
      const apps = dto.role === 'Superadmin' ? [] : current.apps;
      this.syncAppAccess(id, apps, dto.role);
    }

    return this.findOne(id);
  }

  setAppAccess(id: number, appCodes: string[]) {
    this.assertAppCodes(appCodes);
    const user = this.findOne(id);
    if (user.role === 'Superadmin') {
      throw new BadRequestException(
        'Superadmin otomatis memiliki akses ke semua aplikasi; akses per app tidak perlu diatur.'
      );
    }
    this.syncAppAccess(id, appCodes, user.role);
    return this.findOne(id);
  }

  setPermissions(id: number, appCode: string, permissions: string[]) {
    this.assertAppCodes([appCode]);
    const user = this.findOne(id);
    if (user.role === 'Superadmin') {
      throw new BadRequestException('Superadmin otomatis boleh memakai semua fitur; tidak perlu diatur.');
    }
    this.permissions.setUserPermissions(id, appCode, permissions);
    return this.findOne(id);
  }
}
