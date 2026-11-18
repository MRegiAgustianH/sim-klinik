import { Injectable, NotFoundException } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import { DatabaseService } from '../database/database.service';
import { PatientRecord } from '../patients/patients.service';
import { VaccineStockItem, IcvInventoryItem } from '../stock/stock.service';

@Injectable()
export class ExportService {
  constructor(private readonly db: DatabaseService) {}

  // 1. GENERATE EXCEL WORKBOOK
  async generateExcelReport(month?: string): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'VaksinKU - Hospital Vaccination System';
    workbook.created = new Date();

    const selectedMonth = month && month.trim() !== '' ? month.trim() : new Date().toISOString().substring(0, 7);

    const patients = this.db.query<PatientRecord>(
      'SELECT * FROM vaccination_records WHERE monthYear = ? ORDER BY plannedDate ASC, id ASC',
      [selectedMonth]
    );

    const vaccines = this.db.query<VaccineStockItem>(
      'SELECT * FROM vaccine_stocks ORDER BY vaccineName ASC'
    );

    const icvBatches = this.db.query<IcvInventoryItem>(
      'SELECT * FROM icv_inventory ORDER BY id DESC'
    );

    // SHEET 1: REKAP VAKSINASI PASIEN
    const sheet1 = workbook.addWorksheet('Laporan Vaksinasi Pasien', {
      views: [{ showGridLines: true }],
    });

    sheet1.mergeCells('A1:X1');
    const titleCell = sheet1.getCell('A1');
    titleCell.value = 'KLINIK UTAMA DR. H. A. ROTINSULU CIANJUR';
    titleCell.font = { name: 'Arial', size: 16, bold: true, color: { argb: 'FFFFFFFF' } };
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F766E' } };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    sheet1.getRow(1).height = 30;

    sheet1.mergeCells('A2:X2');
    const subTitleCell = sheet1.getCell('A2');
    subTitleCell.value = `LAPORAN DATA VAKSINASI & SERTIFIKASI BUKU KUNING (ICV) - PERIODE: ${selectedMonth}`;
    subTitleCell.font = { name: 'Arial', size: 12, bold: true, color: { argb: 'FF134E4A' } };
    subTitleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFCCFBF1' } };
    subTitleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    sheet1.getRow(2).height = 24;

    sheet1.mergeCells('A3:X3');
    const infoCell = sheet1.getCell('A3');
    infoCell.value = `Tanggal Ekspor: ${new Date().toLocaleDateString('id-ID')} | Total Pasien: ${patients.length} Orang`;
    infoCell.font = { name: 'Arial', size: 10, italic: true };
    infoCell.alignment = { horizontal: 'left', vertical: 'middle' };
    sheet1.getRow(3).height = 20;

    const headers = [
      'No',
      'NIK',
      'Nama Lengkap',
      'Jenis Kelamin',
      'Tempat Lahir',
      'Tanggal Lahir',
      'Email Aktif',
      'Alamat Lengkap',
      'Nomor WhatsApp',
      'Pekerjaan',
      'Status Nikah',
      'Jenis Vaksin',
      'Batch Vaksin',
      'Rencana Kunjungan',
      'Jam Kunjungan',
      'Persetujuan Dokter',
      'Catatan Dokter',
      'Status',
      'Hasil Tes WUS',
      'No Buku ICV',
      'Nama Dokter',
      'Nama Perawat',
      'Nama Admin',
      'Sumber Informasi',
    ];

    sheet1.getRow(4).values = headers;
    sheet1.getRow(4).height = 28;

    headers.forEach((_, idx) => {
      const cell = sheet1.getRow(4).getCell(idx + 1);
      cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'medium' },
        right: { style: 'thin' },
      };
    });

    patients.forEach((p, idx) => {
      const rowNum = 5 + idx;
      const rowValues = [
        idx + 1,
        p.nik,
        p.fullName,
        p.gender,
        p.birthPlace,
        p.birthDate,
        p.email || '-',
        p.address,
        p.phoneWa,
        p.occupation || '-',
        p.maritalStatus || '-',
        p.vaccineType,
        p.batchNumber || '-',
        p.plannedDate,
        p.plannedTime,
        p.doctorApproval,
        p.doctorNotes || '-',
        p.status,
        p.pregnancyTestResult,
        p.icvNumber || '-',
        p.doctorName || '-',
        p.nurseName || '-',
        p.adminName || '-',
        p.infoSource || '-',
      ];

      const row = sheet1.getRow(rowNum);
      row.values = rowValues;
      row.height = 22;

      const isZebra = idx % 2 === 1;
      row.eachCell((cell, colNumber) => {
        cell.font = { name: 'Arial', size: 9 };
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        };
        if (isZebra) {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
        }
        if (colNumber === 1 || colNumber === 4 || colNumber === 14 || colNumber === 15 || colNumber === 18 || colNumber === 19) {
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
        } else {
          cell.alignment = { vertical: 'middle' };
        }
      });
    });

    const colWidths = [6, 20, 24, 14, 16, 14, 24, 30, 16, 16, 16, 26, 16, 18, 14, 18, 26, 12, 16, 20, 24, 24, 20, 18];
    colWidths.forEach((w, idx) => {
      sheet1.getColumn(idx + 1).width = w;
    });

    // SHEET 2: MONITORING STOK VAKSIN
    const sheet2 = workbook.addWorksheet('Stok Vaksin', {
      views: [{ showGridLines: true }],
    });

    sheet2.mergeCells('A1:I1');
    const s2Title = sheet2.getCell('A1');
    s2Title.value = 'LAPORAN MONITORING STOK VAKSIN';
    s2Title.font = { name: 'Arial', size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
    s2Title.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F766E' } };
    s2Title.alignment = { horizontal: 'center', vertical: 'middle' };
    sheet2.getRow(1).height = 26;

    const s2Headers = ['No', 'Nama Vaksin', 'Pabrik/Produsen', 'No Batch', 'Stok Awal', 'Stok Saat Ini', 'Satuan', 'Tgl Kadaluarsa', 'Status Stok'];
    sheet2.getRow(3).values = s2Headers;
    s2Headers.forEach((_, idx) => {
      const cell = sheet2.getRow(3).getCell(idx + 1);
      cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF334155' } };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
    });

    vaccines.forEach((v, idx) => {
      const row = sheet2.getRow(4 + idx);
      row.values = [
        idx + 1,
        v.vaccineName,
        v.manufacturer || '-',
        v.batchNumber,
        v.initialStock,
        v.currentStock,
        v.unit,
        v.expiryDate,
        v.status,
      ];
      row.height = 20;
    });

    [6, 32, 20, 18, 14, 14, 16, 16, 16].forEach((w, idx) => {
      sheet2.getColumn(idx + 1).width = w;
    });

    // SHEET 3: INVENTARIS BUKU ICV
    const sheet3 = workbook.addWorksheet('Inventaris Buku ICV', {
      views: [{ showGridLines: true }],
    });

    sheet3.mergeCells('A1:H1');
    const s3Title = sheet3.getCell('A1');
    s3Title.value = 'LAPORAN STOK & PENGGUNAAN BUKU KUNING (ICV)';
    s3Title.font = { name: 'Arial', size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
    s3Title.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F766E' } };
    s3Title.alignment = { horizontal: 'center', vertical: 'middle' };
    sheet3.getRow(1).height = 26;

    const s3Headers = ['No', 'Kode Batch Penerimaan', 'No Seri Awal', 'No Seri Akhir', 'Total Buku', 'Terpakai', 'Sisa Stok', 'Tgl Penerimaan'];
    sheet3.getRow(3).values = s3Headers;
    s3Headers.forEach((_, idx) => {
      const cell = sheet3.getRow(3).getCell(idx + 1);
      cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF334155' } };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
    });

    icvBatches.forEach((b, idx) => {
      const row = sheet3.getRow(4 + idx);
      row.values = [
        idx + 1,
        b.batchCode,
        b.startSerial,
        b.endSerial,
        b.totalStock,
        b.usedStock,
        b.remainingStock,
        b.receivedDate,
      ];
      row.height = 20;
    });

    [6, 24, 20, 20, 14, 14, 14, 18].forEach((w, idx) => {
      sheet3.getColumn(idx + 1).width = w;
    });

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  // 2. GENERATE PDF KARTU BUKTI VAKSINASI PASIEN (SINGLE PATIENT)
  async generatePatientPdf(id: number): Promise<Buffer> {
    const p = this.db.get<PatientRecord>(
      'SELECT * FROM vaccination_records WHERE id = ?',
      [id]
    );

    if (!p) {
      throw new NotFoundException(`Data pasien dengan ID ${id} tidak ditemukan.`);
    }

    const { promise, resolve, reject } = Promise.withResolvers<Buffer>();

    const doc = new PDFDocument({
      size: 'A4',
      margin: 40,
      info: {
        Title: `Kartu Vaksinasi - ${p.fullName} - ${p.nik}`,
        Author: 'VaksinKU Hospital System',
      },
    });

    const buffers: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => buffers.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(buffers)));
    doc.on('error', (err: Error) => reject(err));

    // KOP SURAT RUMAH SAKIT
    doc.rect(40, 40, 515, 60).fill('#0f766e');
    doc.fillColor('#ffffff').fontSize(15).font('Helvetica-Bold')
      .text('KLINIK UTAMA DR. H. A. ROTINSULU CIANJUR', 40, 50, { align: 'center', width: 515 });
    doc.fontSize(9.5).font('Helvetica')
      .text('UNIT PELAYANAN VAKSINASI UMRAH, HAJI & PERJALANAN INTERNASIONAL', 40, 68, { align: 'center', width: 515 });
    doc.fontSize(8).font('Helvetica')
      .text('Cianjur, Jawa Barat | Layanan Vaksinasi & Sertifikasi ICV Buku Kuning Resmi', 40, 82, { align: 'center', width: 515 });

    doc.moveDown(3);

    // JUDUL SURAT
    doc.fillColor('#0f172a').fontSize(13).font('Helvetica-Bold')
      .text('SURAT KETERANGAN & BUKTI PELAYANAN VAKSINASI', { align: 'center' });
    doc.fontSize(9).font('Helvetica-Bold').fillColor('#64748b')
      .text('CERTIFICATE OF VACCINATION & PROPHYLAXIS', { align: 'center' });

    doc.moveDown(1.5);

    // KOTAK STATUS RESMI
    const isApproved = p.doctorApproval === 'Disetujui';
    const isCompleted = p.status === 'Selesai';
    const statusColor = isCompleted ? '#059669' : (isApproved ? '#0284c7' : '#dc2626');
    const statusText = isCompleted ? 'STATUS: SELESAI DIVAKSINASI' : (isApproved ? 'STATUS: DISETUJUI DOKTER (MENUNGGU TINDAKAN)' : `STATUS: ${p.doctorApproval.toUpperCase()}`);

    doc.rect(40, doc.y, 515, 24).fill(statusColor);
    doc.fillColor('#ffffff').fontSize(10).font('Helvetica-Bold')
      .text(statusText, 45, doc.y + 7, { align: 'center', width: 505 });

    doc.moveDown(2);

    // SECTION 1: IDENTITAS PASIEN
    doc.fillColor('#0f766e').fontSize(11).font('Helvetica-Bold').text('I. IDENTITAS PASIEN / PATIENT IDENTITY');
    doc.strokeColor('#cbd5e1').lineWidth(1).moveTo(40, doc.y + 2).lineTo(555, doc.y + 2).stroke();
    doc.moveDown(0.8);

    const startY = doc.y;
    const leftColX = 50;
    const rightColX = 300;
    const lineH = 18;

    doc.fontSize(9).font('Helvetica').fillColor('#334155');

    const leftFields = [
      ['Nomor Induk Kependudukan (NIK)', `: ${p.nik}`],
      ['Nama Lengkap Pasien', `: ${p.fullName}`],
      ['Jenis Kelamin', `: ${p.gender}`],
      ['Tempat, Tanggal Lahir', `: ${p.birthPlace}, ${p.birthDate}`],
      ['Status Pernikahan', `: ${p.maritalStatus || '-'}`],
    ];

    const rightFields = [
      ['Nomor WhatsApp / HP', `: ${p.phoneWa}`],
      ['Email Aktif', `: ${p.email || '-'}`],
      ['Pekerjaan', `: ${p.occupation || '-'}`],
      ['Alamat Lengkap', `: ${p.address}`],
    ];

    leftFields.forEach((item, i) => {
      doc.font('Helvetica-Bold').text(item[0], leftColX, startY + (i * lineH), { width: 140 });
      doc.font('Helvetica').text(item[1], leftColX + 140, startY + (i * lineH), { width: 120 });
    });

    rightFields.forEach((item, i) => {
      doc.font('Helvetica-Bold').text(item[0], rightColX, startY + (i * lineH), { width: 110 });
      doc.font('Helvetica').text(item[1], rightColX + 110, startY + (i * lineH), { width: 140 });
    });

    doc.y = startY + (5 * lineH) + 15;

    // SECTION 2: DETAIL TINDAKAN VAKSINASI & SCREENING
    doc.fillColor('#0f766e').fontSize(11).font('Helvetica-Bold').text('II. REKAM MEDIS TINDAKAN VAKSINASI & SCREENING');
    doc.strokeColor('#cbd5e1').lineWidth(1).moveTo(40, doc.y + 2).lineTo(555, doc.y + 2).stroke();
    doc.moveDown(0.8);

    const medStartY = doc.y;
    const medFields = [
      ['Jenis Vaksin Diberikan', `: ${p.vaccineType}`],
      ['Nomor Batch / Lot Vaksin', `: ${p.batchNumber || '-'}`],
      ['Nomor Sertifikat ICV (Buku Kuning)', `: ${p.icvNumber || '-'}`],
      ['Hasil Tes Kehamilan (WUS)', `: ${p.pregnancyTestResult}`],
      ['Rencana Tanggal & Jam Kunjungan', `: ${p.plannedDate} pukul ${p.plannedTime}`],
      ['Persetujuan Dokter Pemeriksa', `: ${p.doctorApproval}`],
      ['Catatan Medis / Telaah Dokter', `: ${p.doctorNotes || '-'}`],
      ['Keterangan Tambahan / Sumber Info', `: ${p.notes || '-'} (Sumber: ${p.infoSource || '-'})`],
    ];

    medFields.forEach((item, i) => {
      doc.font('Helvetica-Bold').fillColor('#334155').text(item[0], 50, medStartY + (i * 18), { width: 180 });
      doc.font('Helvetica').fillColor('#0f172a').text(item[1], 230, medStartY + (i * 18), { width: 320 });
    });

    doc.y = medStartY + (medFields.length * 18) + 25;

    // SECTION 3: TANDA TANGAN & PENGESAHAN
    doc.strokeColor('#e2e8f0').lineWidth(0.5).moveTo(40, doc.y).lineTo(555, doc.y).stroke();
    doc.moveDown(1);

    const signY = doc.y + 5;
    const todayFormatted = new Date().toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });

    // Kolom Dokter
    doc.fontSize(9).font('Helvetica').fillColor('#475569')
      .text(`Ditetapkan di Klinik Utama Dr. H. A. Rotinsulu Cianjur, ${todayFormatted}`, 320, signY, { align: 'center', width: 200 });
    doc.font('Helvetica-Bold')
      .text('Dokter Penanggung Jawab / Pemeriksa,', 320, signY + 14, { align: 'center', width: 200 });

    doc.rect(370, signY + 35, 100, 35).strokeColor('#cbd5e1').stroke();
    doc.fontSize(8).fillColor('#94a3b8').text('(Tanda Tangan / QR Medis)', 370, signY + 48, { align: 'center', width: 100 });

    doc.fontSize(9).font('Helvetica-Bold').fillColor('#0f172a')
      .text(p.doctorName || 'dr. H. Rahmat Hidayat, Sp.A', 320, signY + 80, { align: 'center', width: 200 });
    doc.fontSize(8).font('Helvetica').fillColor('#64748b')
      .text('SIP. 446.1/1082/Dinkes/2024', 320, signY + 92, { align: 'center', width: 200 });

    // Kolom Perawat Pelaksana
    doc.fontSize(9).font('Helvetica-Bold').fillColor('#475569')
      .text('Perawat Pelaksana Vaksinasi,', 60, signY + 14, { align: 'center', width: 200 });

    doc.rect(110, signY + 35, 100, 35).strokeColor('#cbd5e1').stroke();
    doc.fontSize(8).fillColor('#94a3b8').text('(Paraf Pelaksana)', 110, signY + 48, { align: 'center', width: 100 });

    doc.fontSize(9).font('Helvetica-Bold').fillColor('#0f172a')
      .text(p.nurseName || 'Ns. Siti Nurhaliza, S.Kep', 60, signY + 80, { align: 'center', width: 200 });
    doc.fontSize(8).font('Helvetica').fillColor('#64748b')
      .text('SIKP. 503/241/Perawat/2025', 60, signY + 92, { align: 'center', width: 200 });

    // FOOTER
    doc.fontSize(7).fillColor('#94a3b8')
      .text('Dokumen ini sah dicetak secara elektronik melalui Sistem Informasi VaksinKU Hospital Network.', 40, 780, { align: 'center', width: 515 });

    doc.end();

    return promise;
  }

  // 3. GENERATE PDF LAPORAN BULANAN RESMI
  async generateMonthlyPdf(month?: string): Promise<Buffer> {
    const selectedMonth = month && month.trim() !== '' ? month.trim() : new Date().toISOString().substring(0, 7);

    const patients = this.db.query<PatientRecord>(
      'SELECT * FROM vaccination_records WHERE monthYear = ? ORDER BY plannedDate ASC, id ASC',
      [selectedMonth]
    );

    const summary = this.db.get<{
      total: number;
      completed: number;
      pending: number;
      male: number;
      female: number;
    }>(
      `SELECT
        COUNT(*) as total,
        COALESCE(SUM(CASE WHEN status = 'Selesai' THEN 1 ELSE 0 END), 0) as completed,
        COALESCE(SUM(CASE WHEN status = 'Belum' THEN 1 ELSE 0 END), 0) as pending,
        COALESCE(SUM(CASE WHEN gender = 'Laki-laki' THEN 1 ELSE 0 END), 0) as male,
        COALESCE(SUM(CASE WHEN gender = 'Perempuan' THEN 1 ELSE 0 END), 0) as female
      FROM vaccination_records WHERE monthYear = ?`,
      [selectedMonth]
    );

    const { promise, resolve, reject } = Promise.withResolvers<Buffer>();

    const doc = new PDFDocument({
      size: 'A4',
      margin: 35,
      layout: 'landscape',
      info: {
        Title: `Laporan Rekapitulasi Vaksinasi Bulanan - ${selectedMonth}`,
        Author: 'VaksinKU Hospital System',
      },
    });

    const buffers: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => buffers.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(buffers)));
    doc.on('error', (err: Error) => reject(err));

    // KOP SURAT LANDSCAPE
    doc.rect(35, 30, 770, 45).fill('#0f766e');
    doc.fillColor('#ffffff').fontSize(14).font('Helvetica-Bold')
      .text('KLINIK UTAMA DR. H. A. ROTINSULU CIANJUR - VAKSINKU', 35, 38, { align: 'center', width: 770 });
    doc.fontSize(9).font('Helvetica')
      .text(`LAPORAN REKAPITULASI PELAYANAN VAKSINASI BULAN: ${selectedMonth} | UNIT VAKSINASI & BUKU KUNING (ICV)`, 35, 54, { align: 'center', width: 770 });

    // STATS RINGKASAN
    doc.moveDown(3);
    const total = summary ? summary.total : 0;
    const completed = summary ? summary.completed : 0;
    const pending = summary ? summary.pending : 0;
    const male = summary ? summary.male : 0;
    const female = summary ? summary.female : 0;

    const statY = 85;
    doc.rect(35, statY, 770, 22).fill('#f1f5f9');
    doc.fontSize(8.5).font('Helvetica-Bold').fillColor('#1e293b');
    doc.text(
      `RINGKASAN: Total Pasien: ${total} Orang | Selesai Vaksin: ${completed} | Belum: ${pending} | Laki-laki: ${male} | Perempuan: ${female} | Dicetak: ${new Date().toLocaleDateString('id-ID')}`,
      45, statY + 6
    );

    // TABEL DATA PASIEN
    const tableTop = 115;
    doc.rect(35, tableTop, 770, 20).fill('#1e293b');
    doc.fillColor('#ffffff').fontSize(7.5).font('Helvetica-Bold');

    const cols = [
      { label: 'No', x: 38, w: 20 },
      { label: 'NIK', x: 60, w: 75 },
      { label: 'Nama Pasien', x: 140, w: 100 },
      { label: 'L/P', x: 245, w: 20 },
      { label: 'No WhatsApp', x: 270, w: 65 },
      { label: 'Jenis Vaksin', x: 340, w: 105 },
      { label: 'Tgl Kunjungan', x: 450, w: 55 },
      { label: 'Persetujuan dr', x: 510, w: 65 },
      { label: 'Status', x: 580, w: 40 },
      { label: 'Hasil WUS', x: 625, w: 50 },
      { label: 'No Buku ICV', x: 680, w: 60 },
      { label: 'Dokter', x: 745, w: 55 },
    ];

    cols.forEach((c) => {
      doc.text(c.label, c.x, tableTop + 6);
    });

    let currentY = tableTop + 20;

    patients.slice(0, 25).forEach((p, idx) => {
      if (currentY > 520) return;
      const isZebra = idx % 2 === 1;
      if (isZebra) {
        doc.rect(35, currentY, 770, 16).fill('#f8fafc');
      }

      doc.fillColor('#0f172a').fontSize(7).font('Helvetica');
      doc.text(`${idx + 1}`, cols[0].x, currentY + 4);
      doc.text(p.nik, cols[1].x, currentY + 4);
      doc.text(p.fullName.substring(0, 20), cols[2].x, currentY + 4);
      doc.text(p.gender === 'Laki-laki' ? 'L' : 'P', cols[3].x, currentY + 4);
      doc.text(p.phoneWa, cols[4].x, currentY + 4);
      doc.text(p.vaccineType.substring(0, 22), cols[5].x, currentY + 4);
      doc.text(p.plannedDate, cols[6].x, currentY + 4);
      doc.text(p.doctorApproval, cols[7].x, currentY + 4);
      doc.text(p.status, cols[8].x, currentY + 4);
      doc.text(p.pregnancyTestResult, cols[9].x, currentY + 4);
      doc.text(p.icvNumber || '-', cols[10].x, currentY + 4);
      doc.text((p.doctorName || '-').substring(0, 12), cols[11].x, currentY + 4);

      doc.strokeColor('#e2e8f0').lineWidth(0.5).moveTo(35, currentY + 16).lineTo(805, currentY + 16).stroke();
      currentY += 16;
    });

    const footerY = Math.max(currentY + 20, 480);
    doc.fontSize(8).font('Helvetica').fillColor('#334155');
    doc.text(`Mengetahui, Kepala Pelayanan Vaksinasi`, 600, footerY, { width: 180, align: 'center' });
    doc.font('Helvetica-Bold').fillColor('#0f172a')
      .text('dr. H. Rahmat Hidayat, Sp.A', 600, footerY + 40, { width: 180, align: 'center' });
    doc.fontSize(7).font('Helvetica').fillColor('#64748b')
      .text('NIP. 19780512 200501 1 004', 600, footerY + 50, { width: 180, align: 'center' });

    doc.end();

    return promise;
  }
}
