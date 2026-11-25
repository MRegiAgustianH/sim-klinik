import { Injectable, UnauthorizedException, ForbiddenException, BadRequestException, HttpException } from '@nestjs/common';
import { IdentityClient, IdentityError } from '../identity/identity-client.service';
import { LoginDto, ChangePasswordDto } from './auth.dto';
import { AuthUser } from './jwt.strategy';

// Akun hanya ada di layanan identitas. aplikasi surat meneruskan login dan ganti
// password ke sana, sehingga satu akun dan satu password berlaku di portal
// maupun di halaman login aplikasi surat (port 8084).
@Injectable()
export class AuthService {
  constructor(private readonly identity: IdentityClient) {}

  async login(dto: LoginDto) {
    let accessToken: string;
    try {
      ({ accessToken } = await this.identity.login(dto.username.trim().toLowerCase(), dto.password));
    } catch (err) {
      throw toHttp(err);
    }

    let me;
    try {
      me = await this.identity.me(accessToken);
    } catch (err) {
      throw toHttp(err);
    }

    return {
      message: 'Login berhasil',
      accessToken,
      user: {
        id: me.id,
        username: me.username,
        fullName: me.fullName,
        role: me.role,
        isSuperadmin: me.isSuperadmin,
        permissions: me.permissions,
      },
    };
  }

  getProfile(user: AuthUser) {
    return user;
  }

  async changePassword(token: string, dto: ChangePasswordDto) {
    try {
      return await this.identity.changePassword(token, dto.oldPassword, dto.newPassword);
    } catch (err) {
      throw toHttp(err);
    }
  }
}

// Status dari layanan identitas diteruskan apa adanya agar pesan seperti
// "Username atau password salah" atau "tidak memiliki akses ke aplikasi
// 'surat'" sampai ke layar login.
function toHttp(err: unknown): unknown {
  if (!(err instanceof IdentityError)) return err;
  if (err.status === 401) return new UnauthorizedException(err.message);
  if (err.status === 403) return new ForbiddenException(err.message);
  if (err.status === 400) return new BadRequestException(err.message);
  return new HttpException(err.message, err.status);
}
