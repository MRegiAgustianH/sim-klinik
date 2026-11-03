import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { DatabaseService, SqliteParam } from '../database/database.service';
import { CreatePatientDto, UpdatePatientDto, DoctorApprovalDto, CompleteVaccinationDto } from './patients.dto';

export interface PatientRecord {
  id: number;
  nik: string;
  fullName: string;
  gender: 'Laki-laki' | 'Perempuan';
  birthPlace: string;
  birthDate: string;
  email: string | null;
  address: string;
  phoneWa: string;
  occupation: string | null;
  maritalStatus: string | null;
  vaccineType: string;
  plannedDate: string;
  plannedTime: string;
  doctorApproval: 'Disetujui' | 'Ditolak' | 'Menunggu Persetujuan';
  doctorNotes: string | null;
  status: 'Selesai' | 'Belum';
  doctorName: string | null;
  nurseName: string | null;
  adminName: string | null;
  notes: string | null;
  infoSource: string | null;
  icvNumber: string | null;
  monthYear: string;
  pregnancyTestResult: 'Negatif' | 'Positif' | 'Tidak Dilakukan';
  batchNumber: string | null;
  vaccinatedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PatientFilterOptions {
  search?: string;
  status?: string;
  doctorApproval?: string;
  vaccineType?: string;
  pregnancyTestResult?: string;
  date?: string;
  month?: string;
  limit?: number;
  offset?: number;
}

@Injectable()
export class PatientsService {
  constructor(private readonly db: DatabaseService) {}

  getAll(options: PatientFilterOptions = {}) {
    const conditions: string[] = ['1=1'];
    const params: SqliteParam[] = [];

    if (options.search && options.search.trim() !== '') {
      const q = `%${options.search.trim()}%`;
      conditions.push('(nik LIKE ? OR fullName LIKE ? OR phoneWa LIKE ? OR icvNumber LIKE ?)');
      params.push(q, q, q, q);
    }

    if (options.status && options.status !== 'all') {
      conditions.push('status = ?');
      params.push(options.status);
    }

    if (options.doctorApproval && options.doctorApproval !== 'all') {
      conditions.push('doctorApproval = ?');
      params.push(options.doctorApproval);
    }

    if (options.vaccineType && options.vaccineType !== 'all') {
      conditions.push('vaccineType = ?');
      params.push(options.vaccineType);
    }

    if (options.pregnancyTestResult && options.pregnancyTestResult !== 'all') {
      conditions.push('pregnancyTestResult = ?');
      params.push(options.pregnancyTestResult);
    }

    if (options.date && options.date.trim() !== '') {
      conditions.push('plannedDate = ?');
      params.push(options.date.trim());
    }

    if (options.month && options.month.trim() !== '') {
      conditions.push('monthYear = ?');
      params.push(options.month.trim());
    }

    const whereClause = conditions.join(' AND ');

    const countResult = this.db.get<{ total: number }>(
      `SELECT COUNT(*) as total FROM vaccination_records WHERE ${whereClause}`,
      params
    );
    const total = countResult ? countResult.total : 0;

    const limit = options.limit ? Math.max(1, Number(options.limit)) : 100;
    const offset = options.offset ? Math.max(0, Number(options.offset)) : 0;

    const queryParams: SqliteParam[] = [...params, limit, offset];
    const data = this.db.query<PatientRecord>(
      `SELECT * FROM vaccination_records WHERE ${whereClause} ORDER BY plannedDate DESC, id DESC LIMIT ? OFFSET ?`,
      queryParams
    );

    return {
      total,
      limit,
      offset,
      data,
    };
  }

  getById(id: number): PatientRecord {
    const record = this.db.get<PatientRecord>(
      'SELECT * FROM vaccination_records WHERE id = ?',
      [id]
    );
    if (!record) {
      throw new NotFoundException(`Data pasien dengan ID ${id} tidak ditemukan.`);
    }
    return record;
  }

  create(dto: CreatePatientDto, adminNameDefault?: string): PatientRecord {
    const monthYear = dto.monthYear || dto.plannedDate.substring(0, 7);
    const pregnancyTest = dto.gender === 'Laki-laki' ? 'Tidak Dilakukan' : (dto.pregnancyTestResult || 'Tidak Dilakukan');

    const res = this.db.run(
      `INSERT INTO vaccination_records (
        nik, fullName, gender, birthPlace, birthDate, email, address, phoneWa,
        occupation, maritalStatus, vaccineType, plannedDate, plannedTime,
        doctorApproval, doctorNotes, status, doctorName, nurseName, adminName,
        notes, infoSource, icvNumber, monthYear, pregnancyTestResult, batchNumber
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        dto.nik.trim(),
        dto.fullName.trim(),
        dto.gender,
        dto.birthPlace.trim(),
        dto.birthDate,
        dto.email ? dto.email.trim() : null,
        dto.address.trim(),
        dto.phoneWa.trim(),
        dto.occupation || null,
        dto.maritalStatus || 'Belum Kawin',
        dto.vaccineType,
        dto.plannedDate,
        dto.plannedTime,
        dto.doctorApproval || 'Menunggu Persetujuan',
        dto.doctorNotes || null,
        dto.status || 'Belum',
        dto.doctorName || null,
        dto.nurseName || null,
        dto.adminName || adminNameDefault || 'Petugas Admin',
        dto.notes || null,
        dto.infoSource || 'Klinik',
        dto.icvNumber || null,
        monthYear,
        pregnancyTest,
        dto.batchNumber || null,
      ]
    );

    return this.getById(Number(res.lastInsertRowid));
  }

  update(id: number, dto: UpdatePatientDto): PatientRecord {
    this.getById(id);
    const monthYear = dto.monthYear || dto.plannedDate.substring(0, 7);
    const pregnancyTest = dto.gender === 'Laki-laki' ? 'Tidak Dilakukan' : (dto.pregnancyTestResult || 'Tidak Dilakukan');

    this.db.run(
      `UPDATE vaccination_records SET
        nik = ?, fullName = ?, gender = ?, birthPlace = ?, birthDate = ?,
        email = ?, address = ?, phoneWa = ?, occupation = ?, maritalStatus = ?,
        vaccineType = ?, plannedDate = ?, plannedTime = ?, doctorApproval = ?,
        doctorNotes = ?, status = ?, doctorName = ?, nurseName = ?, adminName = ?,
        notes = ?, infoSource = ?, icvNumber = ?, monthYear = ?,
        pregnancyTestResult = ?, batchNumber = ?, updatedAt = CURRENT_TIMESTAMP
      WHERE id = ?`,
      [
        dto.nik.trim(),
        dto.fullName.trim(),
        dto.gender,
        dto.birthPlace.trim(),
        dto.birthDate,
        dto.email ? dto.email.trim() : null,
        dto.address.trim(),
        dto.phoneWa.trim(),
        dto.occupation || null,
        dto.maritalStatus || null,
        dto.vaccineType,
        dto.plannedDate,
        dto.plannedTime,
        dto.doctorApproval || 'Menunggu Persetujuan',
        dto.doctorNotes || null,
        dto.status || 'Belum',
        dto.doctorName || null,
        dto.nurseName || null,
        dto.adminName || null,
        dto.notes || null,
        dto.infoSource || null,
        dto.icvNumber || null,
        monthYear,
        pregnancyTest,
        dto.batchNumber || null,
        id,
      ]
    );

    return this.getById(id);
  }

  updateDoctorApproval(id: number, dto: DoctorApprovalDto, doctorUserFullName: string): PatientRecord {
    const record = this.getById(id);

    // Jika WUS hasil tes kehamilan positif dan jenis vaksin memiliki kontraindikasi, beri peringatan
    if (record.pregnancyTestResult === 'Positif' && dto.doctorApproval === 'Disetujui') {
      // Boleh disetujui hanya dengan catatan tegas dokter
      if (!dto.doctorNotes || dto.doctorNotes.trim() === '') {
        throw new BadRequestException('Pasien WUS berstatus hamil (tes positif). Dokter wajib memberikan catatan telaah medis/kontraindikasi.');
      }
    }

    const doctorName = dto.doctorName || doctorUserFullName;

    this.db.run(
      `UPDATE vaccination_records SET
        doctorApproval = ?,
        doctorNotes = ?,
        doctorName = ?,
        updatedAt = CURRENT_TIMESTAMP
      WHERE id = ?`,
      [dto.doctorApproval, dto.doctorNotes || null, doctorName, id]
    );

    return this.getById(id);
  }

  completeVaccination(id: number, dto: CompleteVaccinationDto, nurseUserFullName: string): PatientRecord {
    const record = this.getById(id);

    if (record.doctorApproval !== 'Disetujui') {
      throw new BadRequestException(
        `Vaksinasi tidak dapat diselesaikan karena status persetujuan dokter saat ini adalah '${record.doctorApproval}'. Pasien harus disetujui dokter terlebih dahulu.`
      );
    }

    const nurseName = dto.nurseName || nurseUserFullName;
    const nowIso = new Date().toISOString();

    // Kurangi stok vaksin jika batch valid
    if (dto.batchNumber) {
      const stock = this.db.get<{ id: number; currentStock: number }>(
        'SELECT id, currentStock FROM vaccine_stocks WHERE batchNumber = ?',
        [dto.batchNumber]
      );
      if (stock && stock.currentStock > 0) {
        const nextStock = stock.currentStock - 1;
        const newStatus = nextStock === 0 ? 'Habis' : (nextStock <= 10 ? 'Menipis' : 'Tersedia');
        this.db.run(
          'UPDATE vaccine_stocks SET currentStock = ?, status = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?',
          [nextStock, newStatus, stock.id]
        );

        // Catat mutasi
        this.db.run(
          `INSERT INTO stock_mutations (itemType, itemId, itemName, batchOrSerial, type, quantity, referenceId, notes, officerName)
           VALUES ('VACCINE', ?, ?, ?, 'OUT', 1, ?, 'Pemberian vaksin kepada pasien ' || ?, ?)`,
          [stock.id, record.vaccineType, dto.batchNumber, id, record.fullName, nurseName]
        );
      }
    }

    // Update ICV inventory jika ada No ICV yang diterbitkan
    if (dto.icvNumber && dto.icvNumber.trim() !== '' && dto.icvNumber !== '-') {
      const icvInv = this.db.get<{ id: number; usedStock: number; remainingStock: number }>(
        'SELECT id, usedStock, remainingStock FROM icv_inventory ORDER BY id DESC LIMIT 1'
      );
      if (icvInv && icvInv.remainingStock > 0) {
        this.db.run(
          'UPDATE icv_inventory SET usedStock = usedStock + 1, remainingStock = remainingStock - 1, updatedAt = CURRENT_TIMESTAMP WHERE id = ?',
          [icvInv.id]
        );
        this.db.run(
          `INSERT INTO stock_mutations (itemType, itemId, itemName, batchOrSerial, type, quantity, referenceId, notes, officerName)
           VALUES ('ICV', ?, 'Buku Kuning ICV', ?, 'OUT', 1, ?, 'Penerbitan ICV pasien ' || ?, ?)`,
          [icvInv.id, dto.icvNumber, id, record.fullName, nurseName]
        );
      }
    }

    this.db.run(
      `UPDATE vaccination_records SET
        status = 'Selesai',
        batchNumber = ?,
        icvNumber = COALESCE(?, icvNumber),
        nurseName = ?,
        notes = COALESCE(?, notes),
        vaccinatedAt = ?,
        updatedAt = CURRENT_TIMESTAMP
      WHERE id = ?`,
      [dto.batchNumber, dto.icvNumber || null, nurseName, dto.notes || null, nowIso, id]
    );

    return this.getById(id);
  }

  delete(id: number): { message: string } {
    const record = this.getById(id);
    this.db.run('DELETE FROM vaccination_records WHERE id = ?', [id]);
    return { message: `Data vaksinasi pasien ${record.fullName} (NIK: ${record.nik}) berhasil dihapus.` };
  }
}
