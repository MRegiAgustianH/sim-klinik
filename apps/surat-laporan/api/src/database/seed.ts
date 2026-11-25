// Data awal sistem surat: pengaturan klinik, kop, penandatangan, dan template.
//
// Template ditulis dalam HTML yang sama dengan keluaran editor SuratPro
// (paragraf <p>, tab stop data-tabs + <span class="sp-tab">, tabel tanpa garis
// sp-nob), sehingga setelah dibuka di editor tampilannya tidak bergeser.
// Token {{variabel}} diisi saat surat dibuat. Daftar token sistem dan pasien
// ada di apps/surat-laporan/web/src/lib/variables.ts.

import { SEED_FORM_TEMPLATES } from './seed-formulir';

export const DEFAULT_SETTINGS: Record<string, string> = {
  klinik_nama: 'Klinik Utama Dr. H. A. Rotinsulu Cianjur',
  klinik_alamat: 'Jalan Siliwangi No. 19, Pamoyanan, Cianjur 43211',
  klinik_kota: 'Cianjur',
  klinik_telepon: '(0263) 261868',
  klinik_email: '',
  klinik_website: 'https://kurotinsulucianjur.rsparurotinsulu.com/',
  kode_instansi: 'KU-RTS',
  pola_nomor: '{no}/{kode}/{instansi}/{bulan}/{tahun}',
  digit_nomor: '3',
};

export const SEED_LETTERHEADS = [
  {
    name: 'Kop Resmi Klinik (gambar)',
    isDefault: true,
    html:
      '<div class="sp-img-wrap" style="text-align:center"><img src="/api/uploads/kop-klinik.jpeg" alt="Kop Klinik" style="width:16.5cm"></div>' +
      '<hr style="border:none;border-top:3px double #000;margin:0 0 8pt">',
  },
  {
    name: 'Kop Teks Klinik',
    isDefault: false,
    html:
      '<p style="text-align:center"><span style="font-size:13pt">KEMENTERIAN KESEHATAN REPUBLIK INDONESIA</span></p>' +
      '<p style="text-align:center"><span style="font-size:12pt">DIREKTORAT JENDERAL KESEHATAN LANJUTAN</span></p>' +
      '<p style="text-align:center"><b><span style="font-size:15pt">KLINIK UTAMA DR. H. A. ROTINSULU CIANJUR</span></b></p>' +
      '<p style="text-align:center"><span style="font-size:10pt">{{klinik_alamat}} · Telepon {{klinik_telepon}}</span></p>' +
      '<p style="text-align:center"><span style="font-size:10pt">{{klinik_website}}</span></p>' +
      '<hr style="border:none;border-top:3px double #000;margin:2pt 0 8pt">',
  },
];

export const SEED_SIGNERS = [
  { name: 'dr. NAMA KEPALA KLINIK', position: 'Kepala Klinik Utama Dr. H. A. Rotinsulu Cianjur', idLabel: 'NIP', idNumber: '000000000000000000' },
  { name: 'dr. H. Rahmat Hidayat, Sp.A', position: 'Dokter Pemeriksa', idLabel: 'SIP', idNumber: '000/SIP/DINKES/2026' },
  { name: 'NAMA PENANGGUNG JAWAB', position: 'Penanggung Jawab Administrasi', idLabel: 'NIP', idNumber: '' },
];

// ---------------------------------------------------------------------------
// Potongan HTML yang dipakai berulang
// ---------------------------------------------------------------------------

const TAB = '<span class="sp-tab">\t</span>';
const BLANK = '<p><br></p>';

/** Baris "Label : nilai" dengan tab stop; indent = jarak dari margin kiri (cm). */
function row(label: string, value: string, opts: { indent?: number; tab?: number } = {}) {
  const indent = opts.indent ?? 1.27;
  const tab = opts.tab ?? indent + 4;
  const hang = tab - indent + 0.3;
  return `<p data-tabs="l:${tab}" style="margin-left:${round(indent + hang)}cm;text-indent:-${round(hang)}cm">${label}${TAB}: ${value}</p>`;
}

function round(n: number) {
  return Math.round(n * 100) / 100;
}

function para(text: string, opts: { indentFirst?: boolean; spaceBefore?: boolean } = {}) {
  const style = ['text-align:justify'];
  if (opts.indentFirst !== false) style.push('text-indent:1.27cm');
  if (opts.spaceBefore) style.push('margin-top:6pt');
  return `<p style="${style.join(';')}">${text}</p>`;
}

function title(text: string, withNumber = true) {
  return (
    `<p style="text-align:center"><b><u><span style="font-size:14pt">${text}</span></u></b></p>` +
    (withNumber ? '<p style="text-align:center">Nomor: {{nomor_surat}}</p>' : '') +
    BLANK
  );
}

const SIGNATURE = '<p>{{tanda_tangan}}</p>';

/** Blok kepala surat dinas: nomor, sifat, lampiran, perihal + tempat/tanggal di kanan. */
const OFFICIAL_HEADER =
  `<p data-tabs="l:2.5,l:10.5">Nomor${TAB}: {{nomor_surat}}${TAB}{{klinik_kota}}, {{tanggal_surat}}</p>` +
  `<p data-tabs="l:2.5">Sifat${TAB}: {{sifat}}</p>` +
  `<p data-tabs="l:2.5">Lampiran${TAB}: {{lampiran}}</p>` +
  `<p data-tabs="l:2.5" style="margin-left:2.75cm;text-indent:-2.75cm">Perihal${TAB}: <b>{{perihal}}</b></p>` +
  BLANK +
  '<p>Kepada Yth.</p><p>{{tujuan}}</p><p>di {{tempat_tujuan}}</p>' +
  BLANK;

const PATIENT_ROWS =
  row('Nama', '<b>{{nama_pasien}}</b>') +
  row('NIK', '{{nik}}') +
  row('Tempat/Tgl. Lahir', '{{ttl}}') +
  row('Umur', '{{umur}}') +
  row('Jenis Kelamin', '{{jenis_kelamin}}') +
  row('Pekerjaan', '{{pekerjaan}}') +
  row('Alamat', '{{alamat_pasien}}');

const CLOSING_KELUAR = para('Demikian surat keterangan ini dibuat dengan sebenarnya untuk dapat dipergunakan sebagaimana mestinya.', {
  spaceBefore: true,
});

// ---------------------------------------------------------------------------
// Tipe data template (sama dengan yang dipakai frontend)
// ---------------------------------------------------------------------------

type VarType = 'text' | 'textarea' | 'number' | 'date' | 'time' | 'select' | 'list' | 'tabel';

export interface SeedVariable {
  key: string;
  label: string;
  type: VarType;
  required?: boolean;
  options?: string[];
  columns?: string[];
  default?: string;
  hint?: string;
  heading?: string;
  listStyle?: 'decimal' | 'lower-alpha' | 'disc' | 'none';
}

export interface SeedSignature {
  layout: 'kanan' | 'kiri' | 'tengah' | 'kolom' | 'bertingkat' | 'tanpa';
  showPlaceDate: boolean;
  slots: Array<{ prefix?: string; label: string; signerPosition?: string; showId?: boolean }>;
}

export interface SeedTemplate {
  code: string;
  name: string;
  category: 'keluar' | 'internal' | 'formulir';
  description: string;
  /** Bawaan 'default' (kop bawaan). Formulir memakai 'none' dan memuat kop di tiap halaman. */
  letterheadMode?: 'default' | 'none';
  bodyHtml: string;
  closingHtml?: string;
  signature: SeedSignature;
  page?: Record<string, unknown>;
  variables: SeedVariable[];
}

const SIFAT: SeedVariable = { key: 'sifat', label: 'Sifat', type: 'select', options: ['Biasa', 'Penting', 'Segera', 'Rahasia'], default: 'Biasa' };
const LAMPIRAN: SeedVariable = { key: 'lampiran', label: 'Lampiran', type: 'text', default: '-' };
const TEMPAT_TUJUAN: SeedVariable = { key: 'tempat_tujuan', label: 'Alamat / tempat tujuan', type: 'text', default: 'Tempat' };
const TEMBUSAN: SeedVariable = {
  key: 'tembusan',
  label: 'Tembusan',
  type: 'list',
  heading: 'Tembusan:',
  hint: 'Satu penerima per baris. Kosongkan bila tidak ada tembusan.',
};
const KEPERLUAN: SeedVariable = { key: 'keperluan', label: 'Keperluan', type: 'text', required: true, hint: 'mis. persyaratan melamar pekerjaan' };
const TGL_PERIKSA: SeedVariable = { key: 'tanggal_periksa', label: 'Tanggal pemeriksaan', type: 'date', required: true };

const DOKTER_KANAN: SeedSignature = {
  layout: 'kanan',
  showPlaceDate: true,
  slots: [{ label: 'Dokter Pemeriksa,', signerPosition: 'Dokter Pemeriksa', showId: true }],
};
const KEPALA_KANAN: SeedSignature = {
  layout: 'kanan',
  showPlaceDate: false,
  slots: [{ label: 'Kepala Klinik,', signerPosition: 'Kepala Klinik Utama Dr. H. A. Rotinsulu Cianjur', showId: true }],
};

// ---------------------------------------------------------------------------
// Template bawaan
// ---------------------------------------------------------------------------

export const SEED_TEMPLATES: SeedTemplate[] = [
  // ===================== SURAT KELUAR (berkaitan dengan pasien) =====================
  {
    code: 'SKS',
    name: 'Surat Keterangan Sehat',
    category: 'keluar',
    description: 'Keterangan sehat hasil pemeriksaan fisik untuk melamar kerja, sekolah, atau persyaratan lain.',
    bodyHtml:
      title('SURAT KETERANGAN SEHAT') +
      para('Yang bertanda tangan di bawah ini, dokter pemeriksa pada {{klinik_nama}}, menerangkan dengan sesungguhnya bahwa:') +
      PATIENT_ROWS +
      para('Telah dilakukan pemeriksaan kesehatan pada tanggal {{tanggal_periksa}} dengan hasil sebagai berikut:', { spaceBefore: true }) +
      row('Tinggi Badan', '{{tinggi_badan}} cm') +
      row('Berat Badan', '{{berat_badan}} kg') +
      row('Tekanan Darah', '{{tekanan_darah}} mmHg') +
      row('Buta Warna', '{{buta_warna}}') +
      para('Berdasarkan hasil pemeriksaan tersebut, yang bersangkutan dinyatakan dalam keadaan <b>{{kesimpulan}}</b>. Surat keterangan ini diberikan untuk keperluan {{keperluan}}.', {
        spaceBefore: true,
      }) +
      CLOSING_KELUAR +
      BLANK +
      SIGNATURE,
    signature: DOKTER_KANAN,
    variables: [
      TGL_PERIKSA,
      { key: 'tinggi_badan', label: 'Tinggi badan (cm)', type: 'number' },
      { key: 'berat_badan', label: 'Berat badan (kg)', type: 'number' },
      { key: 'tekanan_darah', label: 'Tekanan darah', type: 'text', hint: 'mis. 120/80' },
      { key: 'buta_warna', label: 'Buta warna', type: 'select', options: ['Tidak', 'Parsial', 'Total'], default: 'Tidak' },
      { key: 'kesimpulan', label: 'Kesimpulan', type: 'select', options: ['SEHAT', 'SEHAT DENGAN CATATAN'], default: 'SEHAT', required: true },
      KEPERLUAN,
    ],
  },
  {
    code: 'SKT',
    name: 'Surat Keterangan Sakit',
    category: 'keluar',
    description: 'Keterangan sakit dan anjuran istirahat untuk sekolah atau tempat kerja.',
    bodyHtml:
      title('SURAT KETERANGAN SAKIT') +
      para('Yang bertanda tangan di bawah ini, dokter pemeriksa pada {{klinik_nama}}, menerangkan bahwa:') +
      PATIENT_ROWS +
      para(
        'Berdasarkan hasil pemeriksaan pada tanggal {{tanggal_periksa}}, yang bersangkutan dalam keadaan sakit dengan diagnosis <b>{{diagnosis}}</b>, sehingga perlu beristirahat selama <b>{{lama_istirahat}} ({{lama_istirahat_terbilang}}) hari</b>, terhitung mulai tanggal {{tanggal_mulai}} sampai dengan {{tanggal_selesai}}.',
        { spaceBefore: true }
      ) +
      CLOSING_KELUAR +
      BLANK +
      SIGNATURE,
    signature: DOKTER_KANAN,
    variables: [
      TGL_PERIKSA,
      { key: 'diagnosis', label: 'Diagnosis', type: 'text', hint: 'Boleh ditulis umum bila pasien tidak berkenan diagnosis dicantumkan.' },
      { key: 'lama_istirahat', label: 'Lama istirahat (hari)', type: 'number', required: true },
      { key: 'lama_istirahat_terbilang', label: 'Terbilang', type: 'text', hint: 'mis. tiga' },
      { key: 'tanggal_mulai', label: 'Mulai tanggal', type: 'date', required: true },
      { key: 'tanggal_selesai', label: 'Sampai tanggal', type: 'date', required: true },
    ],
  },
  {
    code: 'SRJ',
    name: 'Surat Rujukan',
    category: 'keluar',
    description: 'Rujukan pasien ke rumah sakit atau dokter spesialis beserta ringkasan klinis.',
    bodyHtml:
      `<p data-tabs="l:2.5,l:10.5">Nomor${TAB}: {{nomor_surat}}${TAB}{{klinik_kota}}, {{tanggal_surat}}</p>` +
      `<p data-tabs="l:2.5">Perihal${TAB}: <b>Rujukan Pasien</b></p>` +
      BLANK +
      '<p>Kepada Yth.</p><p>{{tujuan}}</p><p>di {{tempat_tujuan}}</p>' +
      BLANK +
      '<p>Dengan hormat,</p>' +
      para('Bersama ini kami kirimkan pasien untuk mendapatkan pemeriksaan dan penanganan lebih lanjut, dengan data sebagai berikut:') +
      PATIENT_ROWS +
      row('Anamnesis', '{{anamnesis}}') +
      row('Pemeriksaan Fisik', '{{pemeriksaan_fisik}}') +
      row('Diagnosis Sementara', '<b>{{diagnosis}}</b>') +
      row('Terapi Diberikan', '{{terapi}}') +
      row('Alasan Dirujuk', '{{alasan_rujukan}}') +
      para('Atas perhatian dan kerja sama Teman Sejawat, kami ucapkan terima kasih.', { spaceBefore: true }) +
      BLANK +
      SIGNATURE,
    signature: { layout: 'kanan', showPlaceDate: false, slots: [{ label: 'Dokter Perujuk,', signerPosition: 'Dokter Pemeriksa', showId: true }] },
    variables: [
      TEMPAT_TUJUAN,
      { key: 'anamnesis', label: 'Anamnesis / keluhan', type: 'textarea', required: true },
      { key: 'pemeriksaan_fisik', label: 'Pemeriksaan fisik', type: 'textarea' },
      { key: 'diagnosis', label: 'Diagnosis sementara', type: 'text', required: true },
      { key: 'terapi', label: 'Terapi yang telah diberikan', type: 'textarea', default: '-' },
      { key: 'alasan_rujukan', label: 'Alasan dirujuk', type: 'text', required: true },
    ],
  },
  {
    code: 'SKV',
    name: 'Surat Keterangan Vaksinasi',
    category: 'keluar',
    description: 'Keterangan telah menerima vaksin (meningitis, yellow fever, dll.) beserta nomor batch dan ICV.',
    bodyHtml:
      title('SURAT KETERANGAN VAKSINASI') +
      para('Yang bertanda tangan di bawah ini, dokter pada {{klinik_nama}}, menerangkan bahwa:') +
      PATIENT_ROWS +
      para('telah mendapatkan vaksinasi dengan keterangan sebagai berikut:', { spaceBefore: true, indentFirst: false }) +
      row('Jenis Vaksin', '<b>{{jenis_vaksin}}</b>') +
      row('Tanggal Vaksinasi', '{{tanggal_vaksinasi}}') +
      row('Dosis', '{{dosis}}') +
      row('Nomor Batch', '{{nomor_batch}}') +
      row('Nomor ICV', '{{nomor_icv}}') +
      para('Surat keterangan ini diberikan untuk keperluan {{keperluan}}.', { spaceBefore: true }) +
      CLOSING_KELUAR +
      BLANK +
      SIGNATURE,
    signature: { ...DOKTER_KANAN, slots: [{ label: 'Dokter Penanggung Jawab,', signerPosition: 'Dokter Pemeriksa', showId: true }] },
    variables: [
      {
        key: 'jenis_vaksin',
        label: 'Jenis vaksin',
        type: 'select',
        options: ['Meningitis Meningokokus (ACWY)', 'Yellow Fever', 'Influenza', 'Polio (OPV/IPV)', 'Hepatitis B', 'Tifoid'],
        required: true,
      },
      { key: 'tanggal_vaksinasi', label: 'Tanggal vaksinasi', type: 'date', required: true },
      { key: 'dosis', label: 'Dosis', type: 'text', default: '0,5 ml' },
      { key: 'nomor_batch', label: 'Nomor batch', type: 'text' },
      { key: 'nomor_icv', label: 'Nomor ICV', type: 'text' },
      { ...KEPERLUAN, hint: 'mis. perjalanan ibadah umrah' },
    ],
  },
  {
    code: 'SKTK',
    name: 'Surat Keterangan Hasil Tes Kehamilan',
    category: 'keluar',
    description: 'Hasil skrining tes kehamilan wanita usia subur (mis. syarat vaksinasi).',
    bodyHtml:
      title('SURAT KETERANGAN HASIL PEMERIKSAAN TES KEHAMILAN') +
      para('Yang bertanda tangan di bawah ini, dokter pemeriksa pada {{klinik_nama}}, menerangkan bahwa:') +
      PATIENT_ROWS +
      para('Telah dilakukan pemeriksaan tes kehamilan dengan hasil sebagai berikut:', { spaceBefore: true }) +
      row('Tanggal Pemeriksaan', '{{tanggal_periksa}}') +
      row('Metode', '{{metode}}') +
      row('Hasil', '<b>{{hasil}}</b>') +
      para('Surat keterangan ini diberikan untuk keperluan {{keperluan}}.', { spaceBefore: true }) +
      CLOSING_KELUAR +
      BLANK +
      SIGNATURE,
    signature: DOKTER_KANAN,
    variables: [
      TGL_PERIKSA,
      { key: 'metode', label: 'Metode', type: 'select', options: ['Strip test urine (hCG)', 'Pemeriksaan darah (β-hCG)'], default: 'Strip test urine (hCG)' },
      { key: 'hasil', label: 'Hasil', type: 'select', options: ['NEGATIF', 'POSITIF'], required: true },
      { ...KEPERLUAN, default: 'persyaratan vaksinasi' },
    ],
  },
  {
    code: 'SMCU',
    name: 'Surat Keterangan Hasil Medical Check Up',
    category: 'keluar',
    description: 'Ringkasan kesimpulan MCU (fit / unfit) untuk perusahaan atau instansi.',
    bodyHtml:
      title('SURAT KETERANGAN HASIL MEDICAL CHECK UP') +
      para('Yang bertanda tangan di bawah ini, dokter pemeriksa pada {{klinik_nama}}, menerangkan bahwa:') +
      PATIENT_ROWS +
      para('Telah menjalani Medical Check Up dengan keterangan sebagai berikut:', { spaceBefore: true }) +
      row('Tanggal Pemeriksaan', '{{tanggal_periksa}}') +
      row('Nomor Laporan MCU', '{{nomor_mcu}}') +
      row('Kesimpulan', '<b>{{kesimpulan}}</b>') +
      row('Catatan', '{{catatan}}') +
      para('Rincian hasil pemeriksaan terlampir dalam laporan Medical Check Up. Surat keterangan ini diberikan untuk keperluan {{keperluan}}.', {
        spaceBefore: true,
      }) +
      CLOSING_KELUAR +
      BLANK +
      SIGNATURE,
    signature: DOKTER_KANAN,
    variables: [
      TGL_PERIKSA,
      { key: 'nomor_mcu', label: 'Nomor laporan MCU', type: 'text' },
      {
        key: 'kesimpulan',
        label: 'Kesimpulan',
        type: 'select',
        options: ['FIT TO WORK', 'FIT DENGAN CATATAN', 'TEMPORARY UNFIT', 'UNFIT'],
        required: true,
      },
      { key: 'catatan', label: 'Catatan', type: 'textarea', default: '-' },
      KEPERLUAN,
    ],
  },

  // ===================== SURAT INTERNAL (administrasi klinik) =====================
  {
    code: 'SPG',
    name: 'Surat Pengajuan',
    category: 'internal',
    description: 'Pengajuan kegiatan, anggaran, atau kebutuhan unit kepada pimpinan.',
    bodyHtml:
      OFFICIAL_HEADER +
      '<p>Dengan hormat,</p>' +
      para('Sehubungan dengan {{latar_belakang}}, bersama ini kami mengajukan {{isi_pengajuan}} dengan rincian sebagai berikut:') +
      '<p>{{rincian}}</p>' +
      para('Perkiraan anggaran yang dibutuhkan sebesar <b>{{anggaran}}</b>.', { spaceBefore: true }) +
      para('Demikian surat pengajuan ini kami sampaikan. Atas perhatian dan persetujuan Bapak/Ibu, kami ucapkan terima kasih.', {
        spaceBefore: true,
      }) +
      BLANK +
      SIGNATURE,
    closingHtml: '<p>{{tembusan}}</p>',
    signature: {
      layout: 'kolom',
      showPlaceDate: false,
      slots: [
        { prefix: 'Mengetahui,', label: 'Kepala Klinik,', signerPosition: 'Kepala Klinik Utama Dr. H. A. Rotinsulu Cianjur', showId: true },
        { label: 'Pemohon,', signerPosition: 'Penanggung Jawab Administrasi', showId: true },
      ],
    },
    variables: [
      SIFAT,
      LAMPIRAN,
      TEMPAT_TUJUAN,
      { key: 'latar_belakang', label: 'Latar belakang', type: 'textarea', required: true, hint: 'Lanjutan dari "Sehubungan dengan ..."' },
      { key: 'isi_pengajuan', label: 'Yang diajukan', type: 'text', required: true },
      { key: 'rincian', label: 'Rincian', type: 'list', hint: 'Satu butir per baris.' },
      { key: 'anggaran', label: 'Perkiraan anggaran', type: 'text', default: 'Rp -' },
      TEMBUSAN,
    ],
  },
  {
    code: 'SPB',
    name: 'Surat Permintaan Pengadaan Barang',
    category: 'internal',
    description: 'Permintaan pengadaan obat, alat kesehatan, ATK, atau barang lain lengkap dengan tabel barang.',
    bodyHtml:
      OFFICIAL_HEADER +
      '<p>Dengan hormat,</p>' +
      para('Dalam rangka {{keperluan}}, bersama ini kami mengajukan permintaan pengadaan barang sebagai berikut:') +
      '<p>{{daftar_barang}}</p>' +
      para('Barang tersebut diharapkan dapat tersedia paling lambat tanggal {{batas_waktu}}.', { spaceBefore: true }) +
      para('Demikian permintaan ini kami sampaikan. Atas perhatian dan kerja samanya, kami ucapkan terima kasih.', { spaceBefore: true }) +
      BLANK +
      SIGNATURE,
    closingHtml: '<p>{{tembusan}}</p>',
    signature: {
      layout: 'kolom',
      showPlaceDate: false,
      slots: [
        { prefix: 'Menyetujui,', label: 'Kepala Klinik,', signerPosition: 'Kepala Klinik Utama Dr. H. A. Rotinsulu Cianjur', showId: true },
        { label: 'Pemohon,', signerPosition: 'Penanggung Jawab Administrasi', showId: true },
      ],
    },
    variables: [
      SIFAT,
      LAMPIRAN,
      TEMPAT_TUJUAN,
      { key: 'keperluan', label: 'Dalam rangka', type: 'text', required: true, hint: 'mis. pemenuhan stok vaksin bulan Desember' },
      {
        key: 'daftar_barang',
        label: 'Daftar barang',
        type: 'tabel',
        columns: ['Nama Barang', 'Spesifikasi', 'Jumlah', 'Satuan', 'Keterangan'],
        required: true,
      },
      { key: 'batas_waktu', label: 'Dibutuhkan paling lambat', type: 'date' },
      TEMBUSAN,
    ],
  },
  {
    code: 'SPM',
    name: 'Surat Permohonan',
    category: 'internal',
    description: 'Permohonan umum kepada instansi lain: izin, kerja sama, data, narasumber, dan sebagainya.',
    bodyHtml:
      OFFICIAL_HEADER +
      '<p>Dengan hormat,</p>' +
      para('{{isi_permohonan}}') +
      para('Besar harapan kami agar permohonan ini dapat dikabulkan. Atas perhatian dan kerja sama Bapak/Ibu, kami ucapkan terima kasih.', {
        spaceBefore: true,
      }) +
      BLANK +
      SIGNATURE,
    closingHtml: '<p>{{tembusan}}</p>',
    signature: KEPALA_KANAN,
    variables: [
      SIFAT,
      LAMPIRAN,
      TEMPAT_TUJUAN,
      { key: 'isi_permohonan', label: 'Isi permohonan', type: 'textarea', required: true },
      TEMBUSAN,
    ],
  },
  {
    code: 'ST',
    name: 'Surat Tugas',
    category: 'internal',
    description: 'Penugasan pegawai untuk kegiatan, pelatihan, atau pelayanan di luar klinik.',
    bodyHtml:
      title('SURAT TUGAS') +
      para('Yang bertanda tangan di bawah ini:', { indentFirst: false }) +
      row('Nama', '<b>{{ttd_1_nama}}</b>', { indent: 0, tab: 3.5 }) +
      row('Jabatan', '{{ttd_1_jabatan}}', { indent: 0, tab: 3.5 }) +
      para('dengan ini menugaskan kepada:', { spaceBefore: true, indentFirst: false }) +
      '<p>{{daftar_petugas}}</p>' +
      para('untuk melaksanakan tugas sebagai berikut:', { spaceBefore: true, indentFirst: false }) +
      row('Kegiatan', '<b>{{kegiatan}}</b>', { indent: 0, tab: 3.5 }) +
      row('Hari/Tanggal', '{{tanggal_tugas_hari}}, {{tanggal_tugas}}', { indent: 0, tab: 3.5 }) +
      row('Waktu', '{{waktu}}', { indent: 0, tab: 3.5 }) +
      row('Tempat', '{{tempat_tugas}}', { indent: 0, tab: 3.5 }) +
      para('Demikian surat tugas ini dibuat untuk dilaksanakan dengan penuh tanggung jawab dan melaporkan hasilnya kepada pimpinan.', {
        spaceBefore: true,
      }) +
      BLANK +
      SIGNATURE,
    signature: { ...KEPALA_KANAN, showPlaceDate: true },
    variables: [
      { key: 'daftar_petugas', label: 'Petugas', type: 'tabel', columns: ['Nama', 'NIP/NIK', 'Jabatan'], required: true },
      { key: 'kegiatan', label: 'Kegiatan', type: 'text', required: true },
      { key: 'tanggal_tugas', label: 'Tanggal tugas', type: 'date', required: true },
      { key: 'waktu', label: 'Waktu', type: 'text', default: '08.00 WIB s.d. selesai' },
      { key: 'tempat_tugas', label: 'Tempat', type: 'text', required: true },
    ],
  },
  {
    code: 'SE',
    name: 'Surat Edaran',
    category: 'internal',
    description: 'Pemberitahuan atau kebijakan untuk seluruh pegawai klinik.',
    bodyHtml:
      title('SURAT EDARAN') +
      '<p style="text-align:center">TENTANG</p>' +
      '<p style="text-align:center"><b>{{perihal}}</b></p>' +
      BLANK +
      '<p>Kepada Yth.</p><p>{{tujuan}}</p><p>di {{tempat_tujuan}}</p>' +
      BLANK +
      para('{{isi_edaran}}') +
      para('Demikian surat edaran ini disampaikan untuk diketahui dan dilaksanakan sebagaimana mestinya.', { spaceBefore: true }) +
      BLANK +
      SIGNATURE,
    closingHtml: '<p>{{tembusan}}</p>',
    signature: { ...KEPALA_KANAN, showPlaceDate: true },
    variables: [
      { ...TEMPAT_TUJUAN, default: 'Lingkungan Klinik Utama Dr. H. A. Rotinsulu Cianjur' },
      { key: 'isi_edaran', label: 'Isi edaran', type: 'textarea', required: true },
      TEMBUSAN,
    ],
  },
  {
    code: 'BA',
    name: 'Berita Acara Serah Terima',
    category: 'internal',
    description: 'Serah terima barang, dokumen, atau pekerjaan antara dua pihak, diketahui pimpinan.',
    bodyHtml:
      title('BERITA ACARA SERAH TERIMA') +
      para(
        'Pada hari ini {{tanggal_kegiatan_hari}}, tanggal {{tanggal_kegiatan}}, bertempat di {{klinik_nama}}, kami yang bertanda tangan di bawah ini:'
      ) +
      row('1. Nama', '<b>{{pihak_pertama_nama}}</b>', { indent: 0, tab: 3.5 }) +
      row('    Jabatan', '{{pihak_pertama_jabatan}}', { indent: 0, tab: 3.5 }) +
      para('selanjutnya disebut <b>PIHAK PERTAMA</b>.', { indentFirst: false }) +
      row('2. Nama', '<b>{{pihak_kedua_nama}}</b>', { indent: 0, tab: 3.5 }) +
      row('    Jabatan', '{{pihak_kedua_jabatan}}', { indent: 0, tab: 3.5 }) +
      para('selanjutnya disebut <b>PIHAK KEDUA</b>.', { indentFirst: false }) +
      para('PIHAK PERTAMA menyerahkan kepada PIHAK KEDUA, dan PIHAK KEDUA menerima dari PIHAK PERTAMA, {{objek_serah_terima}} dengan rincian sebagai berikut:', {
        spaceBefore: true,
      }) +
      '<p>{{daftar_barang}}</p>' +
      para('Demikian berita acara ini dibuat dalam rangkap dua untuk dipergunakan sebagaimana mestinya.', { spaceBefore: true }) +
      BLANK +
      SIGNATURE,
    signature: {
      layout: 'bertingkat',
      showPlaceDate: false,
      slots: [
        { label: 'PIHAK KEDUA,', showId: true },
        { label: 'PIHAK PERTAMA,', showId: true },
        { prefix: 'Mengetahui,', label: 'Kepala Klinik,', signerPosition: 'Kepala Klinik Utama Dr. H. A. Rotinsulu Cianjur', showId: true },
      ],
    },
    variables: [
      { key: 'tanggal_kegiatan', label: 'Tanggal serah terima', type: 'date', required: true },
      { key: 'pihak_pertama_nama', label: 'Pihak pertama — nama', type: 'text', required: true },
      { key: 'pihak_pertama_jabatan', label: 'Pihak pertama — jabatan', type: 'text' },
      { key: 'pihak_kedua_nama', label: 'Pihak kedua — nama', type: 'text', required: true },
      { key: 'pihak_kedua_jabatan', label: 'Pihak kedua — jabatan', type: 'text' },
      { key: 'objek_serah_terima', label: 'Yang diserahterimakan', type: 'text', default: 'barang' },
      { key: 'daftar_barang', label: 'Rincian', type: 'tabel', columns: ['Nama Barang', 'Jumlah', 'Satuan', 'Kondisi'] },
    ],
  },
  {
    code: 'UND',
    name: 'Surat Undangan',
    category: 'internal',
    description: 'Undangan rapat, sosialisasi, atau kegiatan klinik.',
    bodyHtml:
      OFFICIAL_HEADER +
      '<p>Dengan hormat,</p>' +
      para('{{pembuka}}, kami mengharapkan kehadiran Bapak/Ibu pada:') +
      row('Hari, tanggal', '{{tanggal_acara_hari}}, {{tanggal_acara}}', { indent: 2.5, tab: 6 }) +
      row('Waktu', '{{waktu}}', { indent: 2.5, tab: 6 }) +
      row('Tempat', '{{tempat}}', { indent: 2.5, tab: 6 }) +
      row('Acara', '<b>{{acara}}</b>', { indent: 2.5, tab: 6 }) +
      para('Mengingat pentingnya acara tersebut, kami mohon Bapak/Ibu dapat hadir tepat waktu. Atas perhatian dan kehadirannya, kami ucapkan terima kasih.', {
        spaceBefore: true,
      }) +
      BLANK +
      SIGNATURE,
    closingHtml: '<p>{{tembusan}}</p>',
    signature: KEPALA_KANAN,
    variables: [
      SIFAT,
      LAMPIRAN,
      TEMPAT_TUJUAN,
      { key: 'pembuka', label: 'Kalimat pembuka', type: 'text', default: 'Dalam rangka evaluasi pelayanan klinik' },
      { key: 'tanggal_acara', label: 'Tanggal acara', type: 'date', required: true },
      { key: 'waktu', label: 'Waktu', type: 'text', default: '09.00 WIB s.d. selesai' },
      { key: 'tempat', label: 'Tempat', type: 'text', default: 'Ruang Rapat Klinik' },
      { key: 'acara', label: 'Acara', type: 'text', required: true },
      TEMBUSAN,
    ],
  },
  {
    code: 'ND',
    name: 'Nota Dinas',
    category: 'internal',
    description: 'Komunikasi kedinasan antarunit atau dari unit kepada pimpinan.',
    bodyHtml:
      title('NOTA DINAS', false) +
      row('Kepada', 'Yth. {{tujuan}}', { indent: 0, tab: 3 }) +
      row('Dari', '{{ttd_1_jabatan}}', { indent: 0, tab: 3 }) +
      row('Tanggal', '{{tanggal_surat}}', { indent: 0, tab: 3 }) +
      row('Nomor', '{{nomor_surat}}', { indent: 0, tab: 3 }) +
      row('Sifat', '{{sifat}}', { indent: 0, tab: 3 }) +
      row('Lampiran', '{{lampiran}}', { indent: 0, tab: 3 }) +
      row('Hal', '<b>{{perihal}}</b>', { indent: 0, tab: 3 }) +
      '<hr>' +
      para('{{isi}}') +
      para('Demikian disampaikan, atas perhatiannya diucapkan terima kasih.', { spaceBefore: true }) +
      BLANK +
      SIGNATURE,
    closingHtml: '<p>{{tembusan}}</p>',
    signature: { layout: 'kanan', showPlaceDate: false, slots: [{ label: '', signerPosition: 'Penanggung Jawab Administrasi', showId: true }] },
    variables: [SIFAT, LAMPIRAN, { key: 'isi', label: 'Isi nota dinas', type: 'textarea', required: true }, TEMBUSAN],
  },
  {
    code: 'SK',
    name: 'Surat Keputusan',
    category: 'internal',
    description: 'Keputusan Kepala Klinik: penetapan tim, kebijakan, atau pengangkatan.',
    bodyHtml:
      '<p style="text-align:center"><b>KEPUTUSAN KEPALA {{klinik_nama_kapital}}</b></p>' +
      '<p style="text-align:center">NOMOR {{nomor_surat}}</p>' +
      BLANK +
      '<p style="text-align:center">TENTANG</p>' +
      '<p style="text-align:center"><b>{{perihal}}</b></p>' +
      BLANK +
      '<p style="text-align:center"><b>KEPALA {{klinik_nama_kapital}},</b></p>' +
      BLANK +
      `<p data-tabs="l:3">Menimbang${TAB}:</p>` +
      '<p>{{menimbang}}</p>' +
      `<p data-tabs="l:3" style="margin-top:6pt">Mengingat${TAB}:</p>` +
      '<p>{{mengingat}}</p>' +
      BLANK +
      '<p style="text-align:center"><b>MEMUTUSKAN:</b></p>' +
      BLANK +
      `<p data-tabs="l:3" style="margin-left:3.3cm;text-indent:-3.3cm">Menetapkan${TAB}: <b>KEPUTUSAN KEPALA {{klinik_nama_kapital}} TENTANG {{perihal}}.</b></p>` +
      '<p>{{diktum}}</p>' +
      BLANK +
      `<p data-tabs="l:2.75" style="margin-left:9cm">Ditetapkan di${TAB}: {{klinik_kota}}</p>` +
      `<p data-tabs="l:2.75" style="margin-left:9cm">pada tanggal${TAB}: {{tanggal_surat}}</p>` +
      BLANK +
      SIGNATURE,
    signature: { layout: 'kanan', showPlaceDate: false, slots: [{ label: 'KEPALA KLINIK,', signerPosition: 'Kepala Klinik Utama Dr. H. A. Rotinsulu Cianjur', showId: true }] },
    variables: [
      { key: 'menimbang', label: 'Menimbang', type: 'list', listStyle: 'lower-alpha', required: true, hint: 'Satu pertimbangan per baris; otomatis diberi huruf a, b, c.' },
      { key: 'mengingat', label: 'Mengingat', type: 'list', listStyle: 'decimal', required: true, hint: 'Satu dasar hukum per baris.' },
      {
        key: 'diktum',
        label: 'Diktum (KESATU, KEDUA, ...)',
        type: 'list',
        listStyle: 'none',
        required: true,
        hint: 'Satu diktum per baris, mis. "KESATU: Membentuk Tim ..."',
      },
    ],
  },

  // ===================== FORMULIR (diisi/ditandatangani pasien) =====================
  ...SEED_FORM_TEMPLATES,
];
