import {
  IsArray,
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import { USER_ROLES, UserRole } from '../auth/jwt.strategy';
import { APP_CODES, AppCode } from '../database/database.service';

export class CreateUserDto {
  @IsNotEmpty({ message: 'Username wajib diisi' })
  @IsString()
  username: string;

  @IsNotEmpty({ message: 'Nama lengkap wajib diisi' })
  @IsString()
  fullName: string;

  @IsIn(USER_ROLES, { message: 'Peran tidak dikenal.' })
  role: UserRole;

  @IsNotEmpty({ message: 'Password wajib diisi' })
  @IsString()
  @MinLength(6, { message: 'Password minimal 6 karakter' })
  password: string;

  @IsOptional()
  @IsArray()
  @IsIn(APP_CODES as unknown as string[], { each: true, message: 'Kode aplikasi tidak dikenal.' })
  appCodes?: AppCode[];
}

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  fullName?: string;

  @IsOptional()
  @IsIn(USER_ROLES, { message: 'Peran tidak dikenal.' })
  role?: UserRole;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  // Password opsional: hanya diisi bila admin ingin mereset kata sandi.
  @IsOptional()
  @IsString()
  @MinLength(6, { message: 'Password minimal 6 karakter' })
  password?: string;
}

export class SetPermissionsDto {
  @IsIn(APP_CODES as unknown as string[], { message: 'Kode aplikasi tidak dikenal.' })
  appCode: AppCode;

  @IsArray()
  @IsString({ each: true })
  permissions: string[];
}

export class SetAppAccessDto {
  @IsArray()
  @IsIn(APP_CODES as unknown as string[], { each: true, message: 'Kode aplikasi tidak dikenal.' })
  appCodes: AppCode[];
}
