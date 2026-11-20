import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { DatabaseService } from '../database/database.service';

export interface JwtPayload {
  sub: number;
  username: string;
  role: 'Superadmin' | 'Dokter' | 'Perawat';
  fullName: string;
  // Portal menerbitkan token per aplikasi tujuan (aud). Token tanpa aud berasal
  // dari login lokal SIMKlinik dan tetap diterima.
  aud?: string;
}

export interface AuthUser {
  id: number;
  username: string;
  fullName: string;
  role: 'Superadmin' | 'Dokter' | 'Perawat';
}

interface SimklinikUser {
  id: number;
  username: string;
  fullName: string;
  role: 'Superadmin' | 'Dokter' | 'Perawat';
  isActive: number;
}

// Token yang diterbitkan portal untuk aplikasi lain tidak boleh dipakai di
// sini, walaupun semuanya memakai JWT_SECRET yang sama.
const EXPECTED_AUDIENCE = 'simklinik';

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
    if (payload.aud && payload.aud !== EXPECTED_AUDIENCE) {
      throw new UnauthorizedException(
        `Token ini diterbitkan untuk aplikasi '${payload.aud}', bukan '${EXPECTED_AUDIENCE}'.`
      );
    }

    // Token dari portal (aud = simklinik) membawa id milik layanan identitas,
    // yang tidak sama dengan id di tabel users SIMKlinik. Mencocokkan lewat id
    // bisa membuat staf masuk sebagai orang lain, jadi token portal dicocokkan
    // lewat username. Token login lokal (tanpa aud) memakai id SIMKlinik sendiri.
    const fromPortal = payload.aud === EXPECTED_AUDIENCE;
    const user = fromPortal
      ? this.db.get<SimklinikUser>('SELECT id, username, fullName, role, isActive FROM users WHERE username = ?', [
          String(payload.username ?? '').trim().toLowerCase(),
        ])
      : this.db.get<SimklinikUser>('SELECT id, username, fullName, role, isActive FROM users WHERE id = ?', [payload.sub]);

    if (!user) {
      throw new UnauthorizedException(
        fromPortal
          ? `Akun portal '${payload.username}' belum terdaftar di SIMKlinik. Minta Superadmin membuat akun dengan username yang sama.`
          : 'Pengguna tidak valid atau akun telah dinonaktifkan.'
      );
    }
    if (user.isActive !== 1) {
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
