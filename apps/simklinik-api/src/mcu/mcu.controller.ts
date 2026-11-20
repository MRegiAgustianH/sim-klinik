import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Query,
  Res,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
import { McuService } from './mcu.service';
import { CreateMcuDto, UpdateMcuDto } from './mcu.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard, RequirePermission } from '../auth/permissions.guard';
import { PERMISSIONS } from '../auth/permissions';

@Controller('api/mcu')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class McuController {
  constructor(private readonly mcuService: McuService) {}

  @Get()
  getAll(
    @Query('search') search?: string,
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
  ) {
    return this.mcuService.getAll(search, limit ? Number(limit) : 50, offset ? Number(offset) : 0);
  }

  @Get(':id')
  getById(@Param('id', ParseIntPipe) id: number) {
    return this.mcuService.getById(id);
  }

  @Post()
  @RequirePermission(PERMISSIONS.MCU_TULIS)
  create(@Body() dto: CreateMcuDto) {
    return this.mcuService.create(dto);
  }

  @Put(':id')
  @RequirePermission(PERMISSIONS.MCU_TULIS)
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateMcuDto) {
    return this.mcuService.update(id, dto);
  }

  @Delete(':id')
  @RequirePermission(PERMISSIONS.MCU_HAPUS)
  delete(@Param('id', ParseIntPipe) id: number) {
    return this.mcuService.delete(id);
  }

  @Get(':id/pdf')
  async exportPdf(@Param('id', ParseIntPipe) id: number, @Res() res: Response) {
    const buffer = await this.mcuService.generateMcuPdf(id);

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="Hasil_MCU_${id}.pdf"`,
      'Content-Length': buffer.length,
    });

    res.end(buffer);
  }
}
