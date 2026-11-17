import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  Request,
  Headers,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto, ChangePasswordDto, VerifyDto } from './auth.dto';
import { JwtAuthGuard } from './jwt-auth.guard';
import { AuthUser } from './jwt.strategy';
import { ServiceKeyGuard } from './service-key.guard';
import { RequireServiceKey } from './service-key.decorator';

@Controller('api/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  async login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @UseGuards(JwtAuthGuard)
  @Get('profile')
  async getProfile(@Request() req: { user: AuthUser }) {
    return this.authService.getProfile(req.user);
  }

  @UseGuards(JwtAuthGuard)
  @Post('change-password')
  async changePassword(@Request() req: { user: AuthUser }, @Body() dto: ChangePasswordDto) {
    return this.authService.changePassword(req.user, dto);
  }

  // Dipakai backend app lain. Umumnya cukup service key saja: app memverifikasi
  // token yang dibawa pengguna, bukan tokennya sendiri.
  @UseGuards(ServiceKeyGuard)
  @RequireServiceKey({ canVerifyAll: false })
  @Post('verify')
  async verify(@Body() dto: VerifyDto, @Headers('x-app-code') appCode?: string) {
    return this.authService.verifyToken(dto.token, appCode);
  }

  // Dipakai portal: memverifikasi token milik app mana pun, dan menerbitkan
  // token pengganti bila aud-nya sudah tidak cocok.
  @UseGuards(ServiceKeyGuard)
  @RequireServiceKey({ canVerifyAll: true })
  @Post('verify-any')
  async verifyAny(@Body() dto: VerifyDto) {
    return this.authService.verifyToken(dto.token);
  }

  // Dipakai portal saat berpindah ke app: memastikan sesi ini memang berhak
  // membuka app tersebut, lalu menerbitkan token dengan aud app tujuan.
  @UseGuards(ServiceKeyGuard)
  @RequireServiceKey({ canVerifyAll: true })
  @Post('mint')
  async mint(@Body() dto: VerifyDto, @Headers('x-target-aud') audience: string) {
    return this.authService.mint(dto.token, audience as never);
  }

  // Dipakai backend app lain untuk mengetahui identitas di balik token yang
  // sudah diyakini valid — app tidak perlu memegang salinan tabel users.
  // JwtAuthGuard membaca ulang akses dari database, jadi app yang memanggil
  // endpoint ini tetap mendapat data yang sudah diperbarui.
  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@Request() req: { user: AuthUser }) {
    return {
      id: req.user.id,
      username: req.user.username,
      fullName: req.user.fullName,
      role: req.user.role,
      apps: req.user.apps,
    };
  }
}
