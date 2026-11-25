import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Module,
  NotFoundException,
  Param,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UPLOADS_DIR } from '../config/paths';

const TYPES: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpeg',
  'image/gif': 'gif',
  'image/webp': 'webp',
};
const MIME_BY_EXT: Record<string, string> = { png: 'image/png', jpeg: 'image/jpeg', jpg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp' };
const MAX_BYTES = 5 * 1024 * 1024;
const FILE_RE = /^[a-z0-9-]{1,64}\.(png|jpe?g|gif|webp)$/;

// Gambar kop, logo, dan gambar yang disisipkan di editor. Disimpan sebagai
// file agar isi surat cukup menyimpan alamatnya, bukan base64 berukuran besar
// di setiap surat.
@Controller('api/uploads')
export class UploadsController {
  @UseGuards(JwtAuthGuard)
  @Post()
  upload(@Body() body: { dataUrl?: string }) {
    const match = /^data:(image\/[a-z+]+);base64,([A-Za-z0-9+/=\s]+)$/.exec(String(body?.dataUrl || ''));
    if (!match || !TYPES[match[1]]) throw new BadRequestException('Hanya gambar PNG, JPEG, GIF, atau WEBP yang bisa diunggah.');
    const buffer = Buffer.from(match[2], 'base64');
    if (buffer.length > MAX_BYTES) throw new BadRequestException('Ukuran gambar maksimal 5 MB.');
    const name = `${crypto.randomBytes(16).toString('hex')}.${TYPES[match[1]]}`;
    fs.writeFileSync(path.join(UPLOADS_DIR, name), buffer);
    return { url: `/api/uploads/${name}` };
  }

  // Tanpa token: <img> di halaman cetak dan file .doc tidak bisa mengirim
  // header Authorization. Nama file acak 128-bit, jadi tidak bisa ditebak.
  @Get(':file')
  serve(@Param('file') file: string, @Res() res: Response) {
    if (!FILE_RE.test(file)) throw new NotFoundException();
    const full = path.join(UPLOADS_DIR, file);
    if (!fs.existsSync(full)) throw new NotFoundException('Gambar tidak ditemukan.');
    res.setHeader('Content-Type', MIME_BY_EXT[file.split('.').pop() as string]);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    fs.createReadStream(full).pipe(res);
  }
}

@Module({ controllers: [UploadsController] })
export class UploadsModule {}
