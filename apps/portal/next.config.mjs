/** @type {import('next').NextConfig} */
// Port layanan identitas tidak lagi dibaca di sini.
//
// Nilai yang ditulis di next.config.mjs ikut ter-compile saat `next build`,
// jadi port yang dipakai saat build akan terpaku di hasil build. Akibatnya
// build production tidak bisa dipakai untuk mode development (port berbeda) —
// permintaan /api/* akan diarahkan ke port yang salah dan gagal 500.
//
// Karena itu penerusan /api/* dilakukan app/api/[...path]/route.ts yang membaca
// port saat permintaan datang (lihat berkas itu).

const nextConfig = {
  reactStrictMode: true,
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  // Mode dev memakai folder build sendiri (.next-dev) agar build production
  // tidak tertimpa — pola yang sama dengan client/ SIMKlinik.
  distDir: process.env.NEXT_DIST_DIR || '.next',
};

export default nextConfig;
