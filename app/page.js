'use client';

import Image from 'next/image';
import { useEffect, useState } from 'react';

const demoProducts = [
  {
    id: 1,
    nombre: 'Termociclador EQ-BM 68',
    imagen: '/productos/termociclador-eq-bm-68-ref.png',
    descripcion: 'Equipo demo con imagen derivada del informe técnico entregado por CMCing.',
  },
  {
    id: 2,
    nombre: 'Gabinete A2 EQ-MO-86',
    imagen: '/productos/gabinete-a2-eq-mo-86-ref.jpg',
    descripcion: 'Equipo demo con imagen derivada del informe técnico entregado por CMCing.',
  },
];

export default function Dashboard() {
  const [stats, setStats] = useState({ clientes: 0, equipos: 0, visitas: 0 });

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await fetch('/api/dashboard');
        const data = await res.json();
        setStats(data);
      } catch (error) {
        console.error('Error fetching stats:', error);
      }
    };

    fetchStats();
  }, []);

  return (
    <div className="min-h-screen p-6 md:p-8">
      <div className="mx-auto max-w-7xl">
        <header className="panel mb-6 p-6 md:p-7">
          <p className="text-[0.85rem] uppercase tracking-[0.18em] text-neutral-500">Modo demo</p>
          <h1 className="mt-1 text-[1.75rem] font-semibold text-neutral-900">Demo Comercial CMCing</h1>
          <p className="mt-2 max-w-4xl text-[0.95rem] text-neutral-600">
            Esta instancia está desconectada de base de datos productiva y funciona con datos demo en memoria. Se puede editar maestros, crear visitas, emitir PDFs y enviar correos HTML con adjuntos.
          </p>
        </header>

        <section className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="panel p-5">
            <h2 className="text-[0.95rem] font-medium text-sky-700">Clientes</h2>
            <p className="mt-2 text-[2rem] font-semibold leading-none text-neutral-900">{stats.clientes}</p>
          </div>
          <div className="panel p-5">
            <h2 className="text-[0.95rem] font-medium text-emerald-700">Equipos / Productos</h2>
            <p className="mt-2 text-[2rem] font-semibold leading-none text-neutral-900">{stats.equipos}</p>
          </div>
          <div className="panel p-5">
            <h2 className="text-[0.95rem] font-medium text-amber-700">Visitas / Servicios</h2>
            <p className="mt-2 text-[2rem] font-semibold leading-none text-neutral-900">{stats.visitas}</p>
          </div>
        </section>

        <section className="panel mb-6 p-6">
          <h2 className="mb-4 text-[1.15rem] font-semibold text-neutral-900">Productos en Demo</h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {demoProducts.map((item) => (
              <article key={item.id} className="rounded-xl border border-neutral-200 bg-neutral-50 p-4">
                <div className="mb-3 overflow-hidden rounded-lg border border-neutral-200 bg-white">
                  <Image src={item.imagen} alt={item.nombre} width={640} height={360} className="h-56 w-full object-contain" />
                </div>
                <h3 className="text-[1rem] font-semibold text-neutral-900">{item.nombre}</h3>
                <p className="mt-1 text-[0.88rem] text-neutral-600">{item.descripcion}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="panel p-6">
          <h2 className="mb-4 text-[1.15rem] font-semibold text-neutral-900">Acciones de Demo</h2>
          <div className="flex flex-wrap gap-3">
            <a href="/admin" className="rounded-xl bg-neutral-900 px-4 py-2 text-[0.9rem] font-medium text-white transition hover:bg-neutral-700">Backoffice</a>
            <a href="/nueva-visita" className="rounded-xl bg-sky-700 px-4 py-2 text-[0.9rem] font-medium text-white transition hover:bg-sky-600">Nueva Visita</a>
            <a href="/informes/visitas" className="rounded-xl bg-emerald-700 px-4 py-2 text-[0.9rem] font-medium text-white transition hover:bg-emerald-600">Informe de Visitas</a>
            <a href="/informes/facturacion" className="rounded-xl bg-amber-600 px-4 py-2 text-[0.9rem] font-medium text-white transition hover:bg-amber-500">Informe de Facturación</a>
          </div>
        </section>
      </div>
    </div>
  );
}
