/** @type {import('next').NextConfig} */
// Port backend ditentukan oleh runner (dev: 4001, produksi: 4000)
const backendPort = process.env.BACKEND_PORT || '4000';

const nextConfig = {
  reactStrictMode: true,
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  // Mode dev memakai folder build sendiri (.next-dev) agar build production tidak ditimpa
  distDir: process.env.NEXT_DIST_DIR || '.next',
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `http://127.0.0.1:${backendPort}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
