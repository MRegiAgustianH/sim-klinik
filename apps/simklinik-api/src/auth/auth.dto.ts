import { IsNotEmpty, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @IsNotEmpty({ message: 'Username tidak boleh kosong' })
  @IsString()
  username: string;

  @IsNotEmpty({ message: 'Password tidak boleh kosong' })
  @IsString()
  password: string;
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
