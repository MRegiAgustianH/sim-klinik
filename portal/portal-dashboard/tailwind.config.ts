import type { Config } from "tailwindcss";

// Palet merek portal. Portal sengaja memakai biru tua, bukan teal milik
// SIMKlinik, agar staf selalu tahu sedang berada di pintu masuk portal
// dan bukan di dalam aplikasi pelayanan.
const PORTAL = {
  50: '#EFF6FF',
  100: '#DBEAFE',
  200: '#BFDBFE',
  300: '#93C5FD',
  400: '#60A5FA',
  500: '#3B82F6',
  600: '#2563EB',
  700: '#1D4ED8',
  800: '#1E40AF',
  900: '#1E3A8A',
  950: '#172554',
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
        portal: PORTAL,
        // Warna merek klinik dipakai untuk elemen identitas (logo, aksen),
        // sama persis dengan client/ agar dua aplikasi terbaca satu keluarga.
        brand: {
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
        },
      },
    },
  },
  plugins: [],
};
export default config;
