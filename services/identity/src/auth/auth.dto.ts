import { IsIn, IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';
import { TokenAudience } from './jwt.strategy';

const AUDIENCES: TokenAudience[] = ['portal', 'simklinik', 'surat', 'laporan'];

export class LoginDto {
  @IsNotEmpty({ message: 'Username tidak boleh kosong' })
  @IsString()
  username: string;

  @IsNotEmpty({ message: 'Password tidak boleh kosong' })
  @IsString()
  password: string;

  // Token diterbitkan langsung untuk app tujuan agar portal tidak perlu bisa
  // mengakses API app lain. Bila kosong, token untuk portal.
  @IsOptional()
  @IsIn(AUDIENCES, { message: 'Aplikasi tujuan tidak dikenal.' })
  audience?: TokenAudience;
}

export class ChangePasswordDto {
  @IsNotEmpty({ message: 'Password lama wajib diisi' })
  @IsString()
  oldPassword: string;

  @IsNotEmpty({ message: 'Password baru wajib diisi' })
  @IsString()
  @MinLength(6, { message: 'Password baru minimal 6 karakter' })
  newPassword: string;
}

export class VerifyDto {
  @IsNotEmpty({ message: 'Token wajib dikirim' })
  @IsString()
  token: string;
}
