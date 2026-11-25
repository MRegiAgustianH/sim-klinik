import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { DatabaseService } from '../database/database.service';

export type UserRole = 'Superadmin' | 'Dokter' | 'Perawat' | 'Administrasi';
export const USER_ROLES: UserRole[] = ['Superadmin', 'Dokter', 'Perawat', 'Administrasi'];

// aud pada token menandai app tujuan. App A menyimpan token untuk app B tetap
// tidak bisa dipakai di app A, walaupun semuanya memakai JWT_SECRET yang sama.
export type TokenAudience = 'portal' | 'simklinik' | 'surat' | 'laporan';

// Portal diperlakukan seperti app lain: harus diberikan lewat app_access.
// Tabel app_access menyimpan kode 'portal' untuk keperluan ini.
export const AUDIENCES: TokenAudience[] = ['portal', 'simklinik', 'surat', 'laporan'];

export interface JwtPayload {
  sub: number;
  username: string;
  fullName: string;
  role: UserRole;
  aud: TokenAudience;
  apps: string[];
}

// Klaim standar yang ditambahkan @nestjs/jwt saat token ditandatangani.
// Hanya ada pada token hasil verifikasi, tidak saat payload baru dibuat.
export interface DecodedJwtPayload extends JwtPayload {
  iat: number;
  exp: number;
}

export interface AuthUser {
  id: number;
  username: string;
  fullName: string;
  role: UserRole;
  aud: TokenAudience;
  apps: string[];
}

export const JWT_SECRET = process.env.JWT_SECRET || 'VaksinKU_Super_Secret_Key_Hospital_2026';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly db: DatabaseService) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        ExtractJwt.fromAuthHeaderAsBearerToken(),
        ExtractJwt.fromUrlQueryParameter('token'),
      ]),
      ignoreExpiration: false,
      secretOrKey: JWT_SECRET,
    });
  }

  async validate(payload: JwtPayload): Promise<AuthUser> {
    const user = this.db.get<{
      id: number;
      username: string;
      fullName: string;
      role: UserRole;
      isActive: number;
    }>('SELECT id, username, fullName, role, isActive FROM users WHERE id = ?', [payload.sub]);

    if (!user || user.isActive !== 1) {
      throw new UnauthorizedException('Pengguna tidak valid atau akun telah dinonaktifkan.');
    }

    // Akses aplikasi dibaca ulang dari database setiap request: pencabutan akses
    // berlaku seketika, tidak menunggu token kedaluwarsa 12 jam.
    const apps = this.db.appsForUser(user.id, user.role);

    if (!apps.includes(payload.aud)) {
      throw new UnauthorizedException(`Akun tidak memiliki akses ke aplikasi '${payload.aud}'.`);
    }

    return {
      id: user.id,
      username: user.username,
      fullName: user.fullName,
      role: user.role,
      aud: payload.aud,
      apps,
    };
  }
}
