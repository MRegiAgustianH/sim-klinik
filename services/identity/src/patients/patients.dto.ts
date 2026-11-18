import {
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

// NIK kosong diperbolehkan (pasien darurat tanpa kartu identitas), tetapi bila
// diisi harus tepat 16 digit. Pemeriksaan NIK pada dokumen asli tetap dilakukan
// staf; layanan ini hanya menjaga format dan keunikan.
const NIK_PATTERN = /^\d{16}$/;
const NIK_MESSAGE = 'NIK harus terdiri dari 16 digit angka.';

const GENDERS = ['Laki-laki', 'Perempuan', 'Lainnya'];
const MARITAL = ['Belum Kawin', 'Kawin', 'Cerai Hidup', 'Cerai Mati', 'Tidak Diketahui'];

export class CreatePatientDto {
  @IsOptional()
  @Matches(NIK_PATTERN, { message: NIK_MESSAGE })
  nik?: string;

  @IsNotEmpty({ message: 'Nama lengkap wajib diisi' })
  @IsString()
  @MaxLength(150)
  fullName: string;

  @IsIn(GENDERS, { message: 'Jenis kelamin tidak dikenal.' })
  gender: string;

  @IsOptional()
  @IsString()
  birthPlace?: string;

  // Format YYYY-MM-DD, sesuai kolom birthDate yang sudah dipakai SIMKlinik.
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'Tanggal lahir harus berformat YYYY-MM-DD.' })
  birthDate?: string;

  @IsOptional()
  @IsEmail({}, { message: 'Format email tidak valid.' })
  email?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @Matches(/^[0-9+\-\s]{8,20}$/, { message: 'Nomor WhatsApp tidak valid.' })
  phoneWa?: string;

  @IsOptional()
  @IsString()
  occupation?: string;

  @IsOptional()
  @IsIn(MARITAL, { message: 'Status pernikahan tidak dikenal.' })
  maritalStatus?: string;

  @IsOptional()
  @IsString()
  bloodType?: string;

  @IsOptional()
  @IsString()
  allergy?: string;
}

// Semua field opsional: halaman edit hanya mengirim yang berubah.
export class UpdatePatientDto {
  @IsOptional()
  @Matches(NIK_PATTERN, { message: NIK_MESSAGE })
  nik?: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  fullName?: string;

  @IsOptional()
  @IsIn(GENDERS, { message: 'Jenis kelamin tidak dikenal.' })
  gender?: string;

  @IsOptional()
  @IsString()
  birthPlace?: string;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'Tanggal lahir harus berformat YYYY-MM-DD.' })
  birthDate?: string;

  @IsOptional()
  @IsEmail({}, { message: 'Format email tidak valid.' })
  email?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @Matches(/^[0-9+\-\s]{8,20}$/, { message: 'Nomor WhatsApp tidak valid.' })
  phoneWa?: string;

  @IsOptional()
  @IsString()
  occupation?: string;

  @IsOptional()
  @IsIn(MARITAL, { message: 'Status pernikahan tidak dikenal.' })
  maritalStatus?: string;

  @IsOptional()
  @IsString()
  bloodType?: string;

  @IsOptional()
  @IsString()
  allergy?: string;
}
