import { Controller, Get } from '@nestjs/common';

// Penanda status untuk portal dan launcher. Tidak membuka data apa pun —
// hanya menyatakan bahwa layanan hidup.
@Controller('api/health')
export class HealthController {
  @Get()
  check() {
    return {
      service: 'simklinik-backend',
      status: 'ok',
      time: new Date().toISOString(),
    };
  }
}
