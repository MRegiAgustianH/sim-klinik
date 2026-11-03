import { Injectable, NotFoundException } from '@nestjs/common';
import * as path from 'path';
import * as fs from 'fs';
import PDFDocument from 'pdfkit';
import { DatabaseService, SqliteParam } from '../database/database.service';
import { CreateMcuDto, UpdateMcuDto } from './mcu.dto';

export interface McuReportItem {
  id: number;
  reportNumber: string | null;
  patientName: string;
  nik: string | null;
  ageGender: string;
  birthDate: string | null;
  address: string | null;
  examDate: string;
  purpose: string;
  vitalSigns: string | null;
  anthropometry: string | null;
  physicalExam: string | null;
  labExam: string | null;
  supportingExam: string | null;
  conclusionType: 'Sehat' | 'Sehat dengan catatan' | 'Temporary Unfit' | 'Unfit';
  conclusionNotes: string | null;
  recommendations: string | null;
  doctorName: string;
  doctorSip: string | null;
  createdAt: string;
  updatedAt: string;
}

@Injectable()
export class McuService {
  private headerImagePath: string;

  constructor(private readonly db: DatabaseService) {
    const possiblePaths = [
      path.join(process.cwd(), 'header-hasil.jpeg'),
      path.join(process.cwd(), 'server', 'header-hasil.jpeg'),
      path.join(__dirname, '..', '..', 'header-hasil.jpeg'),
      path.join(__dirname, '..', '..', '..', 'header-hasil.jpeg'),
    ];

    this.headerImagePath = possiblePaths[0];
    for (const p of possiblePaths) {
      if (fs.existsSync(p)) {
        this.headerImagePath = p;
        break;
      }
    }
  }

  getAll(search?: string, limit = 50, offset = 0) {
    const conditions: string[] = ['1=1'];
    const params: SqliteParam[] = [];

    if (search && search.trim() !== '') {
      const q = `%${search.trim()}%`;
      conditions.push('(patientName LIKE ? OR nik LIKE ? OR reportNumber LIKE ?)');
      params.push(q, q, q);
    }

    const whereClause = conditions.join(' AND ');
    const countRes = this.db.get<{ total: number }>(
      `SELECT COUNT(*) as total FROM mcu_reports WHERE ${whereClause}`,
      params
    );
    const total = countRes ? countRes.total : 0;

    const queryParams: SqliteParam[] = [...params, limit, offset];
    const data = this.db.query<McuReportItem>(
      `SELECT * FROM mcu_reports WHERE ${whereClause} ORDER BY id DESC LIMIT ? OFFSET ?`,
      queryParams
    );

    return { total, data };
  }

  getById(id: number): McuReportItem {
    const item = this.db.get<McuReportItem>('SELECT * FROM mcu_reports WHERE id = ?', [id]);
    if (!item) {
      throw new NotFoundException(`Laporan MCU dengan ID ${id} tidak ditemukan.`);
    }
    return item;
  }

  create(dto: CreateMcuDto): McuReportItem {
    const now = new Date();
    const reportNumber = `MCU-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}-${String(Date.now()).slice(-4)}`;

    const vitalStr = typeof dto.vitalSigns === 'object' ? JSON.stringify(dto.vitalSigns) : dto.vitalSigns || null;
    const antropoStr = typeof dto.anthropometry === 'object' ? JSON.stringify(dto.anthropometry) : dto.anthropometry || null;
    const physicalStr = typeof dto.physicalExam === 'object' ? JSON.stringify(dto.physicalExam) : dto.physicalExam || null;
    const labStr = typeof dto.labExam === 'object' ? JSON.stringify(dto.labExam) : dto.labExam || null;
    const supportingStr = typeof dto.supportingExam === 'object' ? JSON.stringify(dto.supportingExam) : dto.supportingExam || null;
    const recsStr = Array.isArray(dto.recommendations) ? JSON.stringify(dto.recommendations) : dto.recommendations || null;

    const res = this.db.run(
      `INSERT INTO mcu_reports (
        reportNumber, patientName, nik, ageGender, birthDate, address,
        examDate, purpose, vitalSigns, anthropometry, physicalExam, labExam,
        supportingExam, conclusionType, conclusionNotes, recommendations,
        doctorName, doctorSip
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        reportNumber,
        dto.patientName.trim(),
        dto.nik ? dto.nik.trim() : null,
        dto.ageGender.trim(),
        dto.birthDate ? dto.birthDate.trim() : null,
        dto.address ? dto.address.trim() : null,
        dto.examDate.trim(),
        dto.purpose ? dto.purpose.trim() : 'MCU kerja',
        vitalStr,
        antropoStr,
        physicalStr,
        labStr,
        supportingStr,
        dto.conclusionType,
        dto.conclusionNotes ? dto.conclusionNotes.trim() : null,
        recsStr,
        dto.doctorName.trim(),
        dto.doctorSip ? dto.doctorSip.trim() : null,
      ]
    );

    return this.getById(Number(res.lastInsertRowid));
  }

  update(id: number, dto: UpdateMcuDto): McuReportItem {
    this.getById(id);

    const vitalStr = typeof dto.vitalSigns === 'object' ? JSON.stringify(dto.vitalSigns) : dto.vitalSigns || null;
    const antropoStr = typeof dto.anthropometry === 'object' ? JSON.stringify(dto.anthropometry) : dto.anthropometry || null;
    const physicalStr = typeof dto.physicalExam === 'object' ? JSON.stringify(dto.physicalExam) : dto.physicalExam || null;
    const labStr = typeof dto.labExam === 'object' ? JSON.stringify(dto.labExam) : dto.labExam || null;
    const supportingStr = typeof dto.supportingExam === 'object' ? JSON.stringify(dto.supportingExam) : dto.supportingExam || null;
    const recsStr = Array.isArray(dto.recommendations) ? JSON.stringify(dto.recommendations) : dto.recommendations || null;

    this.db.run(
      `UPDATE mcu_reports SET
        patientName = ?, nik = ?, ageGender = ?, birthDate = ?, address = ?,
        examDate = ?, purpose = ?, vitalSigns = ?, anthropometry = ?, physicalExam = ?,
        labExam = ?, supportingExam = ?, conclusionType = ?, conclusionNotes = ?,
        recommendations = ?, doctorName = ?, doctorSip = ?, updatedAt = CURRENT_TIMESTAMP
      WHERE id = ?`,
      [
        dto.patientName.trim(),
        dto.nik ? dto.nik.trim() : null,
        dto.ageGender.trim(),
        dto.birthDate ? dto.birthDate.trim() : null,
        dto.address ? dto.address.trim() : null,
        dto.examDate.trim(),
        dto.purpose ? dto.purpose.trim() : 'MCU kerja',
        vitalStr,
        antropoStr,
        physicalStr,
        labStr,
        supportingStr,
        dto.conclusionType,
        dto.conclusionNotes ? dto.conclusionNotes.trim() : null,
        recsStr,
        dto.doctorName.trim(),
        dto.doctorSip ? dto.doctorSip.trim() : null,
        id,
      ]
    );

    return this.getById(id);
  }

  delete(id: number): { message: string } {
    const item = this.getById(id);
    this.db.run('DELETE FROM mcu_reports WHERE id = ?', [id]);
    return { message: `Laporan MCU pasien ${item.patientName} berhasil dihapus.` };
  }

  // GENERATE PDF LAPORAN MCU:
  // - Margin kanan kiri 3 cm (85 pt)
  // - Font Arial ukuran 11 pt
  // - Footer nomor halaman format Cambria (Page X of 4, Center)
  // - Header proporsional tanpa gepeng
  // - Tabel identitas polos tanpa warna
  // - Poin pemeriksaan lainnya tanpa tabel
  async generateMcuPdf(id: number): Promise<Buffer> {
    const report = this.getById(id);
    const { promise, resolve, reject } = Promise.withResolvers<Buffer>();

    const leftMargin = 85; // 3 cm
    const printableWidth = 425; // 595 - 2*85
    const naturalHeaderHeight = Math.round(printableWidth * (401 / 1295)); // ~132 pt

    const doc = new PDFDocument({
      size: 'A4',
      margins: {
        top: 20,
        bottom: 30,
        left: leftMargin,
        right: leftMargin,
      },
      bufferPages: true,
      autoFirstPage: false,
      info: {
        Title: `Laporan MCU - ${report.patientName} - ${report.reportNumber}`,
        Author: 'Klinik Utama Dr. H. A. Rotinsulu Cianjur',
      },
    });

    // Pendaftaran Font Arial dan Cambria
    let fontArial = 'Helvetica';
    let fontArialBold = 'Helvetica-Bold';
    let fontCambria = 'Times-Roman';

    if (fs.existsSync('C:/Windows/Fonts/arial.ttf')) {
      doc.registerFont('Arial', 'C:/Windows/Fonts/arial.ttf');
      doc.registerFont('Arial-Bold', 'C:/Windows/Fonts/arialbd.ttf');
      fontArial = 'Arial';
      fontArialBold = 'Arial-Bold';
    }

    if (fs.existsSync('C:/Windows/Fonts/cambria.ttc')) {
      try {
        doc.registerFont('Cambria', 'C:/Windows/Fonts/cambria.ttc', 'Cambria');
        fontCambria = 'Cambria';
      } catch {
        fontCambria = 'Times-Roman';
      }
    } else if (fs.existsSync('C:/Windows/Fonts/cambriab.ttf')) {
      doc.registerFont('Cambria', 'C:/Windows/Fonts/cambriab.ttf');
      fontCambria = 'Cambria';
    }

    const buffers: Buffer[] = [];
    doc.on('data', (c: Buffer) => buffers.push(c));
    doc.on('end', () => resolve(Buffer.concat(buffers)));
    doc.on('error', (err: Error) => reject(err));

    const parseJson = (str: string | null): Record<string, string> => {
      if (!str) return {};
      try {
        return JSON.parse(str);
      } catch {
        return {};
      }
    };

    const vital = parseJson(report.vitalSigns);
    const antropo = parseJson(report.anthropometry);
    const physical = parseJson(report.physicalExam);
    const lab = parseJson(report.labExam);
    const supporting = parseJson(report.supportingExam);

    let recs: string[] = [];
    if (report.recommendations) {
      try {
        recs = JSON.parse(report.recommendations);
      } catch {
        recs = report.recommendations.split('\n').filter((s) => s.trim() !== '');
      }
    }

    // Header gambar proporsional tanpa gepeng
    const drawHeader = () => {
      if (fs.existsSync(this.headerImagePath)) {
        doc.image(this.headerImagePath, leftMargin, 20, { width: printableWidth });
      }
      doc.y = 20 + naturalHeaderHeight + 10;
    };

    // Judul dua baris warna biru agak tua center
    const drawTitle = (line1: string, line2: string) => {
      doc.fontSize(12).font(fontArialBold).fillColor('#1e3a8a')
        .text(line1, leftMargin, doc.y, { align: 'center', width: printableWidth });
      doc.text(line2, leftMargin, doc.y, { align: 'center', width: printableWidth });
      doc.moveDown(0.5);
    };

    // TABEL HANYA UNTUK IDENTITAS PASIEN (POLOS, JUDUL DI LUAR, TINGGI MENYESUAIKAN TEKS)
    const drawIdTable = (title = 'IDENTITAS PASIEN') => {
      doc.fontSize(11).font(fontArialBold).fillColor('#000000').text(title, leftMargin, doc.y);
      doc.y += 4;

      const labelWidth = 145;
      const valueWidth = printableWidth - labelWidth - 10;

      const idRows = [
        ['Nama', `: ${report.patientName}`],
        ['Umur / Jenis Kelamin', `: ${report.ageGender}`],
        ['Tanggal Lahir', `: ${report.birthDate || '-'}`],
        ['Alamat', `: ${report.address || '-'}`],
        ['Tanggal Pemeriksaan', `: ${report.examDate}`],
        ['Keperluan', `: ${report.purpose || 'MCU kerja'}`],
      ];

      doc.fontSize(11).font(fontArial);

      idRows.forEach(([lbl, val]) => {
        const textH = doc.heightOfString(val, { width: valueWidth });
        const rowH = Math.max(18, textH + 6);
        const rowY = doc.y;

        doc.rect(leftMargin, rowY, printableWidth, rowH).strokeColor('#000000').lineWidth(0.5).stroke();
        doc.font(fontArialBold).fillColor('#000000').text(lbl, leftMargin + 6, rowY + 3.5, { width: labelWidth });
        doc.font(fontArial).fillColor('#000000').text(val, leftMargin + labelWidth + 6, rowY + 3.5, { width: valueWidth });

        doc.y = rowY + rowH;
      });
      doc.y += 8;
    };

    const drawSectionTitle = (title: string) => {
      doc.fontSize(11.5).font(fontArialBold).fillColor('#1e3a8a').text(title, leftMargin, doc.y);
      doc.y += 3;
    };

    // POINT-POINT PEMERIKSAAN LAINNYA TIDAK DIBERI TABEL (UKURAN 11 FONT ARIAL)
    const drawPointRow = (label: string, val: string, indent = leftMargin + 8) => {
      const y = doc.y;
      doc.fontSize(11).font(fontArial).fillColor('#334155').text(label, indent, y, { width: 155 });
      doc.fillColor('#000000').text(`: ${val}`, indent + 160, y, { width: printableWidth - 168 });
      doc.y = Math.max(doc.y, y + 16);
    };

    // ==========================================
    // HALAMAN 1: RESUME HASIL PEMERIKSAAN MCU
    // ==========================================
    doc.addPage();
    drawHeader();
    drawTitle('RESUME HASIL PEMERIKSAAN', 'MEDICAL CHECK UP (MCU KERJA)');
    drawIdTable('IDENTITAS PASIEN');

    drawSectionTitle('A. TANDA VITAL');
    drawPointRow('Tekanan Darah', vital.bloodPressure || 'Normal');
    drawPointRow('Nadi', vital.pulse || 'Normal');
    drawPointRow('Pernafasan', vital.respiration || 'Normal');
    drawPointRow('Suhu', vital.temperature || 'Normal');
    drawPointRow('Kesadaran', vital.consciousness || 'Compos Mentis');
    doc.y += 6;

    drawSectionTitle('B. ANTROPOMETRI');
    drawPointRow('Berat Badan (BB)', antropo.weight ? `${antropo.weight} kg` : '-');
    drawPointRow('Tinggi Badan (TB)', antropo.height ? `${antropo.height} cm` : '-');
    drawPointRow('IMT / BMI', antropo.bmi || '-');
    drawPointRow('Status Gizi', antropo.nutritionStatus || '-');
    doc.y += 6;

    drawSectionTitle('C. Pemeriksaan Fisik');
    drawPointRow('Kepala', physical.head || 'Normal');
    drawPointRow('Gigi', physical.teeth || 'Normal');
    drawPointRow('Telinga, Hidung, Tenggorokan', physical.ent || 'Normal');
    drawPointRow('Leher', physical.neck || 'Normal');
    drawPointRow('Jantung', physical.heart || 'Normal');
    drawPointRow('Paru paru', physical.lungs || 'Normal');
    drawPointRow('Abdomen', physical.abdomen || 'Normal');
    drawPointRow('Ekstremelitas Atas dan Bawah', physical.extremities || 'Normal');

    // ==========================================
    // HALAMAN 2: PEMERIKSAAN LAB & PENUNJANG
    // ==========================================
    doc.addPage();
    drawHeader();

    drawSectionTitle('D. Pemeriksaan Laboratorium');
    drawPointRow('Darah Lengkap', lab.completeBlood || 'Dalam batas normal');
    drawPointRow('Urine Lengkap', lab.completeUrine || 'Dalam batas normal');
    drawPointRow('GDP, Kolestrol Total, LDL, Kreatinin, Ureum, Asam Urat', lab.bloodChemistry || 'Dalam batas normal');
    drawPointRow('TG, HDL, SGOT, SGPT', lab.additionalLab || 'Dalam batas normal');
    drawPointRow('HBsAg', lab.hbsag || 'Negatif');
    drawPointRow('Tes NAFZA (6 Parameter)', lab.drugTest || 'Negatif');
    doc.y += 10;

    drawSectionTitle('E. Pemeriksaan Rontgen Thorax');
    drawPointRow('Gambaran Rontgen', supporting.thoraxXray || 'Cor dan Pulmo dalam batas normal, tidak tampak kelainan aktif.');
    doc.y += 10;

    drawSectionTitle('F. Pemeriksaan EKG');
    drawPointRow('Hasil EKG', supporting.ekg || 'Hasil terlampir');
    doc.y += 6;

    drawSectionTitle('G. Pemeriksaan Threadmill');
    drawPointRow('Hasil Threadmill', supporting.treadmill || 'Normal');
    doc.y += 6;

    drawSectionTitle('H. Pemeriksaan Audiometri');
    drawPointRow('Hasil Audiometri', supporting.audiometry || 'Dalam batas normal');
    doc.y += 6;

    drawSectionTitle('I. Pemeriksaan Spirometri');
    drawPointRow('Hasil Spirometri', supporting.spirometry || 'Normal');

    // ==========================================
    // HALAMAN 3: HASIL PEMERIKSAAN FISIK
    // ==========================================
    doc.addPage();
    drawHeader();
    drawTitle('HASIL PEMERIKSAAN FISIK', 'MEDICAL CHECK UP (MCU KERJA)');
    drawIdTable('IDENTITAS');

    drawSectionTitle('Pemeriksaan Tanda Vital');
    drawPointRow('Tekanan Darah', vital.bloodPressure || '120/80 mmHg');
    drawPointRow('Nadi', vital.pulse || '80 x/menit');
    drawPointRow('Pernafasan', vital.respiration || '18 x/menit');
    drawPointRow('Suhu', vital.temperature || '36.5 °C');
    drawPointRow('Berat Badan (BB)', antropo.weight ? `${antropo.weight} Kg` : '-');
    drawPointRow('Tinggi Badan (TB)', antropo.height ? `${antropo.height} cm` : '-');
    drawPointRow('IMT / BMI', antropo.bmi || '-');
    doc.y += 6;

    drawSectionTitle('Pemeriksaan Fisik Umum');
    drawPointRow('Keadaan Umum', physical.generalCondition || 'Baik');
    drawPointRow('Kesadaran', vital.consciousness || 'Compos mentis');
    doc.y += 6;

    drawSectionTitle('Pemeriksaan Kepala dan Leher');
    drawPointRow('Mata & Visus', physical.eyes || 'Visus OD 20/20, OS 20/20');
    drawPointRow('Buta Warna', physical.colorVision || 'Tidak Buta warna');
    drawPointRow('Telinga', physical.ent || 'Tidak ada sekret');
    drawPointRow('Hidung', physical.head || 'Tidak ada sekret');
    drawPointRow('Leher', physical.neck || 'Tidak ada pembesaran kelenjar');
    doc.y += 6;

    drawSectionTitle('Pemeriksaan Thorax');
    drawPointRow('Paru - paru', physical.lungs || 'Suara nafas vesikuler, tidak ada ronkhi/wheezing');
    drawPointRow('Jantung', physical.heart || 'Bunyi jantung reguler, tidak ada murmur');

    // ==========================================
    // HALAMAN 4: ABDOMEN, EKSTREMITAS, KESIMPULAN & SARAN
    // ==========================================
    doc.addPage();
    drawHeader();

    drawSectionTitle('Pemeriksaan Abdomen');
    drawPointRow('Inspeksi dan Palpasi', physical.abdomen || 'Lunak, tidak ada nyeri tekan');
    drawPointRow('Hepar dan Lien', 'Tidak teraba');
    doc.y += 8;

    drawSectionTitle('Pemeriksaan Extremitas');
    drawPointRow('Atas dan Bawah', physical.extremities || 'Tidak ada edema, kekuatan otot baik');
    doc.y += 12;

    drawSectionTitle('Kesimpulan');
    doc.y += 2;

    const drawCheckbox = (label: string, isChecked: boolean, textVal: string) => {
      const boxY = doc.y;
      doc.rect(leftMargin + 6, boxY + 2, 9, 9).strokeColor('#000000').lineWidth(1).stroke();
      if (isChecked) {
        doc.rect(leftMargin + 8, boxY + 4, 5, 5).fill('#000000');
      }
      doc.fontSize(11).font(isChecked ? fontArialBold : fontArial).fillColor('#000000')
        .text(label, leftMargin + 22, boxY);
      if (textVal) {
        doc.font(fontArial).fillColor('#000000').text(`: ${textVal}`, leftMargin + 145, boxY, { width: printableWidth - 155 });
      }
      doc.y = Math.max(doc.y, boxY + 16);
    };

    drawCheckbox('Sehat', report.conclusionType === 'Sehat', '');
    drawCheckbox(
      'Sehat dengan catatan',
      report.conclusionType === 'Sehat dengan catatan',
      report.conclusionNotes || ''
    );
    drawCheckbox(
      'Temporary unfit',
      report.conclusionType === 'Temporary Unfit',
      report.conclusionType === 'Temporary Unfit' ? report.conclusionNotes || '' : '_____________'
    );
    drawCheckbox(
      'Unfit',
      report.conclusionType === 'Unfit',
      report.conclusionType === 'Unfit' ? report.conclusionNotes || '' : '_____________'
    );

    doc.y += 8;

    drawSectionTitle('SARAN - SARAN');
    doc.y += 3;

    if (recs.length > 0) {
      recs.forEach((s) => {
        const y = doc.y;
        doc.fontSize(11).font(fontArial).fillColor('#000000').text(`• ${s}`, leftMargin + 8, y, { width: printableWidth - 12 });
        doc.y = Math.max(doc.y, y + 16);
      });
    } else {
      doc.fontSize(11).font(fontArial).fillColor('#000000').text('• Pertahankan pola hidup sehat dan olahraga teratur.', leftMargin + 8, doc.y);
      doc.y += 16;
    }

    doc.y += 10;
    // TANDA TANGAN DOKTER
    const signY = doc.y + 6;
    doc.fontSize(11).font(fontArial).fillColor('#000000').text('Dokter Pemeriksa,', leftMargin + printableWidth - 180, signY, { align: 'center', width: 180 });
    doc.fontSize(11).font(fontArialBold).fillColor('#000000').text(report.doctorName || 'dr. Arinda Puteri P', leftMargin + printableWidth - 180, signY + 60, { align: 'center', width: 180, underline: true });
    doc.fontSize(10).font(fontArial).fillColor('#000000').text(report.doctorSip || 'SIP.MR32032507002898', leftMargin + printableWidth - 180, signY + 75, { align: 'center', width: 180 });

    // FOOTER PAGE NUMBER CENTER DALAM FONT CAMBRIA
    const range = doc.bufferedPageRange();
    for (let i = range.start; i < range.start + range.count; i++) {
      doc.switchToPage(i);
      doc.fontSize(11).font(fontCambria).fillColor('#000000')
        .text(`Page ${i + 1} of ${range.count}`, leftMargin, 792, { align: 'center', width: printableWidth, lineBreak: false });
    }

    doc.end();

    return promise;
  }
}
