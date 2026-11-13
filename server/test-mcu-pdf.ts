// Tes otomatis MCU: memastikan penanda "halaman baru" tersimpan dan dipakai PDF.
// Jalankan dari folder server:  npx ts-node test-mcu-pdf.ts
// Hanya menyentuh database development (data/vaksinku-dev.sqlite) kecuali MCU_TEST_DB diisi.
import * as fs from 'fs';
import { DatabaseService } from './src/database/database.service';
import { McuService, McuExamSection } from './src/mcu/mcu.service';
import { CreateMcuDto } from './src/mcu/mcu.dto';
  
let failures = 0;

function check(name: string, ok: boolean, detail = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failures++;
}

/** Hitung halaman PDF dari objek /Type /Page (bukan /Type /Pages). */
function countPdfPages(buffer: Buffer): number {
  return (buffer.toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length;
}

const baseSections = (): McuExamSection[] => [
  {
    id: 'sec_vital',
    code: 'vital',
    title: 'A. TANDA VITAL',
    items: [
      { id: 'v1', name: 'Tekanan Darah', value: '120/80 mmHg' },
      { id: 'v2', name: 'Nadi', value: '80 x/menit' },
    ],
  },
  {
    id: 'sec_lab',
    code: 'lab',
    title: 'B. PEMERIKSAAN LABORATORIUM',
    items: [
      { id: 'l1', name: 'Darah Lengkap', value: 'Dalam batas normal' },
      { id: 'l2', name: 'Urine Lengkap', value: 'Dalam batas normal' },
      { id: 'l3', name: 'Gula Puasa', value: 'Dalam batas normal' },
    ],
  },
  {
    id: 'sec_sup',
    code: 'support',
    title: 'C. PEMERIKSAAN PENUNJANG',
    items: [
      { id: 's1', name: 'Rontgen Thorax', value: 'Tidak tampak TBC paru aktif/pneumonia, Tidak tampak kardiomegali' },
      { id: 's2', name: 'EKG', value: 'Normal Sinus Rhythm' },
      { id: 's3', name: 'Spirometri', value: 'Normal' },
    ],
  },
];

function makeReportPayload(sections: McuExamSection[], name: string): CreateMcuDto {
  return {
    patientName: name,
    nik: '',
    ageGender: '30 Tahun / Laki-Laki',
    examDate: '2026-11-13',
    purpose: 'MCU Kerja',
    examinationSections: sections,
    conclusionType: 'Fit',
    conclusionNotes: '',
    recommendations: ['Pertahankan pola hidup sehat.'],
    doctorName: 'dr. Arinda Puteri P',
    doctorSip: 'SIP.MR32032507002898',
  };
}

async function run() {
  if (!fs.existsSync('data/vaksinku-dev.sqlite')) {
    console.error('Database dev tidak ada. Jalankan server dev sekali agar file ini dibuat.');
    process.exit(1);
  }

  const db = new DatabaseService();
  db.onModuleInit();
  const service = new McuService(db);

  // --- Tes 1: flag tersimpan ---
  console.log('=== 1. Simpan: penanda halaman baru bertahan di database ===');
  const marked = baseSections();

  // Kategori laboratorium dan poin EKG ditandai "halaman baru"
  const lab = marked.find((s) => s.id === 'sec_lab');
  if (lab) lab.pageBreakBefore = true;
  const ekg = marked.find((s) => s.id === 'sec_sup')?.items.find((i) => i.id === 's2');
  if (ekg) ekg.pageBreakBefore = true;

  const created = service.create(makeReportPayload(marked, 'TES OTOMATIS HALAMAN'));
  const saved: McuExamSection[] = JSON.parse(created.examinationSections || '[]');
  const savedSections = saved.filter((s) => s.pageBreakBefore).map((s) => s.id);
  const savedItems = saved.flatMap((s) => s.items.filter((i) => i.pageBreakBefore).map((i) => i.id));

  check('kategori pageBreakBefore tersimpan', savedSections.includes('sec_lab'), savedSections.join(',') || 'kosong');
  check('poin pageBreakBefore tersimpan', savedItems.includes('s2'), savedItems.join(',') || 'kosong');
  check('tidak bocor ke kategori lain', !savedSections.includes('sec_vital') && !savedSections.includes('sec_sup'));
  check('tidak bocor ke poin lain', !savedItems.includes('v1') && !savedItems.includes('l1'));

  // --- Tes 2: PDF menghormati penanda ---
  console.log('\n=== 2. PDF: jumlah halaman sesuai penanda ===');
  const plain = service.create(makeReportPayload(baseSections(), 'TES TANPA PENANDA'));

  const pdfPlain = await service.generateMcuPdf(plain.id);
  const pdfMarked = await service.generateMcuPdf(created.id);

  fs.writeFileSync(`hasil-mcu-${plain.id}.pdf`, pdfPlain);
  fs.writeFileSync(`hasil-mcu-${created.id}.pdf`, pdfMarked);

  const pagesPlain = countPdfPages(pdfPlain);
  const pagesMarked = countPdfPages(pdfMarked);
  console.log(`Halaman tanpa penanda: ${pagesPlain}`);
  console.log(`Halaman dengan 2 penanda : ${pagesMarked}`);

  check('tanpa penanda tetap ringkas (1 halaman)', pagesPlain === 1, `${pagesPlain} halaman`);
  check('dengan 2 penanda menjadi 3 halaman', pagesMarked === 3, `${pagesMarked} halaman`);
  check('PDF tertulis ke disk', fs.existsSync(`hasil-mcu-${created.id}.pdf`));

  // --- Tes 3: update juga menjaga flag ---
  console.log('\n=== 3. Update: penanda tetap ada setelah laporan diubah ===');
  const updatedSections = saved.map((s) => ({ ...s, items: s.items.map((i) => ({ ...i })) }));
  const updated = service.update(created.id, { ...makeReportPayload(updatedSections, 'TES OTOMATIS (REVISI)'), conclusionType: 'Fit' });
  const afterUpdate: McuExamSection[] = JSON.parse(updated.examinationSections || '[]');
  check(
    'penanda kategori masih ada setelah update',
    afterUpdate.some((s) => s.pageBreakBefore),
    afterUpdate.filter((s) => s.pageBreakBefore).map((s) => s.title).join(',') || 'kosong'
  );
  check(
    'penanda poin masih ada setelah update',
    afterUpdate.some((s) => s.items.some((i) => i.pageBreakBefore))
  );

  // Bersihkan data uji (hanya yang dibuat tes ini)
  service.delete(created.id);
  service.delete(plain.id);
  fs.unlinkSync(`hasil-mcu-${created.id}.pdf`);
  fs.unlinkSync(`hasil-mcu-${plain.id}.pdf`);
  db.onModuleDestroy();

  console.log(`\n${failures === 0 ? 'SEMUA TES LULUS' : `${failures} TES GAGAL`}`);
  process.exit(failures === 0 ? 0 : 1);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
