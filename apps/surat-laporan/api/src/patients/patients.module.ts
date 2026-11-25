import {
  BadRequestException,
  Controller,
  ForbiddenException,
  Get,
  Headers,
  HttpException,
  Module,
  Param,
  ParseIntPipe,
  Query,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { IdentityClient, IdentityError } from '../identity/identity-client.service';

// Data pasien untuk surat keluar dibaca langsung dari layanan identitas.
// Sistem surat tidak menyimpan tabel pasien: surat hanya menyimpan patientId
// dan salinan ringkas (nama, NIK) untuk arsip.
@UseGuards(JwtAuthGuard)
@Controller('api/pasien')
export class PatientsController {
  constructor(private readonly identity: IdentityClient) {}

  @Get()
  async search(@Headers('authorization') auth: string, @Query('q') q?: string) {
    const query = String(q || '').trim();
    if (query.length < 2) return { total: 0, data: [] };
    try {
      return await this.identity.searchPatients(query, tokenOf(auth));
    } catch (err) {
      throw toHttp(err);
    }
  }

  @Get(':id')
  async get(@Headers('authorization') auth: string, @Param('id', ParseIntPipe) id: number) {
    try {
      return await this.identity.getPatient(id, tokenOf(auth));
    } catch (err) {
      throw toHttp(err);
    }
  }
}

function tokenOf(authorization: string): string {
  return String(authorization || '').replace(/^Bearer\s+/i, '').trim();
}

function toHttp(err: unknown): unknown {
  if (!(err instanceof IdentityError)) return err;
  if (err.status === 401) return new UnauthorizedException(err.message);
  if (err.status === 403) return new ForbiddenException(err.message);
  if (err.status === 400) return new BadRequestException(err.message);
  return new HttpException(err.message, err.status);
}

@Module({ controllers: [PatientsController] })
export class PatientsModule {}
