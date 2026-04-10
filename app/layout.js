import { Montserrat } from "next/font/google";
import "./globals.css";

const montserrat = Montserrat({
  variable: "--font-montserrat",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata = {
  title: "CMCiing - Gestión de Servicios Médicos",
  description: "Aplicación para gestionar visitas y servicios técnicos de equipos médicos",
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body className={`${montserrat.variable} app-shell antialiased`}>
        <nav className="sticky top-0 z-20 border-b border-neutral-200 bg-white/90 backdrop-blur-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between h-16">
              <div className="flex">
                <div className="shrink-0 flex items-center">
                  <a href="/" className="text-lg font-semibold text-neutral-900">CMCiing Demo</a>
                </div>
                <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
                  <a href="/" className="inline-flex items-center border-b-2 border-transparent px-1 pt-1 text-[0.95rem] font-medium text-neutral-600 transition hover:border-neutral-300 hover:text-neutral-900">Dashboard</a>
                  <a href="/admin" className="inline-flex items-center border-b-2 border-transparent px-1 pt-1 text-[0.95rem] font-medium text-neutral-600 transition hover:border-neutral-300 hover:text-neutral-900">Backoffice</a>
                  <a href="/nueva-visita" className="inline-flex items-center border-b-2 border-transparent px-1 pt-1 text-[0.95rem] font-medium text-neutral-600 transition hover:border-neutral-300 hover:text-neutral-900">Nueva Visita</a>
                  <a href="/informes/visitas" className="inline-flex items-center border-b-2 border-transparent px-1 pt-1 text-[0.95rem] font-medium text-neutral-600 transition hover:border-neutral-300 hover:text-neutral-900">Informe Visitas</a>
                  <a href="/informes/facturacion" className="inline-flex items-center border-b-2 border-transparent px-1 pt-1 text-[0.95rem] font-medium text-neutral-600 transition hover:border-neutral-300 hover:text-neutral-900">Informe Facturación</a>
                </div>
              </div>
            </div>
          </div>
        </nav>
        {children}
      </body>
    </html>
  );
}
