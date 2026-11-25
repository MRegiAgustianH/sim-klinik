import { Injectable, UnauthorizedException, ServiceUnavailableException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { IdentityClient, IdentityError, IdentityMe } from '../identity/identity-client.service';

export interface JwtPayload {
  sub: number;
  username: string;
  role: string;
  fullName: string;
  aud?: string;
}

// Pengguna yang sedang login. id adalah id di layanan identitas: akun hanya
// dibuat di portal, aplikasi surat tidak lagi memegang tabel pengguna sendiri.
// role adalah jabatan (untuk tampilan); yang menentukan boleh tidaknya suatu
// tindakan adalah permissions.
export interface AuthUser {
  id: number;
  username: string;
  fullName: string;
  role: string;
  isSuperadmin: boolean;
  permissions: string[];
}

const EXPECTED_AUDIENCE = 'surat';

// Profil + izin di-cache sebentar per token. Tanpa cache, setiap request
// aplikasi surat menunggu satu panggilan ke layanan identitas. Dengan 30 detik,
// akun yang dinonaktifkan atau izin yang dicabut di portal berlaku paling
// lambat 30 detik kemudian.
const CACHE_TTL_MS = 30_000;
const CACHE_MAX = 500;

const tokenFromRequest = ExtractJwt.fromExtractors([
  ExtractJwt.fromAuthHeaderAsBearerToken(),
  ExtractJwt.fromUrlQueryParameter('token'),
]);

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  private readonly cache = new Map<string, { user: AuthUser; expiresAt: number }>();

  constructor(private readonly identity: IdentityClient) {
    super({
      jwtFromRequest: tokenFromRequest,
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET || 'VaksinKU_Super_Secret_Key_Hospital_2026',
      passReqToCallback: true,
    });
  }

  async validate(req: unknown, payload: JwtPayload): Promise<AuthUser> {
    // Token login lama aplikasi surat (tanpa aud) dan token aplikasi lain ditolak.
    // Pengguna cukup login ulang; tokennya sekarang diterbitkan layanan identitas.
    if (payload.aud !== EXPECTED_AUDIENCE) {
      throw new UnauthorizedException(
        payload.aud
          ? `Token ini diterbitkan untuk aplikasi '${payload.aud}', bukan '${EXPECTED_AUDIENCE}'.`
          : 'Sesi lama sudah tidak berlaku. Silakan login ulang.'
      );
    }

    const token = tokenFromRequest(req as never) as string;
    const now = Date.now();
    const cached = this.cache.get(token);
    if (cached && cached.expiresAt > now) return cached.user;

    let me: IdentityMe;
    try {
      me = await this.identity.me(token);
    } catch (err) {
      if (err instanceof IdentityError && (err.status === 401 || err.status === 403)) {
        this.cache.delete(token);
        throw new UnauthorizedException(err.message);
      }
      if (err instanceof IdentityError) throw new ServiceUnavailableException(err.message);
      throw err;
    }

    const user: AuthUser = {
      id: me.id,
      username: me.username,
      fullName: me.fullName,
      role: me.role,
      isSuperadmin: me.isSuperadmin,
      permissions: me.permissions ?? [],
    };

    if (this.cache.size >= CACHE_MAX) {
      for (const [key, entry] of this.cache) if (entry.expiresAt <= now) this.cache.delete(key);
      if (this.cache.size >= CACHE_MAX) this.cache.clear();
    }
    this.cache.set(token, { user, expiresAt: now + CACHE_TTL_MS });
    return user;
  }
}

/** Nama yang dicatat di surat (pembuat, penerbit). */
export function displayName(user: AuthUser): string {
  return user.fullName || user.username;
}
