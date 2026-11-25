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
  Query,
  UseGuards,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard, RequirePermission } from '../auth/permissions.guard';

interface SignerBody {
  name?: string;
  position?: string;
  idLabel?: string;
  idNumber?: string;
  isActive?: boolean;
  sortOrder?: number;
}

// Daftar penandatangan (nama, jabatan, NIP/SIP) agar tidak diketik ulang di
// setiap surat. Surat menyimpan salinannya di letter_signers, jadi mengubah
// atau menghapus penandatangan tidak mengubah surat yang sudah dibuat.
@Injectable()
export class SignersService {
  constructor(private readonly db: DatabaseService) {}

  list(includeInactive: boolean) {
    return this.db.query(
      `SELECT * FROM signers ${includeInactive ? '' : 'WHERE isActive = 1'} ORDER BY sortOrder ASC, name ASC`
    );
  }

  get(id: number) {
    const row = this.db.get('SELECT * FROM signers WHERE id = ?', [id]);
    if (!row) throw new NotFoundException('Penandatangan tidak ditemukan.');
    return row;
  }

  private clean(body: SignerBody) {
    const name = String(body?.name || '').trim();
    const position = String(body?.position || '').trim();
    if (!name) throw new BadRequestException('Nama penandatangan wajib diisi.');
    if (!position) throw new BadRequestException('Jabatan wajib diisi.');
    return {
      name,
      position,
      idLabel: String(body.idLabel || '').trim() || null,
      idNumber: String(body.idNumber || '').trim() || null,
      isActive: body.isActive === false ? 0 : 1,
      sortOrder: Number.isFinite(Number(body.sortOrder)) ? Number(body.sortOrder) : 0,
    };
  }

  create(body: SignerBody) {
    const s = this.clean(body);
    const result = this.db.run(
      'INSERT INTO signers (name, position, idLabel, idNumber, isActive, sortOrder) VALUES (?, ?, ?, ?, ?, ?)',
      [s.name, s.position, s.idLabel, s.idNumber, s.isActive, s.sortOrder]
    );
    return this.get(Number(result.lastInsertRowid));
  }

  update(id: number, body: SignerBody) {
    this.get(id);
    const s = this.clean(body);
    this.db.run(
      `UPDATE signers SET name = ?, position = ?, idLabel = ?, idNumber = ?, isActive = ?, sortOrder = ?,
         updatedAt = CURRENT_TIMESTAMP WHERE id = ?`,
      [s.name, s.position, s.idLabel, s.idNumber, s.isActive, s.sortOrder, id]
    );
    return this.get(id);
  }

  remove(id: number) {
    this.get(id);
    this.db.run('DELETE FROM signers WHERE id = ?', [id]);
    return { message: 'Penandatangan dihapus.' };
  }
}

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('api/penandatangan')
export class SignersController {
  constructor(private readonly service: SignersService) {}

  @Get()
  list(@Query('semua') all?: string) {
    return { data: this.service.list(all === '1') };
  }

  @RequirePermission('template.kelola')
  @Post()
  create(@Body() body: SignerBody) {
    return this.service.create(body);
  }

  @RequirePermission('template.kelola')
  @Put(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() body: SignerBody) {
    return this.service.update(id, body);
  }

  @RequirePermission('template.kelola')
  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.service.remove(id);
  }
}

@Module({
  controllers: [SignersController],
  providers: [SignersService],
})
export class SignersModule {}
