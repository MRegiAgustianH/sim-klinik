import { Module } from '@nestjs/common';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './auth/auth.module';
import { PatientsModule } from './patients/patients.module';
import { UsersModule } from './users/users.module';
import { AppsModule } from './apps/apps.module';
import { PermissionsModule } from './permissions/permissions.module';
import { HealthController } from './health.controller';

@Module({
  imports: [DatabaseModule, PermissionsModule, AuthModule, PatientsModule, UsersModule, AppsModule],
  controllers: [HealthController],
})
export class AppModule {}
