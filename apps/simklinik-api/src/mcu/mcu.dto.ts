import { IsNotEmpty, IsString, IsOptional, IsIn, Matches } from 'class-validator';

// NIK wajib 16 digit bila diisi. Sebelumnya kolom ini menerima teks apa pun,
// dan nilai 17 digit sempat masuk sehingga rekam tersebut gagal ditautkan ke
// identitas pasien. NIK kosong tetap diperbolehkan untuk pasien tanpa kartu.
const NIK_PATTERN = /^\d{16}$/;
const NIK_MESSAGE = 'NIK harus tepat 16 digit angka (tanpa spasi atau tanda baca).';

export class CreateMcuDto {
  @IsNotEmpty({ message: 'Nama pasien wajib diisi' })
  @IsString()
  patientName: string;

  @IsOptional()
  @Matches(NIK_PATTERN, { message: NIK_MESSAGE })
  nik?: string;

  @IsNotEmpty({ message: 'Umur / Jenis Kelamin wajib diisi' })
  @IsString()
  ageGender: string;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'Tanggal lahir harus berformat YYYY-MM-DD.' })
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
