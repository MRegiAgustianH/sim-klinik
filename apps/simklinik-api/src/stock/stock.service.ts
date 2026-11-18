import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { DatabaseService, SqliteParam } from '../database/database.service';
import {
  CreateVaccineStockDto,
  UpdateVaccineStockDto,
  AddStockMutationDto,
  CreateIcvInventoryDto,
} from './stock.dto';

export interface VaccineStockItem {
  id: number;
  vaccineName: string;
  manufacturer: string | null;
  batchNumber: string;
  initialStock: number;
  currentStock: number;
  unit: string;
  expiryDate: string;
  minStockAlert: number;
  status: 'Tersedia' | 'Menipis' | 'Habis' | 'Kadaluarsa';
  createdAt: string;
  updatedAt: string;
}

export interface IcvInventoryItem {
  id: number;
  batchCode: string;
  startSerial: string;
  endSerial: string;
  totalStock: number;
  usedStock: number;
  remainingStock: number;
  receivedDate: string;
  officerName: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface StockMutationItem {
  id: number;
  itemType: 'VACCINE' | 'ICV';
  itemId: number | null;
  itemName: string;
  batchOrSerial: string | null;
  type: 'IN' | 'OUT' | 'ADJUSTMENT';
  quantity: number;
  referenceId: number | null;
  notes: string | null;
  officerName: string;
  createdAt: string;
}

@Injectable()
export class StockService {
  constructor(private readonly db: DatabaseService) {}

  // 1. STOK VAKSIN
  getAllVaccineStocks(): VaccineStockItem[] {
    const today = new Date().toISOString().split('T')[0];
    const items = this.db.query<VaccineStockItem>(
      'SELECT * FROM vaccine_stocks ORDER BY vaccineName ASC, expiryDate ASC'
    );

    // Hitung status aktual secara dinamis
    return items.map((item) => {
      let status: 'Tersedia' | 'Menipis' | 'Habis' | 'Kadaluarsa' = 'Tersedia';
      if (item.expiryDate && item.expiryDate < today) {
        status = 'Kadaluarsa';
      } else if (item.currentStock === 0) {
        status = 'Habis';
      } else if (item.currentStock <= item.minStockAlert) {
        status = 'Menipis';
      }
      return { ...item, status };
    });
  }

  getVaccineStockById(id: number): VaccineStockItem {
    const item = this.db.get<VaccineStockItem>(
      'SELECT * FROM vaccine_stocks WHERE id = ?',
      [id]
    );
    if (!item) {
      throw new NotFoundException(`Data stok vaksin dengan ID ${id} tidak ditemukan.`);
    }
    return item;
  }

  createVaccineStock(dto: CreateVaccineStockDto, officerName: string): VaccineStockItem {
    const existing = this.db.get<{ id: number }>(
      'SELECT id FROM vaccine_stocks WHERE batchNumber = ?',
      [dto.batchNumber.trim()]
    );
    if (existing) {
      throw new BadRequestException(`Nomor batch '${dto.batchNumber}' sudah terdaftar dalam sistem.`);
    }

    const today = new Date().toISOString().split('T')[0];
    let status: 'Tersedia' | 'Menipis' | 'Habis' | 'Kadaluarsa' = 'Tersedia';
    if (dto.expiryDate < today) {
      status = 'Kadaluarsa';
    } else if (dto.initialStock === 0) {
      status = 'Habis';
    } else if (dto.initialStock <= (dto.minStockAlert || 10)) {
      status = 'Menipis';
    }

    const res = this.db.run(
      `INSERT INTO vaccine_stocks (
        vaccineName, manufacturer, batchNumber, initialStock, currentStock,
        unit, expiryDate, minStockAlert, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        dto.vaccineName.trim(),
        dto.manufacturer ? dto.manufacturer.trim() : null,
        dto.batchNumber.trim(),
        dto.initialStock,
        dto.initialStock,
        dto.unit || 'Dosis',
        dto.expiryDate,
        dto.minStockAlert || 10,
        status,
      ]
    );

    const newId = Number(res.lastInsertRowid);

    // Catat mutasi stok masuk
    this.db.run(
      `INSERT INTO stock_mutations (itemType, itemId, itemName, batchOrSerial, type, quantity, notes, officerName)
       VALUES ('VACCINE', ?, ?, ?, 'IN', ?, 'Penerimaan awal stok vaksin', ?)`,
      [newId, dto.vaccineName, dto.batchNumber, dto.initialStock, officerName]
    );

    return this.getVaccineStockById(newId);
  }

  updateVaccineStock(id: number, dto: UpdateVaccineStockDto): VaccineStockItem {
    const current = this.getVaccineStockById(id);

    const updates: string[] = ['updatedAt = CURRENT_TIMESTAMP'];
    const params: SqliteParam[] = [];

    if (dto.vaccineName) {
      updates.push('vaccineName = ?');
      params.push(dto.vaccineName.trim());
    }
    if (dto.manufacturer !== undefined) {
      updates.push('manufacturer = ?');
      params.push(dto.manufacturer ? dto.manufacturer.trim() : null);
    }
    if (dto.batchNumber) {
      updates.push('batchNumber = ?');
      params.push(dto.batchNumber.trim());
    }
    if (dto.currentStock !== undefined) {
      updates.push('currentStock = ?');
      params.push(dto.currentStock);
    }
    if (dto.unit) {
      updates.push('unit = ?');
      params.push(dto.unit);
    }
    if (dto.expiryDate) {
      updates.push('expiryDate = ?');
      params.push(dto.expiryDate);
    }
    if (dto.minStockAlert !== undefined) {
      updates.push('minStockAlert = ?');
      params.push(dto.minStockAlert);
    }
    if (dto.status) {
      updates.push('status = ?');
      params.push(dto.status);
    }

    params.push(id);
    this.db.run(`UPDATE vaccine_stocks SET ${updates.join(', ')} WHERE id = ?`, params);

    return this.getVaccineStockById(id);
  }

  deleteVaccineStock(id: number): { message: string } {
    const item = this.getVaccineStockById(id);
    this.db.run('DELETE FROM vaccine_stocks WHERE id = ?', [id]);
    return { message: `Stok vaksin ${item.vaccineName} (Batch: ${item.batchNumber}) berhasil dihapus.` };
  }

  // 2. INVENTARIS BUKU ICV
  getAllIcvInventory(): {
    summary: { totalReceived: number; totalUsed: number; totalRemaining: number };
    batches: IcvInventoryItem[];
  } {
    const batches = this.db.query<IcvInventoryItem>(
      'SELECT * FROM icv_inventory ORDER BY id DESC'
    );

    const stats = this.db.get<{
      totalReceived: number;
      totalUsed: number;
      totalRemaining: number;
    }>(
      `SELECT
        COALESCE(SUM(totalStock), 0) as totalReceived,
        COALESCE(SUM(usedStock), 0) as totalUsed,
        COALESCE(SUM(remainingStock), 0) as totalRemaining
      FROM icv_inventory`
    );

    return {
      summary: stats || { totalReceived: 0, totalUsed: 0, totalRemaining: 0 },
      batches,
    };
  }

  createIcvInventory(dto: CreateIcvInventoryDto, officerNameDefault: string): IcvInventoryItem {
    const officer = dto.officerName || officerNameDefault;

    const res = this.db.run(
      `INSERT INTO icv_inventory (
        batchCode, startSerial, endSerial, totalStock, usedStock, remainingStock,
        receivedDate, officerName, notes
      ) VALUES (?, ?, ?, ?, 0, ?, ?, ?, ?)`,
      [
        dto.batchCode.trim(),
        dto.startSerial.trim(),
        dto.endSerial.trim(),
        dto.totalStock,
        dto.totalStock,
        dto.receivedDate,
        officer,
        dto.notes ? dto.notes.trim() : null,
      ]
    );

    const newId = Number(res.lastInsertRowid);

    // Catat mutasi masuk
    this.db.run(
      `INSERT INTO stock_mutations (itemType, itemId, itemName, batchOrSerial, type, quantity, notes, officerName)
       VALUES ('ICV', ?, 'Buku Kuning ICV', ?, 'IN', ?, 'Penerimaan Buku ICV Seri ' || ? || ' s/d ' || ?, ?)`,
      [newId, dto.batchCode, dto.totalStock, dto.startSerial, dto.endSerial, officer]
    );

    const created = this.db.get<IcvInventoryItem>(
      'SELECT * FROM icv_inventory WHERE id = ?',
      [newId]
    );
    if (!created) {
      throw new NotFoundException('Gagal mengambil data penerimaan ICV yang baru dibuat.');
    }
    return created;
  }

  // 3. RIWAYAT MUTASI STOK
  getAllMutations(limit = 100, offset = 0, itemType?: string): { total: number; data: StockMutationItem[] } {
    const conditions: string[] = ['1=1'];
    const params: SqliteParam[] = [];

    if (itemType && itemType !== 'all') {
      conditions.push('itemType = ?');
      params.push(itemType);
    }

    const whereClause = conditions.join(' AND ');

    const countRes = this.db.get<{ total: number }>(
      `SELECT COUNT(*) as total FROM stock_mutations WHERE ${whereClause}`,
      params
    );
    const total = countRes ? countRes.total : 0;

    const queryParams: SqliteParam[] = [...params, limit, offset];
    const data = this.db.query<StockMutationItem>(
      `SELECT * FROM stock_mutations WHERE ${whereClause} ORDER BY id DESC LIMIT ? OFFSET ?`,
      queryParams
    );

    return { total, data };
  }

  addManualMutation(dto: AddStockMutationDto, officerNameDefault: string) {
    const officer = dto.officerName || officerNameDefault;

    // Jika mutasi vaksin, perbarui stok pada tabel vaccine_stocks
    if (dto.itemType === 'VACCINE' && dto.itemId) {
      const stock = this.getVaccineStockById(dto.itemId);
      let newStock = stock.currentStock;

      if (dto.type === 'IN') {
        newStock += dto.quantity;
      } else if (dto.type === 'OUT') {
        if (stock.currentStock < dto.quantity) {
          throw new BadRequestException(
            `Stok vaksin ${stock.vaccineName} tidak mencukupi (Tersedia: ${stock.currentStock}, Diminta: ${dto.quantity}).`
          );
        }
        newStock -= dto.quantity;
      } else if (dto.type === 'ADJUSTMENT') {
        newStock = dto.quantity;
      }

      const newStatus = newStock === 0 ? 'Habis' : (newStock <= stock.minStockAlert ? 'Menipis' : 'Tersedia');
      this.db.run(
        'UPDATE vaccine_stocks SET currentStock = ?, status = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?',
        [newStock, newStatus, stock.id]
      );
    }

    this.db.run(
      `INSERT INTO stock_mutations (itemType, itemId, itemName, batchOrSerial, type, quantity, notes, officerName)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        dto.itemType,
        dto.itemId || null,
        dto.itemName,
        dto.batchOrSerial || null,
        dto.type,
        dto.quantity,
        dto.notes || 'Penyesuaian stok manual',
        officer,
      ]
    );

    return { message: 'Mutasi stok berhasil dicatat.' };
  }
}
