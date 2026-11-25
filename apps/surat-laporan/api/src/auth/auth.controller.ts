import { Controller, Post, Get, Body, UseGuards, Request, Headers } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto, ChangePasswordDto } from './auth.dto';
import { JwtAuthGuard } from './jwt-auth.guard';
import { AuthUser } from './jwt.strategy';

@Controller('api/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  async login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  @UseGuards(JwtAuthGuard)
  @Get('profile')
  getProfile(@Request() req: { user: AuthUser }) {
    return this.authService.getProfile(req.user);
  }

  // Password diganti di layanan identitas memakai token pengguna sendiri,
  // jadi berlaku juga untuk login portal.
  @UseGuards(JwtAuthGuard)
  @Post('change-password')
  async changePassword(@Headers('authorization') authorization: string, @Body() dto: ChangePasswordDto) {
    const token = (authorization || '').replace(/^Bearer\s+/i, '').trim();
    return this.authService.changePassword(token, dto);
  }
}
