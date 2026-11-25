import { Module } from '@nestjs/common';
import { DatabaseModule } from './database/database.module';
import { IdentityModule } from './identity/identity.module';
import { AuthModule } from './auth/auth.module';
import { SettingsModule } from './settings/settings.module';
import { LetterheadsModule } from './letterheads/letterheads.module';
import { SignersModule } from './signers/signers.module';
import { TemplatesModule } from './templates/templates.module';
import { LettersModule } from './letters/letters.module';
import { UploadsModule } from './uploads/uploads.module';
import { PatientsModule } from './patients/patients.module';
import { HealthController } from './health.controller';

@Module({
  imports: [
    DatabaseModule,
    IdentityModule,
    AuthModule,
    SettingsModule,
    LetterheadsModule,
    SignersModule,
    TemplatesModule,
    LettersModule,
    UploadsModule,
    PatientsModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
