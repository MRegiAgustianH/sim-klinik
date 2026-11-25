import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Injectable,
  Module,
  NotFoundException,
  Param,
  ParseIntPipe,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard, RequirePermission } from '../auth/permissions.guard';
import { sanitizeLetterHtml } from '../common/html';

export interface LetterheadRow {
  id: number;
  name: string;
  html: string;
  isDefault: number;
  createdAt: string;
  updatedAt: string;
}

// Kop surat: pustaka header yang bisa dipakai banyak template. Satu kop
// ditandai bawaan dan dipakai template dengan mode kop "default".
@Injectable()
export class LetterheadsService {
  constructor(private readonly db: DatabaseService) {}

  list() {
    return this.db.query<LetterheadRow & { usedBy: number }>(
      `SELECT l.*, (SELECT COUNT(*) FROM templates t WHERE t.letterheadMode = 'library' AND t.letterheadId = l.id) AS usedBy
       FROM letterheads l ORDER BY l.isDefault DESC, l.name ASC`
    );
  }

  get(id: number) {
    const row = this.db.get<LetterheadRow>('SELECT * FROM letterheads WHERE id = ?', [id]);
    if (!row) throw new NotFoundException('Kop surat tidak ditemukan.');
    return row;
  }

  getDefault() {
    return this.db.get<LetterheadRow>('SELECT * FROM letterheads ORDER BY isDefault DESC, id ASC LIMIT 1') ?? null;
  }

  create(body: { name?: string; html?: string; isDefault?: boolean }) {
    const name = String(body?.name || '').trim();
    if (!name) throw new BadRequestException('Nama kop wajib diisi.');
    const result = this.db.run('INSERT INTO letterheads (name, html) VALUES (?, ?)', [name, sanitizeLetterHtml(body.html)]);
    const id = Number(result.lastInsertRowid);
    if (body.isDefault || !this.db.get('SELECT id FROM letterheads WHERE isDefault = 1')) this.setDefault(id);
    return this.get(id);
  }

  update(id: number, body: { name?: string; html?: string }) {
    this.get(id);
    const name = String(body?.name || '').trim();
    if (!name) throw new BadRequestException('Nama kop wajib diisi.');
    this.db.run('UPDATE letterheads SET name = ?, html = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?', [
      name,
      sanitizeLetterHtml(body.html),
      id,
    ]);
    return this.get(id);
  }

  setDefault(id: number) {
    this.get(id);
    this.db.transaction(() => {
      this.db.run('UPDATE letterheads SET isDefault = 0');
      this.db.run('UPDATE letterheads SET isDefault = 1 WHERE id = ?', [id]);
    });
    return this.get(id);
  }

  remove(id: number) {
    const row = this.get(id);
    if (row.isDefault) throw new BadRequestException('Kop bawaan tidak bisa dihapus. Jadikan kop lain sebagai bawaan lebih dulu.');
    // Template yang memakai kop ini beralih ke kop bawaan, bukan kehilangan kop.
    this.db.run("UPDATE templates SET letterheadMode = 'default', letterheadId = NULL WHERE letterheadMode = 'library' AND letterheadId = ?", [id]);
    this.db.run('DELETE FROM letterheads WHERE id = ?', [id]);
    return { message: `Kop "${row.name}" dihapus.` };
  }
}

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('api/kop')
export class LetterheadsController {
  constructor(private readonly service: LetterheadsService) {}

  @Get()
  list() {
    return { data: this.service.list() };
  }

  @Get(':id')
  get(@Param('id', ParseIntPipe) id: number) {
    return this.service.get(id);
  }

  @RequirePermission('template.kelola')
  @Post()
  create(@Body() body: { name?: string; html?: string; isDefault?: boolean }) {
    return this.service.create(body);
  }

  @RequirePermission('template.kelola')
  @Put(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() body: { name?: string; html?: string }) {
    return this.service.update(id, body);
  }

  @RequirePermission('template.kelola')
  @Put(':id/bawaan')
  setDefault(@Param('id', ParseIntPipe) id: number) {
    return this.service.setDefault(id);
  }

  @RequirePermission('template.kelola')
  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.service.remove(id);
  }
}

@Module({
  controllers: [LetterheadsController],
  providers: [LetterheadsService],
  exports: [LetterheadsService],
})
export class LetterheadsModule {}
