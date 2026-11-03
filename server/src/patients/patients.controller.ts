import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  ParseIntPipe,
  UseGuards,
  Request,
} from '@nestjs/common';
import { PatientsService } from './patients.service';
import { CreatePatientDto, UpdatePatientDto, DoctorApprovalDto, CompleteVaccinationDto } from './patients.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { AuthUser } from '../auth/jwt.strategy';

@Controller('api/patients')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PatientsController {
  constructor(private readonly patientsService: PatientsService) {}

  @Get()
  getAll(
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('doctorApproval') doctorApproval?: string,
    @Query('vaccineType') vaccineType?: string,
    @Query('pregnancyTestResult') pregnancyTestResult?: string,
    @Query('date') date?: string,
    @Query('month') month?: string,
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
  ) {
    return this.patientsService.getAll({
      search,
      status,
      doctorApproval,
      vaccineType,
      pregnancyTestResult,
      date,
      month,
      limit,
      offset,
    });
  }

  @Get(':id')
  getById(@Param('id', ParseIntPipe) id: number) {
    return this.patientsService.getById(id);
  }

  @Post()
  @Roles('Superadmin', 'Perawat', 'Dokter')
  create(@Body() dto: CreatePatientDto, @Request() req: { user: AuthUser }) {
    return this.patientsService.create(dto, req.user.fullName);
  }

  @Put(':id')
  @Roles('Superadmin', 'Perawat', 'Dokter')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdatePatientDto) {
    return this.patientsService.update(id, dto);
  }

  @Put(':id/doctor-approval')
  @Roles('Superadmin', 'Dokter')
  updateDoctorApproval(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: DoctorApprovalDto,
    @Request() req: { user: AuthUser }
  ) {
    return this.patientsService.updateDoctorApproval(id, dto, req.user.fullName);
  }

  @Put(':id/complete')
  @Roles('Superadmin', 'Perawat')
  completeVaccination(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CompleteVaccinationDto,
    @Request() req: { user: AuthUser }
  ) {
    return this.patientsService.completeVaccination(id, dto, req.user.fullName);
  }

  @Delete(':id')
  @Roles('Superadmin')
  delete(@Param('id', ParseIntPipe) id: number) {
    return this.patientsService.delete(id);
  }
}
