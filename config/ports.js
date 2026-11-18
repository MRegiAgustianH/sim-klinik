// config/ports.js — satu-satunya daftar port seluruh aplikasi klinik.
//
// Dibaca runner.js. Aplikasi tidak membaca file ini langsung; runner meneruskan
// port lewat variabel lingkungan saat menyalakan setiap proses.
//
// Mode development berjalan berdampingan dengan production yang sedang
// melayani pasien, jadi setiap port dev harus berbeda dari port production.
// Pola: frontend 80xx, backend 40xx.

module.exports = {
  prod: {
    identity: 4010,
    simklinikApi: 4000,
    simklinikWeb: 8080,
    portal: 8082,
  },
  dev: {
    identity: 4011,
    simklinikApi: 4001,
    simklinikWeb: 8081,
    portal: 8083,
  },
  // Dicadangkan untuk aplikasi berikutnya agar tidak bentrok.
  reserved: {
    suratLaporanWeb: { prod: 8084, dev: 8085 },
    suratLaporanApi: { prod: 4002, dev: 4003 },
  },
};
