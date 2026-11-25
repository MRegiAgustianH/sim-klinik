// Template bawaan jenis "formulir": Formulir Permohonan Vaksinasi (pria dan
// wanita), disalin dari dokumen Word klinik:
//   FORMULIR PERMOHONAN VAKSINASI (Pria).docx   — 3 halaman
//   FORMULIR PERMOHONAN VAKSINASI (Wanita).docx — 4 halaman (+ pernyataan
//                                                  tidak hamil)
//
// Halaman: 1) permohonan vaksinasi, 2) formulir skrining + hasil pemeriksaan +
// status dosis, 3) persetujuan/izin tindakan vaksinasi, 4) (wanita) surat
// pernyataan / informed consent tes kehamilan.
//
// Setiap halaman memuat kop sendiri (kop gambar klinik), karena kop dari
// pengaturan template hanya muncul sekali di awal dokumen.
//
// Ukuran mengikuti dokumen Word aslinya agar setiap bagian muat satu lembar
// F4, baik saat dicetak dari browser maupun dibuka di MS Word: spasi tunggal,
// isi 12 pt, tabel 10,5 pt, margin 1,27 cm (kanan 1 cm). Kop memakai
// kop-formulir.jpeg, yaitu kop klinik yang ruang kosong di sekelilingnya
// sudah dipotong; tanpa itu kop memakan sepertiga halaman. Data pasien diisi
// otomatis bila pasien dipilih; isian yang kosong dicetak sebagai titik-titik
// untuk ditulis tangan (lihat fillTokens di web/src/lib/compose.ts).

import type { SeedTemplate, SeedVariable } from './seed';

const TAB = '<span class="sp-tab">\t</span>';
const BLANK = '<p><br></p>';
const PAGEBREAK = '<div class="sp-pagebreak"></div>';
export const FORM_KOP_IMAGE = 'kop-formulir.jpeg';
const KOP = `<div class="sp-img-wrap" style="text-align:center"><img src="/api/uploads/${FORM_KOP_IMAGE}" alt="Kop Klinik" style="width:18.6cm"></div>`;
const CELL = 'border:1px solid #000;padding:1pt 4pt;vertical-align:middle';
const SMALL = 'font-size:10.5pt';

/** Baris "Label : nilai" rata kiri dengan tab stop di 5 cm. */
function row(label: string, value: string) {
  return `<p data-tabs="l:5" style="margin-left:5.3cm;text-indent:-5.3cm">${label}${TAB}: ${value}</p>`;
}

function heading(...lines: string[]) {
  return lines.map((l) => `<p style="text-align:center"><b><span style="font-size:12pt">${l}</span></b></p>`).join('');
}

function para(text: string, bold = false) {
  return `<p style="text-align:justify">${bold ? `<b>${text}</b>` : text}</p>`;
}

/** Sel tanda tangan: judul, ruang tanda tangan, nama dalam kurung. */
function signCell(top: string[], name: string, width: string) {
  const lines = [...top, '<br>', '<br>', '<br>', `( ${name} )`];
  return `<td style="width:${width};text-align:center;vertical-align:top">${lines.map((l) => `<p style="text-align:center">${l}</p>`).join('')}</td>`;
}

// Garis nama untuk ditulis tangan; cukup pendek agar muat di kolom saksi (29%).
const DOTS = '………………………';

// ---------------------------------------------------------------------------
// Halaman 1 — permohonan vaksinasi
// ---------------------------------------------------------------------------

const PAGE_PERMOHONAN =
  KOP +
  BLANK +
  heading('FORMULIR', 'PERMOHONAN VAKSINASI') +
  BLANK +
  '<p>Saya yang bertanda tangan di bawah ini,</p>' +
  BLANK +
  row('Nama', '<b>{{nama_pasien}}</b>') +
  row('Nomor Paspor', '{{nomor_paspor}}') +
  row('Tempat, Tanggal Lahir', '{{ttl}}') +
  row('Jenis Kelamin', '{{jenis_kelamin}}') +
  row('Pekerjaan', '{{pekerjaan}}') +
  row('Email', '{{email_pasien}}') +
  row('Alamat / No. Telp', '{{alamat_pasien}} / {{no_hp}}') +
  row('Negara Tujuan', '{{negara_tujuan}}') +
  row('Tanggal Berangkat', '{{tanggal_berangkat}}') +
  row('Jenis Vaksinasi', '{{jenis_vaksinasi}}') +
  row('Nama Travel/Agen', '{{nama_travel}}') +
  row('Alamat Travel/Agen', '{{alamat_travel}}') +
  BLANK +
  para(
    'Dengan ini memohon kepada {{klinik_nama}} agar dapat memberikan vaksinasi {{jenis_vaksinasi}} kepada saya. ' +
      'Dengan ini saya juga menyatakan bahwa semua informasi yang berhubungan dengan vaksinasi ini telah saya ketahui, ' +
      'termasuk efek sampingnya atau Kejadian Ikutan Pasca Vaksinasi.',
    true
  ) +
  BLANK +
  para('Demikianlah permohonan ini dibuat agar dapat dipergunakan sebagaimana mestinya.') +
  BLANK +
  '<table class="sp-nob" style="width:100%;border-collapse:collapse"><tbody><tr>' +
  '<td style="width:55%"><p><br></p></td>' +
  signCell(['{{klinik_kota}}, {{tanggal_surat}}', 'Pemohon,'], '{{nama_pasien}}', '45%') +
  '</tr></tbody></table>';

// ---------------------------------------------------------------------------
// Halaman 2 — formulir skrining vaksinasi
// ---------------------------------------------------------------------------

const QUESTIONS = [
  'Apakah Anda sedang dalam kondisi sakit, demam, atau sedang mengonsumsi obat tertentu?',
  'Apakah Anda memiliki riwayat alergi terhadap obat, telur, atau bahan vaksin tertentu?',
  'Apakah Anda pernah mengalami reaksi berat setelah vaksin sebelumnya (misalnya sesak napas, pusing, bengkak parah, ruam hebat)?',
  'Apakah Anda pernah mendapat vaksin dalam 1 bulan terakhir?',
  'Apakah Anda pernah terkonfirmasi menderita Hepatitis?',
  'Apakah Anda sedang hamil atau menyusui?',
  'Apakah Anda mengalami gejala hepatitis kronis dalam 1 bulan terakhir?',
  'Apakah ada anggota keluarga serumah yang kontak erat/konfirmasi/sedang dalam perawatan karena penyakit hepatitis?',
  'Apakah Anda memiliki riwayat penyakit kronis atau mengalami gejala sesak napas, dll.?',
  'Apakah Anda sedang mendapatkan terapi aktif jangka panjang terhadap penyakit kelainan darah?',
  'Apakah Anda menderita penyakit jantung/gagal jantung?',
  'Apakah Anda menderita penyakit autoimun sistemik (SLE/Lupus dan autoimun lainnya)?',
  'Apakah Anda menderita penyakit ginjal?',
  'Apakah Anda menderita penyakit saluran pencernaan kronis?',
  'Apakah Anda memiliki riwayat transfusi darah atau transplantasi dalam 3 bulan terakhir?',
  'Apakah Anda punya alergi obat?',
  'Apakah Anda punya sakit diabetes?',
  'Apakah Anda sedang mengonsumsi obat ARV/menderita HIV?',
];

const th = (text: string, width?: string) =>
  `<td style="${CELL};text-align:center${width ? `;width:${width}` : ''}"><p style="text-align:center"><b><span style="${SMALL}">${text}</span></b></p></td>`;
const td = (text: string, center = false) =>
  `<td style="${CELL}${center ? ';text-align:center' : ''}"><p${center ? ' style="text-align:center"' : ''}><span style="${SMALL}">${text || '<br>'}</span></p></td>`;

const QUESTION_TABLE =
  '<table style="width:100%;border-collapse:collapse"><tbody>' +
  `<tr>${th('No', '1cm')}${th('Pertanyaan')}${th('Ya', '1.6cm')}${th('Tidak', '1.6cm')}</tr>` +
  QUESTIONS.map((q, i) => `<tr>${td(String(i + 1), true)}${td(q)}${td('')}${td('')}</tr>`).join('') +
  '</tbody></table>';

const DOSE_TABLE =
  '<table style="width:100%;border-collapse:collapse"><tbody>' +
  `<tr>${th('Dosis Pemberian', '30%')}${th('Status Pemberian', '42%')}${th('Tanggal', '28%')}</tr>` +
  ['Dosis 1', 'Dosis 2', 'Dosis 3']
    .map((d) => `<tr>${td(d)}${td('☐ Ya&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;☐ Tidak', true)}${td('')}</tr>`)
    .join('') +
  '</tbody></table>';

const VITALS =
  '<table class="sp-nob" style="width:100%;border-collapse:collapse"><tbody>' +
  '<tr>' +
  `<td style="width:34%"><p><span style="${SMALL}">TD : {{td}} mmHg</span></p></td>` +
  `<td style="width:33%"><p><span style="${SMALL}">Nadi : {{nadi}} x/menit</span></p></td>` +
  `<td style="width:33%"><p><span style="${SMALL}">SpO2 : {{spo2}} %</span></p></td>` +
  '</tr><tr>' +
  `<td><p><span style="${SMALL}">Suhu : {{suhu}} °C</span></p></td>` +
  `<td><p><span style="${SMALL}">RR : {{rr}} x/menit</span></p></td>` +
  '<td><p><br></p></td>' +
  '</tr></tbody></table>';

const PAGE_SKRINING =
  PAGEBREAK +
  KOP +
  BLANK +
  heading('FORMULIR VAKSINASI') +
  BLANK +
  '<p>Saya yang bertanda tangan di bawah ini,</p>' +
  BLANK +
  row('Nama', '<b>{{nama_pasien}}</b>') +
  row('Tempat, Tanggal Lahir', '{{ttl}}') +
  row('Jenis Kelamin', '{{jenis_kelamin}}') +
  row('Pekerjaan', '{{pekerjaan}}') +
  row('Alamat / No. Telp', '{{alamat_pasien}} / {{no_hp}}') +
  row('Jenis Vaksinasi', '{{jenis_vaksinasi}}') +
  BLANK +
  '<p><b>Hasil Pemeriksaan</b></p>' +
  VITALS +
  BLANK +
  QUESTION_TABLE +
  BLANK +
  DOSE_TABLE;

// ---------------------------------------------------------------------------
// Halaman 3 — persetujuan / izin tindakan vaksinasi
// ---------------------------------------------------------------------------

const PAGE_PERSETUJUAN =
  PAGEBREAK +
  KOP +
  BLANK +
  heading('FORMULIR', 'PERSETUJUAN/IZIN* TINDAKAN VAKSINASI') +
  BLANK +
  '<p>Saya yang bertanda tangan di bawah ini,</p>' +
  BLANK +
  row('Nama', '<b>{{nama_pasien}}</b>') +
  row('Alamat', '{{alamat_pasien}}') +
  row('No. Telp', '{{no_hp}}') +
  BLANK +
  '<p>Dengan ini menyatakan dengan sesungguhnya telah memberikan,</p>' +
  '<p style="text-align:center"><b>PERSETUJUAN / IZIN*</b></p>' +
  BLANK +
  row('Untuk diberikan vaksinasi', '<b>{{jenis_vaksinasi}}</b>') +
  '<p>Terhadap {{hubungan}}:</p>' +
  row('Nama', '<b>{{nama_pasien}}</b>') +
  row('Umur', '{{umur}}') +
  row('Nomor Paspor / NIK', '{{nomor_paspor}} / {{nik}}') +
  row('Tempat, Tanggal Lahir', '{{ttl}}') +
  row('Jenis Kelamin', '{{jenis_kelamin}}') +
  row('Pekerjaan', '{{pekerjaan}}') +
  row('Alamat', '{{alamat_pasien}}') +
  row('Nomor Telp', '{{no_hp}}') +
  BLANK +
  para(
    'Yang tujuan, sifat, dan perlunya tindakan vaksinasi tersebut di atas, serta risiko yang dapat ditimbulkan ' +
      '(Kejadian Ikutan Pasca Imunisasi) telah cukup dijelaskan dan telah saya mengerti semua.'
  ) +
  para('Demikian pernyataan persetujuan/izin* ini saya buat dengan penuh kesadaran dan tanpa paksaan.', true) +
  BLANK +
  '<table class="sp-nob" style="width:100%;border-collapse:collapse"><tbody><tr>' +
  signCell(['<br>', 'Saksi dari pihak pasien'], DOTS, '29%') +
  signCell(['<br>', 'Dokter/Operator'], DOTS, '29%') +
  signCell(['{{klinik_kota}}, {{tanggal_surat}}', 'Yang membuat pernyataan'], '{{nama_pasien}}', '42%') +
  '</tr><tr>' +
  signCell(['<br>', 'Saksi dari pihak klinik'], DOTS, '29%') +
  '<td><p><br></p></td><td><p><br></p></td>' +
  '</tr></tbody></table>' +
  BLANK +
  `<p data-tabs="l:1.2" style="margin-left:1.5cm;text-indent:-1.5cm"><span style="${SMALL}">*) Ket.${TAB}: &ldquo;Persetujuan&rdquo; untuk orang dewasa, kata &ldquo;izin&rdquo; dicoret.</span></p>` +
  `<p style="margin-left:1.5cm"><span style="${SMALL}">&ldquo;Izin&rdquo; untuk anak-anak, kata &ldquo;persetujuan&rdquo; dicoret.</span></p>`;

// ---------------------------------------------------------------------------
// Halaman 4 (wanita) — pernyataan tidak hamil / informed consent
// ---------------------------------------------------------------------------

const PAGE_TIDAK_HAMIL =
  PAGEBREAK +
  KOP +
  BLANK +
  heading('SURAT PERNYATAAN / INFORMED CONSENT') +
  BLANK +
  '<p>Saya yang bertanda tangan di bawah ini:</p>' +
  BLANK +
  row('Nama Pasien', '<b>{{nama_pasien}}</b>') +
  row('NIK', '{{nik}}') +
  row('Tempat, Tanggal Lahir', '{{ttl}}') +
  row('Alamat', '{{alamat_pasien}}') +
  row('No. Rekam Medis', '{{no_rekam_medis}}') +
  BLANK +
  '<p>Dengan ini menyatakan bahwa:</p>' +
  '<ol style="list-style-type:decimal">' +
  [
    'Saya menyatakan telah mengalami menstruasi/haid pada tanggal {{tanggal_haid}}.',
    'Berdasarkan kondisi tersebut, saya meyakini bahwa saat ini saya tidak dalam keadaan hamil.',
    'Saya memilih untuk tidak melakukan pemeriksaan kehamilan (tes kehamilan) di fasilitas kesehatan.',
    'Saya memahami bahwa pemeriksaan kehamilan dianjurkan sebelum menjalani tindakan atau pemeriksaan tertentu untuk keamanan dan keselamatan pasien.',
    'Segala risiko yang timbul akibat keputusan ini telah saya pahami dan menjadi tanggung jawab saya.',
    'Saya memberikan persetujuan ini dalam keadaan sadar, tanpa paksaan dari pihak mana pun.',
  ]
    // Butir berisi isian titik-titik dibuat rata kiri agar spasinya tidak meregang.
    .map((t) => `<li style="text-align:${t.includes('{{') ? 'left' : 'justify'}">${t}</li>`)
    .join('') +
  '</ol>' +
  BLANK +
  para('Demikian pernyataan ini saya buat dengan sebenarnya untuk dipergunakan sebagaimana mestinya.') +
  BLANK +
  '<table class="sp-nob" style="width:100%;border-collapse:collapse"><tbody><tr>' +
  signCell(['<br>', 'Saksi/Perawat'], DOTS, '50%') +
  signCell(['{{klinik_kota}}, {{tanggal_surat}}', 'Pasien'], '{{nama_pasien}}', '50%') +
  '</tr></tbody></table>';

// ---------------------------------------------------------------------------
// Variabel
// ---------------------------------------------------------------------------

const MANUAL = 'Kosongkan untuk ditulis tangan — dicetak sebagai titik-titik.';

const COMMON_VARS: SeedVariable[] = [
  {
    key: 'jenis_vaksinasi',
    label: 'Jenis vaksinasi',
    type: 'select',
    options: ['Meningitis Meningokokus (ACWY)', 'Yellow Fever', 'Influenza', 'Polio (OPV/IPV)', 'Hepatitis B', 'Tifoid'],
    hint: MANUAL,
  },
  { key: 'nomor_paspor', label: 'Nomor paspor', type: 'text', hint: MANUAL },
  { key: 'negara_tujuan', label: 'Negara tujuan', type: 'text', hint: 'mis. Arab Saudi' },
  { key: 'tanggal_berangkat', label: 'Tanggal berangkat', type: 'date' },
  { key: 'nama_travel', label: 'Nama travel/agen', type: 'text' },
  { key: 'alamat_travel', label: 'Alamat travel/agen', type: 'text' },
  { key: 'td', label: 'Tekanan darah (TD)', type: 'text', hint: `mis. 120/80. ${MANUAL}` },
  { key: 'nadi', label: 'Nadi (x/menit)', type: 'text' },
  { key: 'spo2', label: 'SpO2 (%)', type: 'text' },
  { key: 'suhu', label: 'Suhu (°C)', type: 'text' },
  { key: 'rr', label: 'Laju napas / RR (x/menit)', type: 'text' },
  {
    key: 'hubungan',
    label: 'Vaksinasi diberikan kepada',
    type: 'select',
    options: ['diri saya sendiri', 'suami saya', 'istri saya', 'anak saya', 'ayah saya', 'ibu saya'],
    default: 'diri saya sendiri',
    hint: 'Halaman persetujuan. Bila bukan pasien sendiri yang menandatangani, ubah nama/alamat di atasnya langsung di editor.',
  },
];

// Sama dengan dokumen Word asli klinik (F4, margin 1,27 cm / kanan 1 cm,
// Arial 12 pt, spasi tunggal).
export const FORM_PAGE = {
  pageSize: 'F4',
  orientation: 'portrait',
  margins: { top: 1.27, right: 1, bottom: 1.27, left: 1.27 },
  fontFamily: 'Arial',
  fontSize: 12,
  lineSpacing: 1,
};

const NO_SIGNATURE = { layout: 'tanpa' as const, showPlaceDate: false, slots: [] };

export const SEED_FORM_TEMPLATES: SeedTemplate[] = [
  {
    code: 'FPV-P',
    name: 'Formulir Permohonan Vaksinasi (Pria)',
    category: 'formulir',
    description: 'Permohonan vaksinasi, formulir skrining & hasil pemeriksaan, serta persetujuan tindakan vaksinasi (3 halaman).',
    letterheadMode: 'none',
    bodyHtml: PAGE_PERMOHONAN + PAGE_SKRINING + PAGE_PERSETUJUAN,
    signature: NO_SIGNATURE,
    page: FORM_PAGE,
    variables: COMMON_VARS,
  },
  {
    code: 'FPV-W',
    name: 'Formulir Permohonan Vaksinasi (Wanita)',
    category: 'formulir',
    description:
      'Seperti formulir pria, ditambah surat pernyataan/informed consent tidak hamil bagi pasien yang tidak melakukan tes kehamilan (4 halaman).',
    letterheadMode: 'none',
    bodyHtml: PAGE_PERMOHONAN + PAGE_SKRINING + PAGE_PERSETUJUAN + PAGE_TIDAK_HAMIL,
    signature: NO_SIGNATURE,
    page: FORM_PAGE,
    variables: [
      ...COMMON_VARS,
      { key: 'no_rekam_medis', label: 'No. rekam medis', type: 'text', hint: 'Halaman pernyataan tidak hamil.' },
      { key: 'tanggal_haid', label: 'Tanggal haid terakhir', type: 'date', hint: `Halaman pernyataan tidak hamil. ${MANUAL}` },
    ],
  },
];

/**
 * Template yang ditambahkan setelah database production sudah berisi data.
 * Dibuat sekali (ditandai di tabel settings), sehingga bila Superadmin
 * menghapus atau mengganti kodenya, template ini tidak muncul kembali.
 */
export const LATER_SEEDS: Array<{ marker: string; codes: string[] }> = [{ marker: 'seed_formulir_vaksinasi', codes: ['FPV-P', 'FPV-W'] }];

/**
 * Pembaruan isi template bawaan yang sudah tersimpan di database, dijalankan
 * sekali per penanda. Hanya template yang belum pernah diubah Superadmin
 * (versi 1, terakhir diubah 'sistem') yang ikut diperbarui; template yang
 * sudah disunting dibiarkan.
 *
 * v2: tata letak mengikuti dokumen Word asli (spasi tunggal, 12 pt, margin
 * 1,27 cm, kop dipotong) agar setiap bagian muat satu lembar F4.
 */
export const SEED_UPGRADES: Array<{ marker: string; codes: string[] }> = [
  { marker: 'formulir_vaksinasi_tata_letak_v2', codes: ['FPV-P', 'FPV-W'] },
];
