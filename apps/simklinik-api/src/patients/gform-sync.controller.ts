import { Controller, Post, Get, Body, UseGuards } from '@nestjs/common';
import { GformSyncService } from './gform-sync.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard, RequirePermission } from '../auth/permissions.guard';
import { PERMISSIONS } from '../auth/permissions';

export class UpdateGformConfigDto {
  gformUrl?: string;
  spreadsheetId?: string;
  sheetName?: string;
  syncEnabled?: boolean;
}

@Controller('api/patients/sync')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class GformSyncController {
  constructor(private readonly syncService: GformSyncService) {}

  @Post()
  @RequirePermission(PERMISSIONS.REGISTRASI_KELOLA)
  async manualSync() {
    const result = await this.syncService.syncPatientsFromSheet();
    return {
      message: result.message,
      newPatientsAdded: result.addedCount,
      configured: result.configured,
    };
  }

  @Get('config')
  @RequirePermission(PERMISSIONS.REGISTRASI_KELOLA)
  getConfig() {
    return this.syncService.getConfig();
  }

  @Post('config')
  @RequirePermission(PERMISSIONS.REGISTRASI_KELOLA)
  updateConfig(@Body() dto: UpdateGformConfigDto) {
    return this.syncService.saveConfig(dto);
  }
}
