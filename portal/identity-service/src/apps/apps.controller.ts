import { Controller, Get, Post, Body, Param, UseGuards, Request } from '@nestjs/common';
import { AppsService } from './apps.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { AuthUser } from '../auth/jwt.strategy';
import { ServiceKeyGuard } from '../auth/service-key.guard';

@Controller('api/apps')
export class AppsController {
  constructor(private readonly appsService: AppsService) {}

  // Dipanggil portal setelah login: kartu aplikasi yang muncul hanya yang
  // boleh dibuka pengguna tersebut.
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Get()
  list(@Request() req: { user: AuthUser }) {
    return this.appsService.listForUser(req.user);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Get('health')
  health() {
    return this.appsService.health();
  }

  // Dipakai server portal saat menukar tiket SSO. Portal memegang service key,
  // bukan token pengguna, jadi GET /api/apps/:code (khusus Superadmin) tidak
  // bisa dipakai di jalur itu.
  //
  // Path-nya dua segmen ('service/list'), sehingga tidak tertukar dengan
  // ':code' yang hanya satu segmen.
  //
  // Yang dibuka hanya nama dan alamat aplikasi — data yang memang sudah tampil
  // di beranda portal bagi setiap pengguna yang login.
  @UseGuards(ServiceKeyGuard)
  @Get('service/list')
  listForService() {
    return this.appsService.listForService();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('Superadmin')
  @Get('all')
  listAll() {
    return this.appsService.listAll();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('Superadmin')
  @Get(':code')
  findOne(@Param('code') code: string) {
    return this.appsService.findOne(code);
  }

  // Menambah app baru ke portal cukup lewat endpoint ini; kartu di beranda
  // portal muncul tanpa mengubah kode frontend.
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('Superadmin')
  @Post()
  upsert(
    @Body()
    body: {
      code: string;
      name: string;
      description?: string;
      frontendUrl?: string;
      backendUrl?: string;
      icon?: string;
      sortOrder?: number;
      isActive?: number;
    }
  ) {
    return this.appsService.upsert(body);
  }
}
