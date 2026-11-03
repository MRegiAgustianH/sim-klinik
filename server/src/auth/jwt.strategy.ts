import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { DatabaseService } from '../database/database.service';

export interface JwtPayload {
  sub: number;
  username: string;
  role: 'Superadmin' | 'Dokter' | 'Perawat';
  fullName: string;
}

export interface AuthUser {
  id: number;
  username: string;
  fullName: string;
  role: 'Superadmin' | 'Dokter' | 'Perawat';
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly db: DatabaseService) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        ExtractJwt.fromAuthHeaderAsBearerToken(),
        ExtractJwt.fromUrlQueryParameter('token'),
      ]),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET || 'VaksinKU_Super_Secret_Key_Hospital_2026',
    });
  }

  async validate(payload: JwtPayload): Promise<AuthUser> {
    const user = this.db.get<{
      id: number;
      username: string;
      fullName: string;
      role: 'Superadmin' | 'Dokter' | 'Perawat';
      isActive: number;
    }>('SELECT id, username, fullName, role, isActive FROM users WHERE id = ?', [payload.sub]);

    if (!user || user.isActive !== 1) {
      throw new UnauthorizedException('Pengguna tidak valid atau akun telah dinonaktifkan.');
    }

    return {
      id: user.id,
      username: user.username,
      fullName: user.fullName,
      role: user.role,
    };
  }
}
