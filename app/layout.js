import { Montserrat } from 'next/font/google';
import AppShell from './components/AppShell';
import './globals.css';
import OfflineRegister from './offline-register';

const montserrat = Montserrat({
  variable: '--font-montserrat',
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
});

export const metadata = {
  title: {
    default: 'CMCing 360 · Servicio técnico',
    template: '%s · CMCing 360',
  },
  description: 'Órdenes de trabajo, actividades, cumplimiento e informes de servicio técnico',
  applicationName: 'CMCing 360',
  manifest: '/manifest.webmanifest',
  robots: { index: false, follow: false },
};

export const viewport = {
  themeColor: '#0f2237',
  colorScheme: 'light',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body className={`${montserrat.variable} app-shell antialiased`}>
        <AppShell>{children}</AppShell>
        <OfflineRegister />
      </body>
    </html>
  );
}
