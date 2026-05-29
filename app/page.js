'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

const quickActions = [
  { href: '/admin?modulo=clientes', label: 'Clientes' },
  { href: '/cotizaciones', label: 'Cotizaciones' },
  { href: '/equipos', label: 'Equipos' },
  { href: '/nueva-visita', label: 'Nueva visita' },
  { href: '/tecnico', label: 'App técnico' },
];

export default function Dashboard() {
  const [stats, setStats] = useState({ clientes: 0, equipos: 0, visitas: 0, cotizaciones: 0, tecnicos: 0 });

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
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="panel p-6 md:p-7">
          <p className="text-[0.82rem] uppercase tracking-[0.16em] text-neutral-500">Operación</p>
          <h1 className="mt-1 text-[1.75rem] font-semibold text-neutral-900">Gestión CMCing</h1>
        </header>

        <section className="grid grid-cols-1 gap-4 md:grid-cols-5">
          <div className="panel p-5">
            <h2 className="text-[0.9rem] font-medium text-sky-700">Clientes</h2>
            <p className="mt-2 text-[2rem] font-semibold leading-none text-neutral-900">{stats.clientes}</p>
          </div>
          <div className="panel p-5">
            <h2 className="text-[0.9rem] font-medium text-emerald-700">Equipos</h2>
            <p className="mt-2 text-[2rem] font-semibold leading-none text-neutral-900">{stats.equipos}</p>
          </div>
          <div className="panel p-5">
            <h2 className="text-[0.9rem] font-medium text-amber-700">Visitas</h2>
            <p className="mt-2 text-[2rem] font-semibold leading-none text-neutral-900">{stats.visitas}</p>
          </div>
          <div className="panel p-5">
            <h2 className="text-[0.9rem] font-medium text-rose-700">Cotizaciones</h2>
            <p className="mt-2 text-[2rem] font-semibold leading-none text-neutral-900">{stats.cotizaciones}</p>
          </div>
          <div className="panel p-5">
            <h2 className="text-[0.9rem] font-medium text-indigo-700">Técnicos</h2>
            <p className="mt-2 text-[2rem] font-semibold leading-none text-neutral-900">{stats.tecnicos}</p>
          </div>
        </section>

        <section className="panel p-6">
          <h2 className="mb-4 text-[1.15rem] font-semibold text-neutral-900">Accesos rápidos</h2>
          <div className="flex flex-wrap gap-3">
            {quickActions.map((action) => (
              <Link key={action.href} href={action.href} className="rounded-lg bg-neutral-900 px-4 py-2 text-[0.9rem] font-medium text-white transition hover:bg-neutral-700">
                {action.label}
              </Link>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
