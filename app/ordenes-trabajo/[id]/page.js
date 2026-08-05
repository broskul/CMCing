'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { ComboBox, MultiComboBox } from '../../components/ComboBox';
import { requestJson } from '../../lib/client-api';

function matrixLabel(matrix) {
  return `${matrix.nombre} · ${matrix.categoria === 'evaluacion' ? 'Evaluación' : 'Informe / resultado'}`;
}

function emptyActivity() {
  return { actividadId: '', tecnicoId: '', titulo: '', descripcionBreve: '', fechaProgramada: '', matrizIds: [] };
}

function formatDate(value) {
  if (!value) return '-';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '-' : new Intl.DateTimeFormat('es-CL', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

export default function WorkOrderDetailPage() {
  const params = useParams();
  const id = params.id;
  const [order, setOrder] = useState(null);
  const [catalogs, setCatalogs] = useState({ tecnicos: [], tiposActividad: [], matrices: [] });
  const [activity, setActivity] = useState(emptyActivity);
  const [adding, setAdding] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [orderRow, catalogRows] = await Promise.all([
        requestJson(`/api/ordenes-trabajo/${id}`),
        requestJson('/api/service-work/catalogs'),
      ]);
      setOrder(orderRow);
      setCatalogs(catalogRows);
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const handleType = (typeId, option) => {
    setActivity((current) => ({
      ...current,
      actividadId: typeId,
      titulo: current.titulo || option?.nombre || '',
      matrizIds: (option?.matrizIdsDefault || []).map(String),
    }));
  };

  const submitActivity = async (event) => {
    event.preventDefault();
    setAdding(true);
    setError('');
    try {
      await requestJson(`/api/ordenes-trabajo/${id}/actividades`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(activity),
      });
      setActivity(emptyActivity());
      setShowAdd(false);
      await load();
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setAdding(false);
    }
  };

  if (loading) return <div className="min-h-screen p-6"><div className="panel mx-auto max-w-6xl p-8 text-center text-neutral-500">Cargando OT...</div></div>;

  return (
    <div className="min-h-screen p-4 md:p-7">
      <div className="mx-auto max-w-7xl space-y-5">
        <Link href="/ordenes-trabajo" className="inline-flex text-[0.82rem] font-medium text-sky-700 hover:text-sky-900">← Volver a órdenes de trabajo</Link>
        {error && <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-[0.86rem] text-rose-800">{error}</div>}

        {order && (
          <>
            <header className="panel p-5 md:p-6">
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-[0.8rem] font-semibold text-sky-700">{order.codigo || `OT #${order.id}`}</span>
                    <span className={`rounded-full px-2.5 py-1 text-[0.73rem] font-medium ${order.estado === 'cerrada' ? 'bg-emerald-100 text-emerald-800' : 'bg-sky-100 text-sky-800'}`}>{order.estado}</span>
                    <span className="rounded-full bg-neutral-100 px-2.5 py-1 text-[0.73rem] font-medium capitalize text-neutral-700">Criticidad {order.criticidad || order.prioridad}</span>
                  </div>
                  <h1 className="mt-2 text-[1.65rem] font-semibold text-neutral-950">{order.titulo}</h1>
                  <p className="mt-2 max-w-3xl text-[0.86rem] text-neutral-600">{order.descripcion || 'Sin descripción general.'}</p>
                </div>
                {order.estado === 'abierta' && <button type="button" onClick={() => setShowAdd((value) => !value)} className="primary-action">{showAdd ? 'Cerrar' : 'Agregar actividad'}</button>}
              </div>
              <dl className="mt-5 grid gap-3 border-t border-neutral-200 pt-4 sm:grid-cols-2 lg:grid-cols-4">
                <div><dt className="text-[0.7rem] uppercase tracking-wide text-neutral-500">Cliente</dt><dd className="mt-1 text-[0.85rem] font-medium text-neutral-900">{order.cliente?.nombre || '-'}</dd></div>
                <div><dt className="text-[0.7rem] uppercase tracking-wide text-neutral-500">Equipo</dt><dd className="mt-1 text-[0.85rem] font-medium text-neutral-900">{order.equipo?.nombre || 'Sin equipo asociado'}</dd></div>
                <div><dt className="text-[0.7rem] uppercase tracking-wide text-neutral-500">Programación</dt><dd className="mt-1 text-[0.85rem] font-medium text-neutral-900">{formatDate(order.fechaProgramada)}</dd></div>
                <div><dt className="text-[0.7rem] uppercase tracking-wide text-neutral-500">Actividades</dt><dd className="mt-1 text-[0.85rem] font-medium text-neutral-900">{order.resumen.total} total · {order.resumen.abiertas} abiertas</dd></div>
              </dl>
            </header>

            {showAdd && order.estado === 'abierta' && (
              <form onSubmit={submitActivity} className="panel space-y-4 p-5 md:p-6">
                <div>
                  <h2 className="text-[1rem] font-semibold text-neutral-900">Nueva actividad</h2>
                  <p className="text-[0.78rem] text-neutral-500">Se asignará a un técnico y heredará las matrices por defecto del tipo elegido.</p>
                </div>
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  <label><span className="mb-1 block text-[0.78rem] font-medium text-neutral-700">Tipo</span><ComboBox options={catalogs.tiposActividad} value={activity.actividadId} onChange={handleType} required /></label>
                  <label><span className="mb-1 block text-[0.78rem] font-medium text-neutral-700">Técnico</span><ComboBox options={catalogs.tecnicos} value={activity.tecnicoId} onChange={(value) => setActivity((current) => ({ ...current, tecnicoId: value }))} required /></label>
                  <label><span className="mb-1 block text-[0.78rem] font-medium text-neutral-700">Fecha programada</span><input type="datetime-local" className="input-base" value={activity.fechaProgramada} onChange={(event) => setActivity((current) => ({ ...current, fechaProgramada: event.target.value }))} /></label>
                  <label className="md:col-span-2"><span className="mb-1 block text-[0.78rem] font-medium text-neutral-700">Título</span><input className="input-base" value={activity.titulo} onChange={(event) => setActivity((current) => ({ ...current, titulo: event.target.value }))} required /></label>
                  <label><span className="mb-1 block text-[0.78rem] font-medium text-neutral-700">Descripción breve</span><input className="input-base" value={activity.descripcionBreve} onChange={(event) => setActivity((current) => ({ ...current, descripcionBreve: event.target.value }))} /></label>
                  <div className="md:col-span-2 xl:col-span-3"><span className="mb-1 block text-[0.78rem] font-medium text-neutral-700">Matrices</span><MultiComboBox options={catalogs.matrices} values={activity.matrizIds} onChange={(values) => setActivity((current) => ({ ...current, matrizIds: values }))} getOptionLabel={matrixLabel} /></div>
                </div>
                <div className="flex justify-end"><button type="submit" disabled={adding} className="primary-action disabled:opacity-60">{adding ? 'Agregando...' : 'Agregar actividad'}</button></div>
              </form>
            )}

            <section className="panel overflow-hidden">
              <div className="border-b border-neutral-200 px-5 py-4"><h2 className="text-[1rem] font-semibold text-neutral-900">Actividades</h2></div>
              {!order.actividades.length ? (
                <div className="p-8 text-center text-[0.86rem] text-neutral-500">Esta OT todavía no tiene actividades.</div>
              ) : (
                <div className="divide-y divide-neutral-200">
                  {order.actividades.map((item) => (
                    <article key={item.id} className="grid gap-4 p-5 md:grid-cols-[1fr_auto] md:items-center">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`rounded-full px-2.5 py-1 text-[0.72rem] font-medium ${item.estado === 'cerrada' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>{item.estado}</span>
                          {item.bloqueada && <span className="rounded-full bg-neutral-800 px-2.5 py-1 text-[0.72rem] font-medium text-white">Bloqueada</span>}
                          <span className="text-[0.74rem] text-neutral-500">{item.tipoActividad?.nombre || 'Actividad libre'}</span>
                        </div>
                        <h3 className="mt-2 text-[0.98rem] font-semibold text-neutral-900">{item.titulo}</h3>
                        <p className="mt-1 text-[0.8rem] text-neutral-600">{item.descripcionBreve || 'Sin descripción breve.'}</p>
                        <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-[0.75rem] text-neutral-500">
                          <span>Técnico: <strong className="font-medium text-neutral-700">{item.tecnico?.nombre || '-'}</strong></span>
                          <span>Programación: <strong className="font-medium text-neutral-700">{formatDate(item.fechaProgramada)}</strong></span>
                          <span>Matrices: <strong className="font-medium text-neutral-700">{item.matrices.length}</strong></span>
                        </div>
                      </div>
                      <Link href={`/actividades/${item.id}`} className="rounded-lg border border-sky-200 bg-sky-50 px-4 py-2 text-center text-[0.82rem] font-semibold text-sky-800 hover:bg-sky-100">Abrir actividad</Link>
                    </article>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  );
}
