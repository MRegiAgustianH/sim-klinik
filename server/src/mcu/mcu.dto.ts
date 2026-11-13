import { IsNotEmpty, IsString, IsOptional, IsIn } from 'class-validator';

export class CreateMcuDto {
  @IsNotEmpty({ message: 'Nama pasien wajib diisi' })
  @IsString()
  patientName: string;

  @IsOptional()
  @IsString()
  nik?: string;

  @IsNotEmpty({ message: 'Umur / Jenis Kelamin wajib diisi' })
  @IsString()
  ageGender: string;

  @IsOptional()
  @IsString()
  birthDate?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsNotEmpty({ message: 'Tanggal pemeriksaan wajib diisi' })
  @IsString()
  examDate: string;

  @IsOptional()
  @IsString()
  purpose?: string;

  // JSON stringified objects or raw text
  @IsOptional()
  vitalSigns?: string | Record<string, unknown>;

  @IsOptional()
  anthropometry?: string | Record<string, unknown>;

  @IsOptional()
  physicalExam?: string | Record<string, unknown>;

  @IsOptional()
  labExam?: string | Record<string, unknown>;

  @IsOptional()
  supportingExam?: string | Record<string, unknown>;

  @IsOptional()
  examinationSections?: string | Array<unknown>;

  @IsNotEmpty({ message: 'Kesimpulan kelayakan wajib dipilih' })
  @IsIn(['Fit', 'Fit dengan catatan', 'Temporary unfit', 'Unfit', 'Sehat', 'Sehat dengan catatan', 'Temporary Unfit'])
  conclusionType: 'Fit' | 'Fit dengan catatan' | 'Temporary unfit' | 'Unfit' | 'Sehat' | 'Sehat dengan catatan' | 'Temporary Unfit';

  @IsOptional()
  @IsString()
  conclusionNotes?: string;

  @IsOptional()
  recommendations?: string | string[];

  @IsNotEmpty({ message: 'Nama dokter pemeriksa wajib diisi' })
  @IsString()
  doctorName: string;

  @IsOptional()
  @IsString()
  doctorSip?: string;
}

export class UpdateMcuDto extends CreateMcuDto {}
