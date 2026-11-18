import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { DatabaseService } from '../database/database.service';
import { LoginDto, ChangePasswordDto } from './auth.dto';
import { AuthUser, DecodedJwtPayload, JwtPayload, TokenAudience, UserRole } from './jwt.strategy';

interface DbUser {
  id: number;
  username: string;
  password: string;
  fullName: string;
  role: UserRole;
  isActive: number;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly db: DatabaseService,
    private readonly jwtService: JwtService,
  ) {}

  async login(dto: LoginDto) {
    const audience: TokenAudience = dto.audience || 'portal';

    const user = this.db.get<DbUser>(
      'SELECT id, username, password, fullName, role, isActive FROM users WHERE username = ?',
      [dto.username.trim().toLowerCase()]
    );

    if (!user) {
      throw new UnauthorizedException('Username atau password salah.');
    }
    if (user.isActive !== 1) {
      throw new UnauthorizedException('Akun telah dinonaktifkan. Hubungi Superadministrator.');
    }
    if (!bcrypt.compareSync(dto.password, user.password)) {
      throw new UnauthorizedException('Username atau password salah.');
    }

    const apps = this.getActiveApps(user.id);

    // Portal berisi data pasien, jadi membuka portal pun butuh akses eksplisit.
    // Sebelumnya 'portal' selalu diloloskan dan akun tanpa akses apa pun tetap
    // bisa masuk ke dashboard.
    if (!apps.includes(audience)) {
      throw new ForbiddenException(`Akun ini tidak memiliki akses ke aplikasi '${audience}'.`);
    }

    const payload: JwtPayload = {
      sub: user.id,
      username: user.username,
      fullName: user.fullName,
      role: user.role,
      aud: audience,
      apps,
    };

    return {
      message: 'Login berhasil',
      accessToken: this.jwtService.sign(payload),
      user: {
        id: user.id,
        username: user.username,
        fullName: user.fullName,
        role: user.role,
        apps,
      },
    };
  }

  getActiveApps(userId: number): string[] {
    return this.db
      .query<{ appCode: string }>('SELECT appCode FROM app_access WHERE userId = ? AND isActive = 1', [
        userId,
      ])
      .map((row) => row.appCode);
  }

  // Dipanggil backend app lain (dengan service key) untuk memverifikasi token
  // yang dibawa pengguna. Bila audience tidak diisi, token apa pun milik app itu
  // dianggap valid — kebutuhan umum saat app menerima token dari portal.
  verifyToken(token: string, audience?: string) {
    let payload: DecodedJwtPayload;
    try {
      payload = this.jwtService.verify<DecodedJwtPayload>(token);
    } catch {
      throw new UnauthorizedException('Token tidak valid atau sudah kedaluwarsa.');
    }

    if (audience && payload.aud !== audience) {
      throw new UnauthorizedException(
        `Token ini diterbitkan untuk aplikasi '${payload.aud}', bukan '${audience}'.`
      );
    }

    const user = this.db.get<{ id: number; fullName: string; role: UserRole; isActive: number }>(
      'SELECT id, fullName, role, isActive FROM users WHERE id = ?',
      [payload.sub]
    );
    if (!user || user.isActive !== 1) {
      throw new UnauthorizedException('Pengguna tidak valid atau akun telah dinonaktifkan.');
    }

    const apps = this.getActiveApps(user.id);

    return {
      valid: true,
      user: {
        id: user.id,
        username: payload.username,
        fullName: user.fullName,
        role: user.role,
        apps,
      },
      audience: payload.aud,
      expiresAt: new Date(payload.exp * 1000).toISOString(),
    };
  }

  // Dipakai portal saat berpindah ke app. Token tidak diterbitkan ulang dari
  // kredensial, melainkan dari sesi portal yang sudah diverifikasi — jadi
  // tidak ada password yang dipakai di jalur ini.
  mint(portalToken: string, audience: TokenAudience) {
    if (audience === 'portal') {
      throw new BadRequestException('Audience portal tidak perlu di-mint; login langsung menghasilkan token portal.');
    }

    const verified = this.verifyToken(portalToken);
    if (verified.audience !== 'portal') {      throw new ForbiddenException(
        `Hanya token portal yang bisa ditukar. Token ini diterbitkan untuk '${verified.audience}'.`
      );
    }
    if (!verified.user.apps.includes(audience)) {
      throw new ForbiddenException(`Akun ini tidak memiliki akses ke aplikasi '${audience}'.`);
    }

    const payload: JwtPayload = {
      sub: verified.user.id,
      username: verified.user.username,
      fullName: verified.user.fullName,
      role: verified.user.role,
      aud: audience,
      apps: verified.user.apps,
    };

    return {
      message: `Token aplikasi '${audience}' berhasil diterbitkan.`,
      accessToken: this.jwtService.sign(payload),
      user: verified.user,
    };
  }

  async getProfile(user: AuthUser) {
    const detail = this.db.get<{
      id: number;
      username: string;
      fullName: string;
      role: UserRole;
      isActive: number;
      createdAt: string;
    }>('SELECT id, username, fullName, role, isActive, createdAt FROM users WHERE id = ?', [user.id]);

    if (!detail) {
      throw new UnauthorizedException('Pengguna tidak ditemukan.');
    }
    return { ...detail, apps: this.getActiveApps(user.id) };
  }

  async changePassword(user: AuthUser, dto: ChangePasswordDto) {
    const userInDb = this.db.get<{ password: string }>('SELECT password FROM users WHERE id = ?', [
      user.id,
    ]);

    if (!userInDb) {
      throw new UnauthorizedException('Pengguna tidak ditemukan.');
    }
    if (!bcrypt.compareSync(dto.oldPassword, userInDb.password)) {
      throw new BadRequestException('Password lama yang Anda masukkan tidak sesuai.');
    }
    if (dto.newPassword.length < 6) {
      throw new BadRequestException('Password baru minimal harus 6 karakter.');
    }

    this.db.run('UPDATE users SET password = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?', [
      bcrypt.hashSync(dto.newPassword, bcrypt.genSaltSync(10)),
      user.id,
    ]);

    return { message: 'Password berhasil diperbarui.' };
  }
}
