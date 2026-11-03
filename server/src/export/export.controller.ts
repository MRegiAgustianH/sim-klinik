import {
  Controller,
  Get,
  Param,
  Query,
  Res,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
import { ExportService } from './export.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('api/export')
@UseGuards(JwtAuthGuard)
export class ExportController {
  constructor(private readonly exportService: ExportService) {}

  @Get('excel')
  async exportExcel(@Query('month') month: string, @Res() res: Response) {
    const selectedMonth = month || new Date().toISOString().substring(0, 7);
    const buffer = await this.exportService.generateExcelReport(selectedMonth);

    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="Laporan_Vaksinasi_${selectedMonth}.xlsx"`,
      'Content-Length': buffer.length,
    });

    res.end(buffer);
  }

  @Get('patient/:id/pdf')
  async exportPatientPdf(@Param('id', ParseIntPipe) id: number, @Res() res: Response) {
    const buffer = await this.exportService.generatePatientPdf(id);

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="Kartu_Vaksinasi_Pasien_${id}.pdf"`,
      'Content-Length': buffer.length,
    });

    res.end(buffer);
  }

  @Get('monthly/pdf')
  async exportMonthlyPdf(@Query('month') month: string, @Res() res: Response) {
    const selectedMonth = month || new Date().toISOString().substring(0, 7);
    const buffer = await this.exportService.generateMonthlyPdf(selectedMonth);

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="Rekap_Vaksinasi_${selectedMonth}.pdf"`,
      'Content-Length': buffer.length,
    });

    res.end(buffer);
  }
}
