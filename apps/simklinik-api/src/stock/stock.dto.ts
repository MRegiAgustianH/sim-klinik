import { IsNotEmpty, IsString, IsNumber, IsOptional, IsIn, Min } from 'class-validator';

export class CreateVaccineStockDto {
  @IsNotEmpty({ message: 'Nama vaksin wajib diisi' })
  @IsString()
  vaccineName: string;

  @IsOptional()
  @IsString()
  manufacturer?: string;

  @IsNotEmpty({ message: 'Nomor batch wajib diisi' })
  @IsString()
  batchNumber: string;

  @IsNotEmpty({ message: 'Jumlah stok awal wajib diisi' })
  @IsNumber()
  @Min(0)
  initialStock: number;

  @IsOptional()
  @IsString()
  unit?: string;

  @IsNotEmpty({ message: 'Tanggal kadaluarsa wajib diisi' })
  @IsString()
  expiryDate: string; // YYYY-MM-DD

  @IsOptional()
  @IsNumber()
  minStockAlert?: number;
}

export class UpdateVaccineStockDto {
  @IsOptional()
  @IsString()
  vaccineName?: string;

  @IsOptional()
  @IsString()
  manufacturer?: string;

  @IsOptional()
  @IsString()
  batchNumber?: string;

  @IsOptional()
  @IsNumber()
  currentStock?: number;

  @IsOptional()
  @IsString()
  unit?: string;

  @IsOptional()
  @IsString()
  expiryDate?: string;

  @IsOptional()
  @IsNumber()
  minStockAlert?: number;

  @IsOptional()
  @IsIn(['Tersedia', 'Menipis', 'Habis', 'Kadaluarsa'])
  status?: string;
}

export class AddStockMutationDto {
  @IsNotEmpty({ message: 'Tipe barang (VACCINE/ICV) wajib dipilih' })
  @IsIn(['VACCINE', 'ICV'])
  itemType: 'VACCINE' | 'ICV';

  @IsOptional()
  @IsNumber()
  itemId?: number;

  @IsNotEmpty({ message: 'Nama barang wajib diisi' })
  @IsString()
  itemName: string;

  @IsOptional()
  @IsString()
  batchOrSerial?: string;

  @IsNotEmpty({ message: 'Jenis mutasi (IN / OUT / ADJUSTMENT) wajib dipilih' })
  @IsIn(['IN', 'OUT', 'ADJUSTMENT'])
  type: 'IN' | 'OUT' | 'ADJUSTMENT';

  @IsNotEmpty({ message: 'Jumlah mutasi wajib diisi' })
  @IsNumber()
  @Min(1)
  quantity: number;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  officerName?: string;
}

export class CreateIcvInventoryDto {
  @IsNotEmpty({ message: 'Kode batch penerimaan ICV wajib diisi' })
  @IsString()
  batchCode: string;

  @IsNotEmpty({ message: 'Nomor seri awal wajib diisi' })
  @IsString()
  startSerial: string;

  @IsNotEmpty({ message: 'Nomor seri akhir wajib diisi' })
  @IsString()
  endSerial: string;

  @IsNotEmpty({ message: 'Jumlah buku ICV diterima wajib diisi' })
  @IsNumber()
  @Min(1)
  totalStock: number;

  @IsNotEmpty({ message: 'Tanggal penerimaan wajib diisi' })
  @IsString()
  receivedDate: string; // YYYY-MM-DD

  @IsOptional()
  @IsString()
  officerName?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
