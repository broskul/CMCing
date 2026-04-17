import { Montserrat } from 'next/font/google';
import Image from 'next/image';
import Link from 'next/link';
import './globals.css';

const montserrat = Montserrat({
  variable: '--font-montserrat',
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
});

export const metadata = {
  title: 'CMCiing - Gestión de Servicios Médicos',
  description: 'Aplicación para gestionar visitas y servicios técnicos de equipos médicos',
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body className={`${montserrat.variable} app-shell antialiased`}>
        <nav className="sticky top-0 z-20 border-b border-neutral-200 bg-white/90 backdrop-blur-sm">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="flex min-h-16 flex-wrap items-center justify-between gap-3 py-2">
              <Link href="/" className="flex items-center rounded-lg border border-neutral-200 bg-white px-2 py-1">
                <Image
                  src="/brand/logo-cmcing.png"
                  alt="CMCiing"
                  width={200}
                  height={64}
                  className="h-9 w-auto object-contain"
                  priority
                />
              </Link>
              <div className="flex flex-wrap items-center gap-3 text-[0.9rem] font-medium text-neutral-600">
                <Link href="/" className="transition hover:text-neutral-900">Dashboard</Link>
                <Link href="/admin" className="transition hover:text-neutral-900">Backoffice</Link>
                <Link href="/nueva-visita" className="transition hover:text-neutral-900">Nueva Visita</Link>
                <Link href="/informes/visitas" className="transition hover:text-neutral-900">Informe Visitas</Link>
                <Link href="/informes/facturacion" className="transition hover:text-neutral-900">Informe Facturación</Link>
              </div>
            </div>
          </div>
        </nav>
        {children}
      </body>
    </html>
  );
}
