import { Body, Controller, Get, Module, Global, Put, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard, RequirePermission } from '../auth/permissions.guard';
import { SettingsService } from './settings.service';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('api/pengaturan')
export class SettingsController {
  constructor(private readonly settings: SettingsService) {}

  // Data klinik dipakai semua pengguna untuk menyusun surat.
  @Get()
  all() {
    return this.settings.all();
  }

  @RequirePermission('template.kelola')
  @Put()
  update(@Body() body: Record<string, unknown>) {
    return this.settings.update(body);
  }

  @Get('penomoran')
  counters() {
    return { data: this.settings.counters() };
  }

  @RequirePermission('template.kelola')
  @Put('penomoran')
  setCounter(@Body() body: { code?: string; year?: number; lastSeq?: number }) {
    return { data: this.settings.setCounter(body) };
  }
}

@Global()
@Module({
  controllers: [SettingsController],
  providers: [SettingsService],
  exports: [SettingsService],
})
export class SettingsModule {}
