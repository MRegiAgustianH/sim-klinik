import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { DatabaseService } from '../database/database.service';
import { CreateUserDto, UpdateUserDto } from './users.dto';

export interface UserSummary {
  id: number;
  username: string;
  fullName: string;
  role: 'Superadmin' | 'Dokter' | 'Perawat';
  isActive: number;
  createdAt: string;
  updatedAt: string;
}

@Injectable()
export class UsersService {
  constructor(private readonly db: DatabaseService) {}

  getAllUsers(): UserSummary[] {
    return this.db.query<UserSummary>(
      'SELECT id, username, fullName, role, isActive, createdAt, updatedAt FROM users ORDER BY id ASC'
    );
  }

  getUserById(id: number): UserSummary {
    const user = this.db.get<UserSummary>(
      'SELECT id, username, fullName, role, isActive, createdAt, updatedAt FROM users WHERE id = ?',
      [id]
    );
    if (!user) {
      throw new NotFoundException(`Pengguna dengan ID ${id} tidak ditemukan.`);
    }
    return user;
  }

  createUser(dto: CreateUserDto): UserSummary {
    const normalizedUsername = dto.username.trim().toLowerCase();
    const existing = this.db.get<{ id: number }>(
      'SELECT id FROM users WHERE username = ?',
      [normalizedUsername]
    );

    if (existing) {
      throw new BadRequestException(`Username '${normalizedUsername}' sudah digunakan.`);
    }

    const salt = bcrypt.genSaltSync(10);
    const hash = bcrypt.hashSync(dto.password, salt);

    const res = this.db.run(
      'INSERT INTO users (username, password, fullName, role, isActive) VALUES (?, ?, ?, ?, 1)',
      [normalizedUsername, hash, dto.fullName.trim(), dto.role]
    );

    return this.getUserById(Number(res.lastInsertRowid));
  }

  updateUser(id: number, dto: UpdateUserDto): UserSummary {
    const user = this.getUserById(id);

    const updates: string[] = ['updatedAt = CURRENT_TIMESTAMP'];
    const params: (string | number)[] = [];

    if (dto.fullName) {
      updates.push('fullName = ?');
      params.push(dto.fullName.trim());
    }

    if (dto.role) {
      updates.push('role = ?');
      params.push(dto.role);
    }

    if (dto.isActive !== undefined) {
      updates.push('isActive = ?');
      params.push(dto.isActive ? 1 : 0);
    }

    if (dto.password && dto.password.length >= 6) {
      const salt = bcrypt.genSaltSync(10);
      const hash = bcrypt.hashSync(dto.password, salt);
      updates.push('password = ?');
      params.push(hash);
    }

    params.push(id);
    this.db.run(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, params);

    return this.getUserById(id);
  }

  deleteUser(id: number, currentUserId: number): { message: string } {
    if (id === currentUserId) {
      throw new BadRequestException('Anda tidak dapat menghapus akun Anda sendiri yang sedang aktif.');
    }

    const user = this.getUserById(id);
    this.db.run('DELETE FROM users WHERE id = ?', [id]);
    return { message: `Pengguna '${user.username}' berhasil dihapus.` };
  }
}
