import { Controller, Post, Get, Body, UseGuards } from '@nestjs/common';
import { GformSyncService } from './gform-sync.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

export class UpdateGformConfigDto {
  gformUrl?: string;
  spreadsheetId?: string;
  sheetName?: string;
  syncEnabled?: boolean;
}

@Controller('api/patients/sync')
@UseGuards(JwtAuthGuard, RolesGuard)
export class GformSyncController {
  constructor(private readonly syncService: GformSyncService) {}

  @Post()
  @Roles('Superadmin', 'Perawat', 'Dokter')
  async manualSync() {
    const result = await this.syncService.syncPatientsFromSheet();
    return {
      message: result.message,
      newPatientsAdded: result.addedCount,
      configured: result.configured,
    };
  }

  @Get('config')
  @Roles('Superadmin', 'Perawat', 'Dokter')
  getConfig() {
    return this.syncService.getConfig();
  }

  @Post('config')
  @Roles('Superadmin', 'Perawat', 'Dokter')
  updateConfig(@Body() dto: UpdateGformConfigDto) {
    return this.syncService.saveConfig(dto);
  }
}
