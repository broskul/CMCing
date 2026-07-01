'use client';

import { useEffect, useMemo, useState } from 'react';

const estadoClasses = {
  pendiente: 'bg-amber-100 text-amber-800',
  en_progreso: 'bg-sky-100 text-sky-800',
  completada: 'bg-emerald-100 text-emerald-800',
  cancelada: 'bg-rose-100 text-rose-800',
};

function startOfDay(date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function formatDay(value) {
  return new Intl.DateTimeFormat('es-CL', { weekday: 'long', day: '2-digit', month: 'long' }).format(value);
}

export default function CalendarioPage() {
  const [visitas, setVisitas] = useState([]);

  useEffect(() => {
    fetch('/api/visitas')
      .then((res) => res.json())
      .then((data) => setVisitas(Array.isArray(data) ? data : []))
      .catch((error) => console.error('Error cargando calendario:', error));
  }, []);

  const grouped = useMemo(() => {
    return visitas
      .slice()
      .sort((a, b) => new Date(a.fecha) - new Date(b.fecha))
      .reduce((acc, visita) => {
        const key = startOfDay(new Date(visita.fecha)).toISOString();
        if (!acc[key]) acc[key] = [];
        acc[key].push(visita);
        return acc;
      }, {});
  }, [visitas]);

  return (
    <div className="min-h-screen p-6 md:p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="panel p-6">
          <p className="text-[0.82rem] uppercase tracking-[0.16em] text-neutral-500">Servicio</p>
          <h1 className="mt-1 text-[1.6rem] font-semibold text-neutral-900">Calendario</h1>
        </header>

        <section className="space-y-4">
          {Object.entries(grouped).map(([day, items]) => (
            <article key={day} className="panel p-5">
              <h2 className="mb-3 text-[1.05rem] font-semibold capitalize text-neutral-900">{formatDay(new Date(day))}</h2>
              <div className="space-y-3">
                {items.map((visita) => (
                  <div key={visita.id} className="grid gap-3 rounded-lg border border-neutral-200 bg-white p-4 md:grid-cols-[120px_1fr_auto]">
                    <div className="text-[0.9rem] font-semibold text-neutral-900">{new Date(visita.fecha).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}</div>
                    <div>
                      <p className="font-semibold text-neutral-900">{visita.cliente?.nombre || '-'}</p>
                      <p className="mt-1 text-[0.88rem] text-neutral-600">{visita.servicio?.descripcion || '-'} | {visita.tecnico?.nombre || '-'}</p>
                    </div>
                    <span className={`h-fit rounded-full px-2 py-1 text-[0.78rem] font-semibold ${estadoClasses[visita.estado] || 'bg-neutral-100 text-neutral-700'}`}>
                      {visita.estado}
                    </span>
                  </div>
                ))}
              </div>
            </article>
          ))}
        </section>
      </div>
    </div>
  );
}
