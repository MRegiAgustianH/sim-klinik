import { Controller, Get } from '@nestjs/common';
import { DatabaseService } from './database/database.service';

// Dipakai portal dan launcher untuk mengecek apakah layanan siap menerima
// request. Tanpa token karena tidak membuka data apa pun.
@Controller('api/health')
export class HealthController {
  constructor(private readonly db: DatabaseService) {}

  @Get()
  check() {
    const userCount = this.db.get<{ count: number }>('SELECT COUNT(*) as count FROM users');
    const patientCount = this.db.get<{ count: number }>('SELECT COUNT(*) as count FROM patients');
    return {
      service: 'simklinik-identity-service',
      status: 'ok',
      users: userCount?.count ?? 0,
      patients: patientCount?.count ?? 0,
      time: new Date().toISOString(),
    };
  }
}
