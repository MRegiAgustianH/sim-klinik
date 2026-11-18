import type { Config } from "tailwindcss";

// Palet merek SIMKlinik. Warna dasar #01B9AD.
// 600 = warna utama (tombol, menu aktif), 700+ dipakai untuk teks agar kontras
// di atas latar putih tetap terbaca.
const BRAND = {
  50: '#E7FBFA',
  100: '#C3F5F2',
  200: '#8CEBE6',
  300: '#4FDED7',
  400: '#19CCC2',
  500: '#01B9AD',
  600: '#01B9AD',
  700: '#01857C',
  800: '#016A63',
  900: '#01534E',
  950: '#00322F',
};

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Seluruh kelas teal-* di aplikasi kini memakai warna merek.
        teal: BRAND,
        hospital: BRAND,
      },
    },
  },
  plugins: [],
};
export default config;
