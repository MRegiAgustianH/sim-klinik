import { Injectable, NotFoundException } from '@nestjs/common';
import * as path from 'path';
import * as fs from 'fs';
import PDFDocument from 'pdfkit';
import { DatabaseService, SqliteParam } from '../database/database.service';
import { CreateMcuDto, UpdateMcuDto } from './mcu.dto';
import { McuSectionCode, formatMcuSectionTitle, mcuSectionCode } from './mcu-template';

export interface McuExamItem {
  id: string;
  name: string;
  value: string;
  pageBreakBefore?: boolean;
}

export interface McuExamSection {
  id: string;
  code: McuSectionCode;
  title: string;
  items: McuExamItem[];
  pageBreakBefore?: boolean;
}

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
  examinationSections: string | null;
  conclusionType:
    | 'Fit'
    | 'Fit dengan catatan'
    | 'Temporary unfit'
    | 'Unfit'
    | 'Sehat'
    | 'Sehat dengan catatan'
    | 'Temporary Unfit';
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

    const mappedData = data.map((item) => {
      if (!item.examinationSections) {
        item.examinationSections = JSON.stringify(this.ensureSections(item));
      }
      return item;
    });

    return { total, data: mappedData };
  }

  ensureSections(report: McuReportItem): McuExamSection[] {
    if (report.examinationSections) {
      try {
        const parsed = JSON.parse(report.examinationSections);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return this.normalizeSections(parsed);
        }
      } catch {
        // Fallback ke legacy
      }
    }

    let vital: Record<string, string> = {};
    let antropo: Record<string, string> = {};
    let physical: Record<string, string> = {};
    let lab: Record<string, string> = {};
    let supporting: Record<string, string> = {};

    try { if (report.vitalSigns) vital = JSON.parse(report.vitalSigns); } catch {}
    try { if (report.anthropometry) antropo = JSON.parse(report.anthropometry); } catch {}
    try { if (report.physicalExam) physical = JSON.parse(report.physicalExam); } catch {}
    try { if (report.labExam) lab = JSON.parse(report.labExam); } catch {}
    try { if (report.supportingExam) supporting = JSON.parse(report.supportingExam); } catch {}

    const sections: McuExamSection[] = [];

    // 1. Tanda Vital
    const sectionTitle = (code: McuSectionCode) => formatMcuSectionTitle(code, sections.length);
    const vitalItems: McuExamItem[] = [];
    if (vital.bloodPressure) vitalItems.push({ id: 'vital_bp', name: 'Tekanan Darah', value: vital.bloodPressure });
    if (vital.pulse) vitalItems.push({ id: 'vital_pulse', name: 'Nadi', value: vital.pulse });
    if (vital.respiration) vitalItems.push({ id: 'vital_resp', name: 'Pernafasan', value: vital.respiration });
    if (vital.temperature) vitalItems.push({ id: 'vital_temp', name: 'Suhu', value: vital.temperature });
    if (vital.consciousness) vitalItems.push({ id: 'vital_cons', name: 'Kesadaran', value: vital.consciousness });
    if (vitalItems.length > 0) {
      sections.push({ id: 'sec_vital', code: 'vital', title: sectionTitle('vital'), items: vitalItems });
    }

    // 2. Antropometri
    const antropoItems: McuExamItem[] = [];
    if (antropo.weight) antropoItems.push({ id: 'antropo_weight', name: 'Berat Badan (BB)', value: antropo.weight.includes('kg') ? antropo.weight : `${antropo.weight} kg` });
    if (antropo.height) antropoItems.push({ id: 'antropo_height', name: 'Tinggi Badan (TB)', value: antropo.height.includes('cm') ? antropo.height : `${antropo.height} cm` });
    if (antropo.bmi) antropoItems.push({ id: 'antropo_bmi', name: 'IMT / BMI', value: antropo.bmi });
    if (antropo.nutritionStatus) antropoItems.push({ id: 'antropo_nutrition', name: 'Status Gizi', value: antropo.nutritionStatus });
    if (antropoItems.length > 0) {
      sections.push({ id: 'sec_antropo', code: 'antropo', title: sectionTitle('antropo'), items: antropoItems });
    }

    // 3. Fisik
    const physicalItems: McuExamItem[] = [];
    if (physical.generalCondition) physicalItems.push({ id: 'phy_gen', name: 'Keadaan Umum', value: physical.generalCondition });
    if (physical.head) physicalItems.push({ id: 'phy_head', name: 'Kepala', value: physical.head });
    if (physical.eyes) physicalItems.push({ id: 'phy_eyes', name: 'Mata & Visus', value: physical.eyes });
    if (physical.colorVision) physicalItems.push({ id: 'phy_color', name: 'Buta Warna', value: physical.colorVision });
    if (physical.teeth) physicalItems.push({ id: 'phy_teeth', name: 'Gigi & Mulut', value: physical.teeth });
    if (physical.ent) physicalItems.push({ id: 'phy_ent', name: 'Telinga, Hidung, Tenggorokan', value: physical.ent });
    if (physical.neck) physicalItems.push({ id: 'phy_neck', name: 'Leher', value: physical.neck });
    if (physical.heart) physicalItems.push({ id: 'phy_heart', name: 'Jantung', value: physical.heart });
    if (physical.lungs) physicalItems.push({ id: 'phy_lungs', name: 'Paru paru', value: physical.lungs });
    if (physical.abdomen) physicalItems.push({ id: 'phy_abdomen', name: 'Abdomen', value: physical.abdomen });
    if (physical.extremities) physicalItems.push({ id: 'phy_ext', name: 'Ekstremitas Atas dan Bawah', value: physical.extremities });
    if (physicalItems.length > 0) {
      sections.push({ id: 'sec_physical', code: 'physical', title: sectionTitle('physical'), items: physicalItems });
    }

    // 4. Laboratorium: Darah Lengkap, Urine Lengkap, Gula Puasa, Profil Lipid,
    //    Fungsi Hati, Faal Ginjal, HBsAg, Tes NAPZA
    const labItems: McuExamItem[] = [];
    if (lab.completeBlood) labItems.push({ id: 'lab_blood', name: 'Darah Lengkap', value: lab.completeBlood });
    if (lab.completeUrine) labItems.push({ id: 'lab_urine', name: 'Urine Lengkap', value: lab.completeUrine });
    if (lab.fastingGlucose) labItems.push({ id: 'lab_fasting_glucose', name: 'Gula Puasa', value: lab.fastingGlucose });
    if (lab.lipidProfile) labItems.push({ id: 'lab_lipid', name: 'Profil Lipid', value: lab.lipidProfile });
    if (lab.liverFunction) labItems.push({ id: 'lab_liver', name: 'Fungsi Hati', value: lab.liverFunction });
    if (lab.kidneyFunction) labItems.push({ id: 'lab_kidney', name: 'Faal Ginjal', value: lab.kidneyFunction });
    if (lab.hbsag) labItems.push({ id: 'lab_hbsag', name: 'HBsAg', value: lab.hbsag });
    if (lab.drugTest) labItems.push({ id: 'lab_drug_test', name: 'Tes NAPZA', value: lab.drugTest });
    if (labItems.length > 0) {
      sections.push({ id: 'sec_lab', code: 'lab', title: sectionTitle('lab'), items: labItems });
    }

    // 5. Penunjang
    const supItems: McuExamItem[] = [];
    if (supporting.thoraxXray) supItems.push({ id: 'sup_xray', name: 'Rontgen Thorax', value: supporting.thoraxXray });
    if (supporting.ekg) supItems.push({ id: 'sup_ekg', name: 'EKG', value: supporting.ekg });
    if (supporting.treadmill) supItems.push({ id: 'sup_treadmill', name: 'Threadmill', value: supporting.treadmill });
    if (supporting.audiometry) supItems.push({ id: 'sup_audio', name: 'Audiometri', value: supporting.audiometry });
    if (supporting.spirometry) supItems.push({ id: 'sup_spiro', name: 'Spirometri', value: supporting.spirometry });
    if (supItems.length > 0) {
      sections.push({ id: 'sec_sup', code: 'support', title: sectionTitle('support'), items: supItems });
    }

    return sections;
  }

  // Urutan section mengikuti urutan array (bebas dipindah), huruf judul dihitung otomatis
  normalizeSections(raw: unknown): McuExamSection[] {
    if (!Array.isArray(raw)) return [];

    const sections: McuExamSection[] = [];
    for (const entry of raw) {
      if (!entry || typeof entry !== 'object') continue;
      const sec = entry as Record<string, unknown>;
      const itemsRaw = Array.isArray(sec.items) ? sec.items : [];
      const items: McuExamItem[] = itemsRaw
        .filter((it): it is Record<string, unknown> => !!it && typeof it === 'object')
        .map((it, idx) => {
          const item: McuExamItem = {
            id: String(it.id ?? `item_${idx}`),
            name: String(it.name ?? ''),
            value: String(it.value ?? ''),
          };
          // Menerima true dan "true" (data lama/enkode berbeda) tanpa menganggap truthy lain.
          if (it.pageBreakBefore === true || it.pageBreakBefore === 'true') item.pageBreakBefore = true;
          return item;
        });

      const code = mcuSectionCode({ code: sec.code as string, id: sec.id as string });
      const section: McuExamSection = {
        id: String(sec.id ?? `sec_${Date.now()}_${sections.length}`),
        code: code ?? 'physical',
        title: code
          ? formatMcuSectionTitle(code, sections.length)
          : String(sec.title ?? `Pemeriksaan Tambahan ${sections.length + 1}`),
        items,
      };
      // Flag pageBreakBefore ikut disimpan agar PDF berikutnya tetap memecah halaman di titik yang sama
      if (sec.pageBreakBefore === true || sec.pageBreakBefore === 'true') section.pageBreakBefore = true;
      sections.push(section);
    }
    return sections;
  }

  private serializeSections(raw: unknown): string | null {
    if (Array.isArray(raw)) {
      return JSON.stringify(this.normalizeSections(raw));
    }
    if (typeof raw === 'string') {
      try {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? JSON.stringify(this.normalizeSections(parsed)) : null;
      } catch {
        return null;
      }
    }
    return null;
  }

  getById(id: number): McuReportItem {
    const item = this.db.get<McuReportItem>('SELECT * FROM mcu_reports WHERE id = ?', [id]);
    if (!item) {
      throw new NotFoundException(`Laporan MCU dengan ID ${id} tidak ditemukan.`);
    }
    if (!item.examinationSections) {
      item.examinationSections = JSON.stringify(this.ensureSections(item));
    }
    return item;
  }

  create(dto: CreateMcuDto): McuReportItem {
    const now = new Date();
    const reportNumber = `MCU-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}-${String(Date.now()).slice(-4)}`;

    const examSectionsStr = this.serializeSections(dto.examinationSections);

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
        supportingExam, examinationSections, conclusionType, conclusionNotes, recommendations,
        doctorName, doctorSip
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
        examSectionsStr,
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

    const examSectionsStr = this.serializeSections(dto.examinationSections);

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
        labExam = ?, supportingExam = ?, examinationSections = ?, conclusionType = ?, conclusionNotes = ?,
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
        examSectionsStr,
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
    let recs: string[] = [];
    if (report.recommendations) {
      try {
        recs = JSON.parse(report.recommendations);
      } catch {
        recs = report.recommendations.split('\n').filter((s) => s.trim() !== '');
      }
    }

    const drawHeader = () => {
      if (fs.existsSync(this.headerImagePath)) {
        doc.image(this.headerImagePath, leftMargin, 20, { width: printableWidth });
      }
      doc.y = 20 + naturalHeaderHeight + 10;
    };

    // Setiap halaman baru (otomatis maupun paksa) selalu mendapat kop.
    doc.on('pageAdded', () => {
      drawHeader();
    });

    const maxContentY = 745;

    // addPage() otomatis menggambar kop lewat listener 'pageAdded'
    const checkPageBreak = (neededHeight: number) => {
      if (doc.y + neededHeight > maxContentY) {
        doc.addPage();
      }
    };

    // Paksa halaman baru atas permintaan dokter (opsi "halaman baru" pada kategori/poin)
    const pageBreakBeforeSection = () => {
      doc.addPage();
    };

    const drawTitle = (line1: string, line2: string) => {
      doc.fontSize(12).font(fontArialBold).fillColor('#1e3a8a')
        .text(line1, leftMargin, doc.y, { align: 'center', width: printableWidth, lineGap: 0 });
      doc.text(line2, leftMargin, doc.y, { align: 'center', width: printableWidth, lineGap: 0 });
      doc.y += 6;
    };

    const drawIdTable = (title = 'IDENTITAS PASIEN') => {
      doc.fontSize(11).font(fontArialBold).fillColor('#000000').text(title, leftMargin, doc.y);
      doc.y += 4;

      const labelWidth = 145;
      const valueWidth = printableWidth - labelWidth - 10;
      // Baris tabel digambar dengan teks tanpa lineGap agar tinggi tabel persis seperti pratinjau
      const textOptions = { width: valueWidth, lineGap: 0 };
      const labelOptions = { width: labelWidth, lineGap: 0 };

      const idRows = [
        ['Nama', report.patientName, true],
        ['Umur / Jenis Kelamin', report.ageGender, false],
        ['Tanggal Lahir', report.birthDate || '-', false],
        ['Alamat', report.address || '-', false],
        ['Tanggal Pemeriksaan', report.examDate, false],
        ['Keperluan', report.purpose || 'MCU kerja', false],
      ];

      doc.fontSize(11).font(fontArial);

      idRows.forEach(([lbl, val, isBold]) => {
        // Ukur dengan font yang benar-benar dipakai baris ini (Nama dicetak tebal)
        doc.font(isBold ? fontArialBold : fontArial);
        const textH = doc.heightOfString(String(val), textOptions);
        const labelH = doc.heightOfString(String(lbl), labelOptions);
        const rowH = Math.max(16, Math.max(textH, labelH) + 3);
        const rowY = doc.y;

        doc.rect(leftMargin, rowY, printableWidth, rowH).strokeColor('#000000').lineWidth(0.5).stroke();
        doc.font(fontArialBold).fillColor('#000000').text(String(lbl), leftMargin + 6, rowY + 1.5, labelOptions);
        doc.font(isBold ? fontArialBold : fontArial).fillColor('#000000')
          .text(String(val), leftMargin + labelWidth + 6, rowY + 1.5, textOptions);

        doc.y = rowY + rowH;
      });
      doc.y += 2;
    };

    const drawSectionTitle = (title: string) => {
      doc.fontSize(11.5).font(fontArialBold).fillColor('#1e3a8a').text(title, leftMargin, doc.y);
      doc.y += 3;
    };

    // Tinggi satu baris poin dihitung ulang agar pemecahan halaman kategori/poin konsisten.
    const measurePointRow = (label: string, val: string) => {
      const valStr = `: ${val || '-'}`;
      const labelW = 155;
      const valW = printableWidth - labelW - 12;
      doc.fontSize(11).font(fontArial);
      const textH = doc.heightOfString(valStr, { width: valW, lineGap: 0 });
      const labelH = doc.heightOfString(label, { width: labelW, lineGap: 0 });
      return Math.max(16, Math.max(textH, labelH) + 3);
    };

    const drawPointRow = (label: string, val: string, indent = leftMargin + 8) => {
      const valStr = `: ${val || '-'}`;
      const labelW = 155;
      const valW = printableWidth - labelW - 12;
      const textOptions = { width: valW, lineGap: 0 };
      const labelOptions = { width: labelW, lineGap: 0 };
      const rowH = measurePointRow(label, val);

      checkPageBreak(rowH);

      const y = doc.y;
      doc.fontSize(11).font(fontArial).fillColor('#334155').text(label, indent, y, labelOptions);
      doc.fillColor('#000000').text(valStr, indent + labelW + 4, y, textOptions);
      doc.y = y + rowH;
    };

    // HALAMAN 1: IDENTITAS PASIEN (kop sudah digambar oleh listener 'pageAdded')
    doc.addPage();
    drawTitle('RESUME HASIL PEMERIKSAAN', `MEDICAL CHECK UP (${(report.purpose || 'MCU KERJA').toUpperCase()})`);
    drawIdTable('IDENTITAS PASIEN');

    // POINT-POINT PEMERIKSAAN FLEKSIBEL
    // pageBreakBefore pada kategori/poin = dokter memaksa mulai halaman baru
    const sections = this.ensureSections(report);

    // Pelacak apakah halaman saat ini sudah berisi pemeriksaan. Kategori pertama
    // tidak perlu halaman baru (halaman 1 sudah berisi identitas), sama seperti pratinjau.
    let hasExamOnPage = false;
    const addPageForExam = () => {
      doc.addPage();
      hasExamOnPage = false;
    };

    sections.forEach((sec) => {
      const validItems = (sec.items || []).filter(
        (it) => (it.name && it.name.trim() !== '') || (it.value && it.value.trim() !== '')
      );
      if (validItems.length === 0) return;

      if ((sec.pageBreakBefore && hasExamOnPage) || doc.y + 40 > maxContentY) {
        addPageForExam();
      }

      drawSectionTitle(sec.title);
      hasExamOnPage = true;
      let itemsOnThisPage = 0;

      validItems.forEach((it) => {
        // Hanya penanda manual yang memindah poin; selain itu tiap poin butuh ruang setinggi barisnya.
        const rowHeight = measurePointRow(it.name, it.value);
        if (it.pageBreakBefore && itemsOnThisPage > 0) {
          addPageForExam();
          drawSectionTitle(`${sec.title} (Lanjutan)`);
          hasExamOnPage = true;
          itemsOnThisPage = 0;
        } else if (doc.y + rowHeight > maxContentY) {
          addPageForExam();
          drawSectionTitle(`${sec.title} (Lanjutan)`);
          hasExamOnPage = true;
          itemsOnThisPage = 0;
        }
        drawPointRow(it.name, it.value);
        itemsOnThisPage++;
      });

      doc.y += 6;
    });

    // Penanda "dilanjutkan" HANYA bila kesimpulan tidak muat di sisa halaman ini,
    // sama seperti aturan di pratinjau web. Teks dijaga di atas maxContentY agar
    // pdfkit tidak membuat halaman baru diam-diam.
    if (doc.y + 210 > maxContentY && doc.y + 26 >= maxContentY && doc.y + 20 <= maxContentY) {
      doc.fontSize(10).font(fontArial).fillColor('#475569')
        .text('(Dilanjutkan di halaman berikutnya)', leftMargin, doc.y + 4, {
          align: 'right',
          width: printableWidth,
          lineGap: 0,
        });
      doc.y = doc.y + 4 + 10 * 1.15;
      doc.fillColor('#000000');
    }

    // KESIMPULAN, SARAN & TTD DOKTER
    checkPageBreak(210);

    drawSectionTitle('KESIMPULAN');
    doc.y += 2;

    // Laporan lama memakai istilah 'Sehat' / 'Sehat dengan catatan'
    const isFit = report.conclusionType === ('Sehat' as string) || report.conclusionType === 'Fit';
    const isFitWithNotes =
      report.conclusionType === ('Sehat dengan catatan' as string) || report.conclusionType === 'Fit dengan catatan';

    // Kotak digambar lebih dulu agar posisi teks antarpilihan tetap lurus.
    // Path garis selalu digambar sebelum path terisi agar warna fill tidak bocor ke kotak berikutnya.
    const drawCheckbox = (label: string, isChecked: boolean, textVal: string) => {
      const boxY = doc.y;
      doc.rect(leftMargin + 6, boxY + 2, 9, 9).strokeColor('#000000').lineWidth(1).stroke();
      if (isChecked) {
        doc.rect(leftMargin + 6, boxY + 2, 9, 9).fillColor('#000000').fill();
        doc.fillColor('#000000');
      }
      doc.fontSize(11).font(isChecked ? fontArialBold : fontArial).fillColor('#000000')
        .text(label, leftMargin + 22, boxY);
      if (textVal) {
        doc.font(fontArial).fillColor('#000000').text(`: ${textVal}`, leftMargin + 145, boxY, { width: printableWidth - 155 });
      }
      doc.y = Math.max(doc.y, boxY + 16);
    };

    drawCheckbox('Fit', isFit, '');
    drawCheckbox(
      'Fit dengan catatan',
      isFitWithNotes,
      isFitWithNotes ? report.conclusionNotes || '' : ''
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
        const textH = doc.heightOfString(`• ${s}`, { width: printableWidth - 12 });
        const rowH = Math.max(16, textH + 2);
        checkPageBreak(rowH);
        const y = doc.y;
        doc.fontSize(11).font(fontArial).fillColor('#000000').text(`• ${s}`, leftMargin + 8, y, { width: printableWidth - 12 });
        doc.y = y + rowH;
      });
    } else {
      doc.fontSize(11).font(fontArial).fillColor('#000000').text('• Pertahankan pola hidup sehat dan olahraga teratur.', leftMargin + 8, doc.y);
      doc.y += 16;
    }

    doc.y += 10;
    // Butuh ruang sampai y=730 (teks SIP), masih di bawah maxY pdfkit (812).
    checkPageBreak(85);
    const signY = doc.y + 6;
    doc.fontSize(11).font(fontArial).fillColor('#000000').text('Dokter Pemeriksa,', leftMargin + printableWidth - 180, signY, { align: 'center', width: 180 });
    doc.fontSize(11).font(fontArialBold).fillColor('#000000').text(report.doctorName || 'dr. Arinda Puteri P', leftMargin + printableWidth - 180, signY + 50, { align: 'center', width: 180, underline: true });
    doc.fontSize(10).font(fontArial).fillColor('#000000').text(report.doctorSip || 'SIP.MR32032507002898', leftMargin + printableWidth - 180, signY + 65, { align: 'center', width: 180 });
    doc.y = signY + 80;

    // FOOTER PAGE NUMBER CENTER DALAM FONT CAMBRIA: Page X of Y
    const range = doc.bufferedPageRange();
    for (let i = range.start; i < range.start + range.count; i++) {
      doc.switchToPage(i);
      doc.fontSize(11).font(fontCambria).fillColor('#000000')
        .text(`Page ${i + 1} of ${range.count}`, leftMargin, 792, { align: 'center', width: printableWidth, lineBreak: false });
      // Kembalikan posisi tulis agar tidak memicu halaman baru saat PDF ditutup
      doc.y = maxContentY;
    }

    doc.end();

    return promise;
  }
}
