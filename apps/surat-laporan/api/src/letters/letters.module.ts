import { Body, Controller, Delete, Get, Module, Param, ParseIntPipe, Post, Put, Query, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard, RequirePermission } from '../auth/permissions.guard';
import { AuthUser } from '../auth/jwt.strategy';
import { TemplatesModule } from '../templates/templates.module';
import { LetterBody, LetterQuery, LettersService } from './letters.service';

type Req = { user: AuthUser };

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('api/surat')
export class LettersController {
  constructor(private readonly service: LettersService) {}

  @Get()
  list(@Request() req: Req, @Query() query: LetterQuery) {
    return this.service.list(query, req.user);
  }

  @Get('ringkasan')
  stats(@Request() req: Req) {
    return this.service.stats(req.user);
  }

  @Get('nomor-berikutnya')
  preview(@Query('templateId') templateId: string, @Query('tanggal') date: string) {
    return this.service.preview(Number(templateId), date);
  }

  @Get(':id')
  get(@Param('id', ParseIntPipe) id: number) {
    return this.service.get(id);
  }

  @RequirePermission('surat.buat')
  @Post()
  create(@Request() req: Req, @Body() body: LetterBody) {
    return this.service.create(body, req.user);
  }

  @RequirePermission('surat.buat')
  @Put(':id')
  update(@Request() req: Req, @Param('id', ParseIntPipe) id: number, @Body() body: LetterBody) {
    return this.service.update(id, body, req.user);
  }

  @RequirePermission('surat.buat')
  @Post(':id/duplikat')
  duplicate(@Request() req: Req, @Param('id', ParseIntPipe) id: number) {
    return this.service.duplicate(id, req.user);
  }

  @RequirePermission('surat.terbitkan')
  @Post(':id/terbitkan')
  issue(@Request() req: Req, @Param('id', ParseIntPipe) id: number, @Body() body: { contentHtml?: string }) {
    return this.service.issue(id, body, req.user);
  }

  @RequirePermission('surat.batal')
  @Post(':id/batal')
  cancel(@Request() req: Req, @Param('id', ParseIntPipe) id: number, @Body() body: { reason?: string }) {
    return this.service.cancel(id, body, req.user);
  }

  // Pemilik draft boleh menghapus draftnya sendiri; draft orang lain butuh
  // izin surat.hapus (diperiksa di service).
  @RequirePermission('surat.buat')
  @Delete(':id')
  remove(@Request() req: Req, @Param('id', ParseIntPipe) id: number) {
    return this.service.remove(id, req.user);
  }
}

@Module({
  imports: [TemplatesModule],
  controllers: [LettersController],
  providers: [LettersService],
})
export class LettersModule {}
