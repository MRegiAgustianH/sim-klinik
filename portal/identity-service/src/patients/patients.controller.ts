import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import { PatientsService } from './patients.service';
import { CreatePatientDto, UpdatePatientDto } from './patients.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';

// Semua endpoint pasien butuh token. Tidak ada endpoint publik: seluruh data
// di sini adalah rekam identitas, termasuk NIK dan nomor telepon.
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('api/patients')
export class PatientsController {
  constructor(private readonly patientsService: PatientsService) {}

  @Get()
  search(
    @Query('q') q?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string
  ) {
    return this.patientsService.search({
      q,
      limit: limit ? Number(limit) : undefined,
      offset: offset ? Number(offset) : undefined,
    });
  }

  // Dipakai sistem surat untuk memuat beberapa pasien sekaligus dari daftar ID.
  // Didaftarkan sebelum ':id' agar 'batch' tidak terbaca sebagai ID.
  @Get('batch')
  findBatch(@Query('ids') ids?: string) {
    const parsed = (ids || '')
      .split(',')
      .map((value) => Number(value.trim()))
      .filter((value) => Number.isInteger(value) && value > 0);
    return { data: this.patientsService.findManyByIds(parsed) };
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.patientsService.findOne(id);
  }

  @Post()
  create(@Body() dto: CreatePatientDto) {
    // sourceApp diisi nama layanan pemanggil, bukan peran pengguna, agar
    // asal-usul data bisa ditelusuri saat ada duplikat.
    return this.patientsService.create(dto, 'api');
  }

  @Put(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdatePatientDto) {
    return this.patientsService.update(id, dto);
  }

  @Patch(':id')
  patch(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdatePatientDto) {
    return this.patientsService.update(id, dto);
  }
}
