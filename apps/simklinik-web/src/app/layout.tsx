import type { Metadata } from 'next';
import './globals.css';
import { AuthProvider } from '@/lib/auth-context';
import { ToastProvider } from '@/components/Toast';

export const metadata: Metadata = {
  title: 'SIMKlinik - Klinik Utama Dr. H. A. Rotinsulu Cianjur',
  description: 'Sistem Informasi Manajemen Pelayanan Klinik Utama Dr. H. A. Rotinsulu Cianjur (Vaksinasi, Buku ICV, MCU & Layanan Medis)',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id">
      <body className="bg-slate-50 text-slate-900">
        <AuthProvider>
          <ToastProvider>
            {children}
          </ToastProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
