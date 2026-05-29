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
  title: 'CMCiing - Gestión de Servicios Médicos',
  description: 'Aplicación para gestionar visitas y servicios técnicos de equipos médicos',
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
