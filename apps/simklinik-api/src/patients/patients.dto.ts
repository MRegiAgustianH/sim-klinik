import { IsNotEmpty, IsString, IsOptional, IsIn, Length, Matches } from 'class-validator';

// NIK hanya boleh angka: @Length saja meloloskan 16 huruf. NIK yang bukan
// angka tidak akan pernah cocok dengan identitas pasien mana pun.
const NIK_PATTERN = /^\d{16}$/;
const NIK_MESSAGE = 'NIK harus terdiri dari tepat 16 digit angka (tanpa spasi atau tanda baca).';

export class CreatePatientDto {
  @IsNotEmpty({ message: 'NIK wajib diisi' })
  @IsString()
  @Length(16, 16, { message: 'NIK harus terdiri dari tepat 16 digit' })
  @Matches(NIK_PATTERN, { message: NIK_MESSAGE })
  nik: string;

  // Diisi form saat staf memilih pasien lama dari hasil pencarian otomatis.
  // Bila kosong, backend mencari berdasarkan NIK lalu membuat identitas baru.
  @IsOptional()
  patientId?: number;

  @IsNotEmpty({ message: 'Nama lengkap wajib diisi' })
  @IsString()
  fullName: string;

  @IsNotEmpty({ message: 'Jenis kelamin wajib dipilih' })
  @IsIn(['Laki-laki', 'Perempuan'], { message: 'Jenis kelamin harus Laki-laki atau Perempuan' })
  gender: 'Laki-laki' | 'Perempuan';

  @IsNotEmpty({ message: 'Tempat lahir wajib diisi' })
  @IsString()
  birthPlace: string;

  @IsNotEmpty({ message: 'Tanggal lahir wajib diisi' })
  @IsString()
  birthDate: string; // YYYY-MM-DD

  @IsOptional()
  @IsString()
  email?: string;

  @IsNotEmpty({ message: 'Alamat lengkap wajib diisi' })
  @IsString()
  address: string;

  @IsNotEmpty({ message: 'Nomor WhatsApp wajib diisi' })
  @IsString()
  phoneWa: string;

  @IsOptional()
  @IsString()
  occupation?: string;

  @IsOptional()
  @IsIn(['Belum Kawin', 'Kawin', 'Cerai Hidup', 'Cerai Mati'])
  maritalStatus?: string;

  @IsNotEmpty({ message: 'Jenis vaksin wajib dipilih' })
  @IsString()
  vaccineType: string;

  @IsNotEmpty({ message: 'Rencana tanggal berkunjung wajib diisi' })
  @IsString()
  plannedDate: string; // YYYY-MM-DD

  @IsNotEmpty({ message: 'Rencana jam berkunjung wajib diisi' })
  @IsString()
  plannedTime: string; // e.g. 09:00 WIB

  @IsOptional()
  @IsIn(['Disetujui', 'Ditolak', 'Menunggu Persetujuan'])
  doctorApproval?: 'Disetujui' | 'Ditolak' | 'Menunggu Persetujuan';

  @IsOptional()
  @IsString()
  doctorNotes?: string;

  @IsOptional()
  @IsIn(['Selesai', 'Belum'])
  status?: 'Selesai' | 'Belum';

  @IsOptional()
  @IsString()
  doctorName?: string;

  @IsOptional()
  @IsString()
  nurseName?: string;

  @IsOptional()
  @IsString()
  adminName?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  infoSource?: string;

  @IsOptional()
  @IsString()
  icvNumber?: string;

  @IsOptional()
  @IsString()
  monthYear?: string; // YYYY-MM

  @IsOptional()
  @IsIn(['Negatif', 'Positif', 'Tidak Dilakukan'])
  pregnancyTestResult?: 'Negatif' | 'Positif' | 'Tidak Dilakukan';

  @IsOptional()
  @IsString()
  batchNumber?: string;
}

export class UpdatePatientDto extends CreatePatientDto {}

export class DoctorApprovalDto {
  @IsNotEmpty({ message: 'Status persetujuan wajib diisi' })
  @IsIn(['Disetujui', 'Ditolak', 'Menunggu Persetujuan'])
  doctorApproval: 'Disetujui' | 'Ditolak' | 'Menunggu Persetujuan';

  @IsOptional()
  @IsString()
  doctorNotes?: string;

  @IsOptional()
  @IsString()
  doctorName?: string;
}

export class CompleteVaccinationDto {
  @IsNotEmpty({ message: 'Nomor batch vaksin wajib ditentukan' })
  @IsString()
  batchNumber: string;

  @IsOptional()
  @IsString()
  icvNumber?: string;

  @IsOptional()
  @IsString()
  nurseName?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
