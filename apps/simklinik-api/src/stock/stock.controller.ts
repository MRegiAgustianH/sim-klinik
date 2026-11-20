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
import { StockService } from './stock.service';
import {
  CreateVaccineStockDto,
  UpdateVaccineStockDto,
  AddStockMutationDto,
  CreateIcvInventoryDto,
} from './stock.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard, RequirePermission } from '../auth/permissions.guard';
import { PERMISSIONS } from '../auth/permissions';
import { AuthUser } from '../auth/jwt.strategy';

@Controller('api/stock')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class StockController {
  constructor(private readonly stockService: StockService) {}

  // 1. VAKSIN
  @Get('vaccines')
  getAllVaccineStocks() {
    return this.stockService.getAllVaccineStocks();
  }

  @Get('vaccines/:id')
  getVaccineStockById(@Param('id', ParseIntPipe) id: number) {
    return this.stockService.getVaccineStockById(id);
  }

  @Post('vaccines')
  @RequirePermission(PERMISSIONS.STOK_TULIS)
  createVaccineStock(
    @Body() dto: CreateVaccineStockDto,
    @Request() req: { user: AuthUser }
  ) {
    return this.stockService.createVaccineStock(dto, req.user.fullName);
  }

  @Put('vaccines/:id')
  @RequirePermission(PERMISSIONS.STOK_TULIS)
  updateVaccineStock(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateVaccineStockDto
  ) {
    return this.stockService.updateVaccineStock(id, dto);
  }

  @Delete('vaccines/:id')
  @RequirePermission(PERMISSIONS.STOK_HAPUS)
  deleteVaccineStock(@Param('id', ParseIntPipe) id: number) {
    return this.stockService.deleteVaccineStock(id);
  }

  // 2. ICV
  @Get('icv')
  getAllIcvInventory() {
    return this.stockService.getAllIcvInventory();
  }

  @Post('icv')
  @RequirePermission(PERMISSIONS.STOK_TULIS)
  createIcvInventory(
    @Body() dto: CreateIcvInventoryDto,
    @Request() req: { user: AuthUser }
  ) {
    return this.stockService.createIcvInventory(dto, req.user.fullName);
  }

  // 3. MUTASI
  @Get('mutations')
  getAllMutations(
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
    @Query('itemType') itemType?: string,
  ) {
    return this.stockService.getAllMutations(
      limit ? Number(limit) : 100,
      offset ? Number(offset) : 0,
      itemType
    );
  }

  @Post('mutations')
  @RequirePermission(PERMISSIONS.STOK_TULIS)
  addManualMutation(
    @Body() dto: AddStockMutationDto,
    @Request() req: { user: AuthUser }
  ) {
    return this.stockService.addManualMutation(dto, req.user.fullName);
  }
}
