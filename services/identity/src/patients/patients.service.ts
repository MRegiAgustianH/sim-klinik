import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { DatabaseService, SqliteParam } from '../database/database.service';
import { CreatePatientDto, UpdatePatientDto } from './patients.dto';

export interface PatientRow {
  id: number;
  nik: string | null;
  fullName: string;
  gender: string;
  birthPlace: string | null;
  birthDate: string | null;
  email: string | null;
  address: string | null;
  phoneWa: string | null;
  occupation: string | null;
  maritalStatus: string | null;
  bloodType: string | null;
  allergy: string | null;
  sourceApp: string | null;
  createdAt: string;
  updatedAt: string;
}

const PATIENT_COLUMNS = [
  'nik',
  'fullName',
  'gender',
  'birthPlace',
  'birthDate',
  'email',
  'address',
  'phoneWa',
  'occupation',
  'maritalStatus',
  'bloodType',
  'allergy',
] as const;

export interface SearchPatientsOptions {
  q?: string;
  limit?: number;
  offset?: number;
}

@Injectable()
export class PatientsService {
  constructor(private readonly db: DatabaseService) {}

  // Umur dihitung dari birthDate, bukan disimpan, agar tidak pernah basi.
  private withAge(row: PatientRow) {
    return { ...row, age: calculateAge(row.birthDate) };
  }

  private assertNikFormat(nik?: string | null) {
    if (!nik) return;
    // Kosong dan 16 digit sudah dijaga DTO; di sini menangkap NIK yang
    // dikirim sebagai string kosong setelah trim.
    const trimmed = nik.trim();
    if (trimmed.length > 0 && trimmed.length !== 16) {
      throw new BadRequestException('NIK harus terdiri dari 16 digit angka.');
    }
  }

  // Indeks unik parsial hanya berlaku untuk NIK 16 digit. Pesan error dibuat
  // jelas supaya staf tahu harus mencari pasien yang sudah ada, bukan membuat baru.
  private assertNikUnique(nik: string | null | undefined, excludeId?: number) {
    if (!nik || nik.trim().length !== 16) return;
    const existing = this.db.get<{ id: number }>(
      'SELECT id FROM patients WHERE nik = ? AND id <> ?',
      [nik.trim(), excludeId ?? 0]
    );
    if (existing) {
      throw new ConflictException(
        `NIK ${nik} sudah terdaftar atas nama pasien lain (ID ${existing.id}). Cari pasien tersebut, jangan buat baru.`
      );
    }
  }

  create(dto: CreatePatientDto, sourceApp: string): PatientRow {
    this.assertNikFormat(dto.nik);
    this.assertNikUnique(dto.nik);

    const values: Record<(typeof PATIENT_COLUMNS)[number], SqliteParam> = {
      nik: dto.nik?.trim() || null,
      fullName: dto.fullName.trim(),
      gender: dto.gender,
      birthPlace: dto.birthPlace ?? null,
      birthDate: dto.birthDate ?? null,
      email: dto.email ?? null,
      address: dto.address ?? null,
      phoneWa: dto.phoneWa ?? null,
      occupation: dto.occupation ?? null,
      maritalStatus: dto.maritalStatus ?? null,
      bloodType: dto.bloodType ?? null,
      allergy: dto.allergy ?? null,
    };

    const result = this.db.run(
      `INSERT INTO patients (${PATIENT_COLUMNS.join(', ')}, sourceApp)
       VALUES (${PATIENT_COLUMNS.map(() => '?').join(', ')}, ?)`,
      [...PATIENT_COLUMNS.map((col) => values[col]), sourceApp]
    );

    return this.findOne(Number(result.lastInsertRowid));
  }

  findOne(id: number): PatientRow {
    const row = this.db.get<PatientRow>('SELECT * FROM patients WHERE id = ?', [id]);
    if (!row) {
      throw new NotFoundException(`Pasien dengan ID ${id} tidak ditemukan.`);
    }
    return this.withAge(row);
  }

  // Pencarian untuk dipakai app lain: pilih pasien yang sudah ada sebelum
  // membuat baru. NIK dicocokkan persis, nama/telepon memakai LIKE.
  search(options: SearchPatientsOptions) {
    const limit = Math.min(Math.max(options.limit ?? 20, 1), 100);
    const offset = Math.max(options.offset ?? 0, 0);

    const where: string[] = [];
    const params: SqliteParam[] = [];

    const q = options.q?.trim();
    if (q) {
      if (/^\d{16}$/.test(q)) {
        where.push('nik = ?');
        params.push(q);
      } else {
        where.push('(fullName LIKE ? OR phoneWa LIKE ? OR nik LIKE ?)');
        const like = `%${q}%`;
        params.push(like, like, like);
      }
    }

    const clause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';
    const total = this.db.get<{ count: number }>(`SELECT COUNT(*) as count FROM patients ${clause}`, params);
    const rows = this.db.query<PatientRow>(
      `SELECT * FROM patients ${clause} ORDER BY fullName ASC LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    return {
      total: total?.count ?? 0,
      limit,
      offset,
      data: rows.map((row) => this.withAge(row)),
    };
  }

  // Dipakai app lain untuk melengkapi data pasien dengan ID saja (mis. endpoint
  // batch dipakai sistem surat untuk memuat banyak pasien sekaligus).
  findManyByIds(ids: number[]): PatientRow[] {
    const uniqueIds = [...new Set(ids.filter((id) => Number.isInteger(id) && id > 0))];
    if (uniqueIds.length === 0) return [];
    const placeholders = uniqueIds.map(() => '?').join(', ');
    return this.db
      .query<PatientRow>(`SELECT * FROM patients WHERE id IN (${placeholders})`, uniqueIds)
      .map((row) => this.withAge(row));
  }

  update(id: number, dto: UpdatePatientDto): PatientRow {
    const current = this.db.get<PatientRow>('SELECT * FROM patients WHERE id = ?', [id]);
    if (!current) {
      throw new NotFoundException(`Pasien dengan ID ${id} tidak ditemukan.`);
    }

    if (dto.nik !== undefined) {
      this.assertNikFormat(dto.nik);
      this.assertNikUnique(dto.nik, id);
    }

    const updates: string[] = [];
    const params: SqliteParam[] = [];
    for (const col of PATIENT_COLUMNS) {
      const value = dto[col];
      if (value === undefined) continue;
      updates.push(`${col} = ?`);
      params.push(col === 'nik' ? (value as string)?.trim() || null : (value as string));
    }

    if (updates.length === 0) {
      return this.findOne(id);
    }

    params.push(id);
    this.db.run(
      `UPDATE patients SET ${updates.join(', ')}, updatedAt = CURRENT_TIMESTAMP WHERE id = ?`,
      params
    );

    return this.findOne(id);
  }
}

export function calculateAge(birthDate: string | null): number | null {
  if (!birthDate || !/^\d{4}-\d{2}-\d{2}$/.test(birthDate)) return null;

  const [year, month, day] = birthDate.split('-').map(Number);
  const today = new Date();
  let age = today.getFullYear() - year;
  const birthdayPassed =
    today.getMonth() + 1 > month || (today.getMonth() + 1 === month && today.getDate() >= day);
  if (!birthdayPassed) age -= 1;
  return age >= 0 ? age : null;
}
