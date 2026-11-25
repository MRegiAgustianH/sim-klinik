import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './jwt.strategy';
import { PermissionsGuard } from './permissions.guard';
import { CatalogRegistrar } from './catalog-registrar';

// Token tidak lagi diterbitkan di sini; layanan identitas yang menerbitkannya.
// JwtStrategy hanya memverifikasi tanda tangannya dengan JWT_SECRET bersama.
@Module({
  imports: [PassportModule],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, PermissionsGuard, CatalogRegistrar],
  exports: [AuthService, JwtStrategy, PermissionsGuard],
})
export class AuthModule {}
