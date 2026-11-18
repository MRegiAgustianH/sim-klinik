import { IsNotEmpty, IsString, IsIn, IsOptional, MinLength } from 'class-validator';
import { UserRole } from '../auth/roles.decorator';

export class CreateUserDto {
  @IsNotEmpty({ message: 'Username tidak boleh kosong' })
  @IsString()
  username: string;

  @IsNotEmpty({ message: 'Password tidak boleh kosong' })
  @IsString()
  @MinLength(6, { message: 'Password minimal 6 karakter' })
  password: string;

  @IsNotEmpty({ message: 'Nama lengkap tidak boleh kosong' })
  @IsString()
  fullName: string;

  @IsNotEmpty({ message: 'Peran (Role) wajib dipilih' })
  @IsIn(['Superadmin', 'Dokter', 'Perawat'], { message: 'Peran harus Superadmin, Dokter, atau Perawat' })
  role: UserRole;
}

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  fullName?: string;

  @IsOptional()
  @IsIn(['Superadmin', 'Dokter', 'Perawat'])
  role?: UserRole;

  @IsOptional()
  @MinLength(6, { message: 'Password baru minimal 6 karakter' })
  password?: string;

  @IsOptional()
  isActive?: number;
}
