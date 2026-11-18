import { Module } from '@nestjs/common';
import { PatientsService } from './patients.service';
import { PatientsController } from './patients.controller';
import { GformSyncService } from './gform-sync.service';
import { GformSyncController } from './gform-sync.controller';

@Module({
  controllers: [PatientsController, GformSyncController],
  providers: [PatientsService, GformSyncService],
  exports: [PatientsService, GformSyncService],
})
export class PatientsModule {}
