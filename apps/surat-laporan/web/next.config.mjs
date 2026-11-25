/** @type {import('next').NextConfig} */
// Port backend ditentukan oleh runner (produksi 4002, dev 4003).
const backendPort = process.env.BACKEND_PORT || '4002';

const nextConfig = {
  reactStrictMode: true,
  eslint: { ignoreDuringBuilds: true },
  // Mode dev memakai folder build sendiri (.next-dev) agar build production tidak ditimpa.
  distDir: process.env.NEXT_DIST_DIR || '.next',
  async rewrites() {
    // Route milik Next sendiri (/api/sso/redeem, /api/portal-info) didahulukan;
    // sisanya diteruskan ke backend sistem surat.
    return [{ source: '/api/:path*', destination: `http://127.0.0.1:${backendPort}/api/:path*` }];
  },
};

export default nextConfig;
