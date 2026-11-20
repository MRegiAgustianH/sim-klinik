import { Global, Module } from '@nestjs/common';
import { PermissionsService } from './permissions.service';

// Global: dipakai modul auth (izin di /api/auth/me), users (centang per
// orang), dan apps (pendaftaran katalog).
@Global()
@Module({
  providers: [PermissionsService],
  exports: [PermissionsService],
})
export class PermissionsModule {}
