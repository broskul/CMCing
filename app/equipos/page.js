'use client';

import Image from 'next/image';
import { useEffect, useMemo, useState } from 'react';

function formatDate(value) {
  if (!value) return '-';
  return new Date(value).toLocaleDateString('es-CL', { dateStyle: 'medium' });
}

export default function EquiposPage() {
  const [equipos, setEquipos] = useState([]);
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState(null);

  useEffect(() => {
    fetch('/api/equipos')
      .then((res) => res.json())
      .then((data) => {
        const list = Array.isArray(data) ? data : [];
        setEquipos(list);
        setSelectedId(list[0]?.id || null);
      })
      .catch((error) => console.error('Error cargando equipos:', error));
  }, []);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return equipos;

    return equipos.filter((equipo) => [
      equipo.sku,
      equipo.codigoInterno,
      equipo.serial,
      equipo.nombre,
      equipo.modelo,
      equipo.cliente?.nombre,
    ].some((value) => String(value || '').toLowerCase().includes(needle)));
  }, [equipos, query]);

  const selected = equipos.find((equipo) => equipo.id === selectedId) || filtered[0] || null;

  return (
    <div className="min-h-screen p-6 md:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="panel p-6">
          <p className="text-[0.82rem] uppercase tracking-[0.16em] text-neutral-500">Activos</p>
          <h1 className="mt-1 text-[1.6rem] font-semibold text-neutral-900">Equipos</h1>
        </header>

        <section className="grid gap-6 lg:grid-cols-[420px_1fr]">
          <aside className="panel h-fit p-5">
            <label className="block text-[0.86rem] font-medium text-neutral-700">
              Buscar
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className="input-base mt-1"
                placeholder="SKU, serial o nombre"
              />
            </label>
            <div className="mt-4 max-h-[620px] space-y-2 overflow-y-auto pr-1">
              {filtered.map((equipo) => (
                <button
                  key={equipo.id}
                  type="button"
                  onClick={() => setSelectedId(equipo.id)}
                  className={`w-full rounded-lg border px-3 py-3 text-left transition ${selected?.id === equipo.id ? 'border-neutral-900 bg-neutral-900 text-white' : 'border-neutral-200 bg-white text-neutral-800 hover:bg-neutral-50'}`}
                >
                  <span className="block text-[0.92rem] font-semibold">{equipo.nombre}</span>
                  <span className="mt-1 block text-[0.78rem] opacity-80">{equipo.sku || equipo.codigoInterno || '-'} | {equipo.serial}</span>
                </button>
              ))}
            </div>
          </aside>

          {selected ? (
            <section className="space-y-6">
              <article className="panel p-5">
                <div className="grid gap-5 md:grid-cols-[1fr_240px]">
                  <div>
                    <p className="text-[0.82rem] uppercase tracking-[0.16em] text-neutral-500">{selected.sku || selected.codigoInterno || 'Equipo'}</p>
                    <h2 className="mt-1 text-[1.4rem] font-semibold text-neutral-900">{selected.nombre}</h2>
                    <dl className="mt-4 grid grid-cols-1 gap-3 text-[0.9rem] md:grid-cols-2">
                      <div><dt className="font-semibold text-neutral-500">Cliente</dt><dd>{selected.cliente?.nombre || '-'}</dd></div>
                      <div><dt className="font-semibold text-neutral-500">Serial</dt><dd>{selected.serial || '-'}</dd></div>
                      <div><dt className="font-semibold text-neutral-500">Modelo</dt><dd>{selected.modelo || '-'}</dd></div>
                      <div><dt className="font-semibold text-neutral-500">Fabricante</dt><dd>{selected.fabricante || '-'}</dd></div>
                      <div><dt className="font-semibold text-neutral-500">Ubicación</dt><dd>{selected.ubicacion || '-'}</dd></div>
                      <div><dt className="font-semibold text-neutral-500">Estado</dt><dd>{selected.estadoOperativo || '-'}</dd></div>
                    </dl>
                  </div>
                  <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-3">
                    {selected.imagenUrl ? (
                      <Image src={selected.imagenUrl} alt={selected.nombre} width={360} height={260} className="h-56 w-full object-contain" priority />
                    ) : (
                      <div className="flex h-56 items-center justify-center text-[0.9rem] text-neutral-500">Sin imagen</div>
                    )}
                  </div>
                </div>
              </article>

              <article className="panel p-5">
                <h2 className="mb-4 text-[1.05rem] font-semibold text-neutral-900">Hoja de vida</h2>
                <div className="space-y-3">
                  {(selected.hojaVida || []).length ? selected.hojaVida.map((evento) => (
                    <div key={`${evento.id}-${evento.fechaEvento}`} className="rounded-lg border border-neutral-200 bg-white p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <h3 className="text-[0.98rem] font-semibold text-neutral-900">{evento.titulo}</h3>
                        <span className="text-[0.8rem] font-medium text-neutral-500">{formatDate(evento.fechaEvento)}</span>
                      </div>
                      <p className="mt-2 text-[0.9rem] text-neutral-700">{evento.detalle || '-'}</p>
                      <p className="mt-2 text-[0.82rem] text-neutral-500">{evento.tecnico} | {evento.estado}</p>
                    </div>
                  )) : (
                    <p className="text-[0.9rem] text-neutral-500">Sin eventos registrados.</p>
                  )}
                </div>
              </article>
            </section>
          ) : (
            <section className="panel flex min-h-[320px] items-center justify-center p-6 text-neutral-500">Sin equipos</section>
          )}
        </section>
      </div>
    </div>
  );
}
