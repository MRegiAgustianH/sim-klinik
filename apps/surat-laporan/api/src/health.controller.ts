import { Controller, Get } from '@nestjs/common';

// Penanda status untuk portal dan launcher. Tidak membuka data apa pun.
@Controller('api/health')
export class HealthController {
  @Get()
  check() {
    return { service: 'surat-backend', status: 'ok', time: new Date().toISOString() };
  }
}
