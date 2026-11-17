import type { Metadata } from 'next';
import './globals.css';
import { AuthProvider } from '@/lib/auth-context';
import { ToastProvider } from '@/components/Toast';

export const metadata: Metadata = {
  title: 'Portal SIMKlinik - Klinik Utama Dr. H. A. Rotinsulu Cianjur',
  description:
    'Pintu masuk terpadu seluruh aplikasi klinik: SIMKlinik, sistem surat & laporan, dan modul berikutnya.',
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
          <ToastProvider>{children}</ToastProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
