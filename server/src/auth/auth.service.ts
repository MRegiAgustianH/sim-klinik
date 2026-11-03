import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { DatabaseService } from '../database/database.service';
import { LoginDto, ChangePasswordDto } from './auth.dto';
import { AuthUser, JwtPayload } from './jwt.strategy';

export interface DbUser {
  id: number;
  username: string;
  password: string;
  fullName: string;
  role: 'Superadmin' | 'Dokter' | 'Perawat';
  isActive: number;
}

export interface UserProfile {
  id: number;
  username: string;
  fullName: string;
  role: 'Superadmin' | 'Dokter' | 'Perawat';
  isActive: number;
  createdAt: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly db: DatabaseService,
    private readonly jwtService: JwtService,
  ) {}

  async login(loginDto: LoginDto) {
    const { username, password } = loginDto;

    const user = this.db.get<DbUser>(
      'SELECT id, username, password, fullName, role, isActive FROM users WHERE username = ?',
      [username.trim().toLowerCase()]
    );

    if (!user) {
      throw new UnauthorizedException('Username atau password salah.');
    }

    if (user.isActive !== 1) {
      throw new UnauthorizedException('Akun pengguna telah dinonaktifkan. Hubungi Superadministrator.');
    }

    const isMatch = bcrypt.compareSync(password, user.password);
    if (!isMatch) {
      throw new UnauthorizedException('Username atau password salah.');
    }

    const payload: JwtPayload = {
      sub: user.id,
      username: user.username,
      role: user.role,
      fullName: user.fullName,
    };

    const token = this.jwtService.sign(payload);

    return {
      message: 'Login berhasil',
      accessToken: token,
      user: {
        id: user.id,
        username: user.username,
        fullName: user.fullName,
        role: user.role,
      },
    };
  }

  async getProfile(user: AuthUser): Promise<UserProfile> {
    const userDetail = this.db.get<UserProfile>(
      'SELECT id, username, fullName, role, isActive, createdAt FROM users WHERE id = ?',
      [user.id]
    );
    if (!userDetail) {
      throw new UnauthorizedException('Pengguna tidak ditemukan.');
    }
    return userDetail;
  }

  async changePassword(user: AuthUser, dto: ChangePasswordDto) {
    const userInDb = this.db.get<DbUser>(
      'SELECT id, password FROM users WHERE id = ?',
      [user.id]
    );

    if (!userInDb) {
      throw new UnauthorizedException('Pengguna tidak ditemukan.');
    }

    const isOldMatch = bcrypt.compareSync(dto.oldPassword, userInDb.password);
    if (!isOldMatch) {
      throw new BadRequestException('Password lama yang Anda masukkan tidak sesuai.');
    }

    if (dto.newPassword.length < 6) {
      throw new BadRequestException('Password baru minimal harus 6 karakter.');
    }

    const salt = bcrypt.genSaltSync(10);
    const newHash = bcrypt.hashSync(dto.newPassword, salt);

    this.db.run(
      'UPDATE users SET password = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?',
      [newHash, user.id]
    );

    return { message: 'Password berhasil diperbarui.' };
  }
}
