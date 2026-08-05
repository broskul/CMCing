'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { ComboBox, MultiComboBox } from '../../components/ComboBox';
import { requestJson } from '../../lib/client-api';

function toLocalInput(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const shifted = new Date(date.getTime() - (date.getTimezoneOffset() * 60000));
  return shifted.toISOString().slice(0, 16);
}

function formatDate(value) {
  if (!value) return '-';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '-' : new Intl.DateTimeFormat('es-CL', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

function matrixLabel(matrix) {
  return `${matrix.nombre} · ${matrix.categoria === 'evaluacion' ? 'Evaluación' : 'Informe / resultado'}`;
}

function initialResponseValue(item) {
  if (item.tipoRespuesta === 'numero') return item.respuesta?.valorNumero ?? '';
  if (item.tipoRespuesta === 'dicotomica') return item.respuesta?.valorBooleano ?? null;
  if (item.tipoRespuesta === 'seleccion_multiple') return item.respuesta?.valorOpciones || [];
  return item.respuesta?.valorTexto || '';
}

export default function ActivityDetailPage() {
  const params = useParams();
  const id = params.id;
  const [activity, setActivity] = useState(null);
  const [catalogs, setCatalogs] = useState({ tecnicos: [], tiposActividad: [], matrices: [] });
  const [user, setUser] = useState(null);
  const [aiStatus, setAiStatus] = useState({ configured: false });
  const [form, setForm] = useState({ titulo: '', descripcionBreve: '', notasTecnico: '', tecnicoId: '', actividadId: '', fechaProgramada: '', matrizIds: [] });
  const [responses, setResponses] = useState({});
  const [imageForm, setImageForm] = useState({ file: null, titulo: '', descripcion: '' });
  const [unlockReason, setUnlockReason] = useState('');
  const [busy, setBusy] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const hydrate = useCallback((row) => {
    setActivity(row);
    setForm({
      titulo: row.titulo || '',
      descripcionBreve: row.descripcionBreve || '',
      notasTecnico: row.notasTecnico || '',
      tecnicoId: String(row.tecnicoId || ''),
      actividadId: String(row.actividadId || ''),
      fechaProgramada: toLocalInput(row.fechaProgramada),
      matrizIds: row.matrices.map((item) => String(item.matrizId)),
    });
    setResponses(Object.fromEntries(row.matrices.map((assignment) => [
      assignment.id,
      Object.fromEntries(assignment.items.map((item) => [item.id, initialResponseValue(item)])),
    ])));
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [row, catalogRows, session, status] = await Promise.all([
        requestJson(`/api/ot-actividades/${id}`),
        requestJson('/api/service-work/catalogs'),
        requestJson('/api/auth/session'),
        requestJson('/api/ia/notas-tecnico'),
      ]);
      hydrate(row);
      setCatalogs(catalogRows);
      setUser(session.user || null);
      setAiStatus(status);
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoading(false);
    }
  }, [hydrate, id]);

  useEffect(() => {
    load();
  }, [load]);

  const run = async (key, action, successMessage) => {
    setBusy(key);
    setError('');
    setNotice('');
    try {
      const result = await action();
      if (result?.id) hydrate(result);
      if (successMessage) setNotice(successMessage);
      return result;
    } catch (actionError) {
      setError(actionError.message);
      return null;
    } finally {
      setBusy('');
    }
  };

  const saveGeneral = async (event) => {
    event.preventDefault();
    await run('general', () => requestJson(`/api/ot-actividades/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    }), 'Actividad actualizada.');
  };

  const saveMatrix = async (assignmentId) => {
    await run(`matrix-${assignmentId}`, () => requestJson(`/api/ot-actividades/${id}/respuestas`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ asignacionId: assignmentId, respuestas: responses[assignmentId] || {} }),
    }), 'Matriz guardada.');
  };

  const improveNotes = async () => {
    const result = await run('ai', () => requestJson('/api/ia/notas-tecnico', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ actividadId: id, notas: form.notasTecnico }),
    }));
    if (result?.text) {
      setForm((current) => ({ ...current, notasTecnico: result.text }));
      setNotice('Propuesta de redacción aplicada al editor. Revísela y guarde la actividad.');
    }
  };

  const uploadImage = async (event) => {
    event.preventDefault();
    if (!imageForm.file) {
      setError('Debe seleccionar una imagen.');
      return;
    }
    const body = new FormData();
    body.append('file', imageForm.file);
    body.append('titulo', imageForm.titulo);
    body.append('descripcion', imageForm.descripcion);
    const result = await run('image', async () => {
      const response = await fetch(`/api/ot-actividades/${id}/imagenes`, { method: 'POST', body });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || `Error ${response.status}`);
      return data;
    }, 'Imagen agregada a la actividad.');
    if (result) {
      setImageForm({ file: null, titulo: '', descripcion: '' });
      await load();
    }
  };

  const closeActivity = async () => {
    if (!window.confirm('Al cerrar, la actividad quedará bloqueada. ¿Desea continuar?')) return;
    await run('close', () => requestJson(`/api/ot-actividades/${id}/cerrar`, { method: 'POST' }), 'Actividad cerrada y bloqueada.');
  };

  const unlockActivity = async () => {
    const result = await run('unlock', () => requestJson(`/api/ot-actividades/${id}/desbloquear`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ motivo: unlockReason }),
    }), 'Actividad desbloqueada. La razón quedó registrada en auditoría.');
    if (result) setUnlockReason('');
  };

  const setResponse = (assignmentId, itemId, value) => {
    setResponses((current) => ({
      ...current,
      [assignmentId]: { ...current[assignmentId], [itemId]: value },
    }));
  };

  if (loading) return <div className="min-h-screen p-6"><div className="panel mx-auto max-w-6xl p-8 text-center text-neutral-500">Cargando actividad...</div></div>;
  if (!activity) return <div className="min-h-screen p-6"><div className="panel mx-auto max-w-6xl p-8 text-center text-rose-700">{error || 'Actividad no encontrada.'}</div></div>;

  const locked = activity.bloqueada || activity.estado === 'cerrada';

  return (
    <div className="min-h-screen p-4 md:p-7">
      <div className="mx-auto max-w-7xl space-y-5">
        <Link href={`/ordenes-trabajo/${activity.ordenTrabajoId}`} className="inline-flex text-[0.82rem] font-medium text-sky-700 hover:text-sky-900">← Volver a {activity.ordenTrabajo?.codigo || 'la OT'}</Link>
        {error && <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-[0.86rem] text-rose-800">{error}</div>}
        {notice && <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-[0.86rem] text-emerald-800">{notice}</div>}

        <header className="panel p-5 md:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-[0.78rem] font-semibold text-sky-700">{activity.ordenTrabajo?.codigo || `OT #${activity.ordenTrabajoId}`}</span>
                <span className={`rounded-full px-2.5 py-1 text-[0.72rem] font-medium ${locked ? 'bg-neutral-800 text-white' : 'bg-amber-100 text-amber-800'}`}>{locked ? 'Cerrada y bloqueada' : 'Abierta'}</span>
                <span className="rounded-full bg-sky-50 px-2.5 py-1 text-[0.72rem] text-sky-800">{activity.tipoActividad?.nombre || 'Actividad libre'}</span>
              </div>
              <h1 className="mt-2 text-[1.55rem] font-semibold text-neutral-950">{activity.titulo}</h1>
              <p className="mt-1 text-[0.84rem] text-neutral-600">{activity.ordenTrabajo?.cliente?.nombre || '-'} · {activity.ordenTrabajo?.equipo?.nombre || 'Sin equipo asociado'}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <a href={`/api/ot-actividades/${id}/pdf`} target="_blank" rel="noreferrer" className="rounded-lg border border-neutral-300 px-4 py-2 text-[0.82rem] font-semibold text-neutral-700 hover:bg-neutral-50">Ver informe PDF</a>
              {!locked && <button type="button" onClick={closeActivity} disabled={busy === 'close'} className="rounded-lg bg-neutral-900 px-4 py-2 text-[0.82rem] font-semibold text-white hover:bg-neutral-700 disabled:opacity-60">{busy === 'close' ? 'Cerrando...' : 'Cerrar actividad'}</button>}
            </div>
          </div>
          <dl className="mt-5 grid gap-3 border-t border-neutral-200 pt-4 sm:grid-cols-2 lg:grid-cols-4">
            <div><dt className="text-[0.68rem] uppercase tracking-wide text-neutral-500">Técnico</dt><dd className="mt-1 text-[0.84rem] font-medium text-neutral-900">{activity.tecnico?.nombre || '-'}</dd></div>
            <div><dt className="text-[0.68rem] uppercase tracking-wide text-neutral-500">Programada</dt><dd className="mt-1 text-[0.84rem] font-medium text-neutral-900">{formatDate(activity.fechaProgramada)}</dd></div>
            <div><dt className="text-[0.68rem] uppercase tracking-wide text-neutral-500">Cierre</dt><dd className="mt-1 text-[0.84rem] font-medium text-neutral-900">{formatDate(activity.fechaCierre)}</dd></div>
            <div><dt className="text-[0.68rem] uppercase tracking-wide text-neutral-500">Matrices</dt><dd className="mt-1 text-[0.84rem] font-medium text-neutral-900">{activity.matrices.length} asignadas</dd></div>
          </dl>
        </header>

        {locked && ['ADMIN', 'SUPERADMIN'].includes(user?.rol) && (
          <section className="rounded-xl border border-amber-300 bg-amber-50 p-5">
            <h2 className="text-[0.95rem] font-semibold text-amber-950">Desbloqueo administrativo</h2>
            <p className="mt-1 text-[0.8rem] text-amber-900">La razón es obligatoria, queda almacenada en la auditoría y reabre la OT.</p>
            <div className="mt-3 grid gap-3 md:grid-cols-[1fr_auto]">
              <textarea className="input-base min-h-20 bg-white" value={unlockReason} onChange={(event) => setUnlockReason(event.target.value)} placeholder="Explique por qué debe desbloquearse (mínimo 10 caracteres)..." />
              <button type="button" onClick={unlockActivity} disabled={busy === 'unlock' || unlockReason.trim().length < 10} className="self-end rounded-lg bg-amber-800 px-4 py-2 text-[0.82rem] font-semibold text-white disabled:opacity-50">{busy === 'unlock' ? 'Desbloqueando...' : 'Desbloquear'}</button>
            </div>
          </section>
        )}

        <form onSubmit={saveGeneral} className="panel space-y-5 p-5 md:p-6">
          <div className="flex items-center justify-between">
            <div><h2 className="text-[1rem] font-semibold text-neutral-900">Detalle de la actividad</h2><p className="text-[0.77rem] text-neutral-500">Título, descripción breve, técnico, matrices y notas.</p></div>
            {locked && <span className="text-[0.76rem] font-medium text-neutral-500">Solo lectura</span>}
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <label><span className="mb-1 block text-[0.78rem] font-medium text-neutral-700">Tipo de actividad</span><ComboBox options={catalogs.tiposActividad} value={form.actividadId} onChange={(value) => setForm((current) => ({ ...current, actividadId: value }))} disabled={locked} /></label>
            <label><span className="mb-1 block text-[0.78rem] font-medium text-neutral-700">Técnico</span><ComboBox options={catalogs.tecnicos} value={form.tecnicoId} onChange={(value) => setForm((current) => ({ ...current, tecnicoId: value }))} disabled={locked} required /></label>
            <label><span className="mb-1 block text-[0.78rem] font-medium text-neutral-700">Fecha programada</span><input type="datetime-local" className="input-base" value={form.fechaProgramada} onChange={(event) => setForm((current) => ({ ...current, fechaProgramada: event.target.value }))} disabled={locked} /></label>
            <label className="md:col-span-2"><span className="mb-1 block text-[0.78rem] font-medium text-neutral-700">Título</span><input className="input-base" value={form.titulo} onChange={(event) => setForm((current) => ({ ...current, titulo: event.target.value }))} disabled={locked} required /></label>
            <label><span className="mb-1 block text-[0.78rem] font-medium text-neutral-700">Descripción breve</span><input className="input-base" value={form.descripcionBreve} onChange={(event) => setForm((current) => ({ ...current, descripcionBreve: event.target.value }))} disabled={locked} /></label>
            <div className="md:col-span-2 xl:col-span-3"><span className="mb-1 block text-[0.78rem] font-medium text-neutral-700">Matrices asignadas</span><MultiComboBox options={catalogs.matrices} values={form.matrizIds} onChange={(values) => setForm((current) => ({ ...current, matrizIds: values }))} getOptionLabel={matrixLabel} disabled={locked} /></div>
            <label className="md:col-span-2 xl:col-span-3">
              <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                <span className="text-[0.78rem] font-medium text-neutral-700">Notas del técnico</span>
                <button type="button" onClick={improveNotes} disabled={locked || !aiStatus.configured || busy === 'ai'} className="rounded-lg border border-violet-200 bg-violet-50 px-3 py-1.5 text-[0.75rem] font-semibold text-violet-800 disabled:cursor-not-allowed disabled:opacity-50">
                  {busy === 'ai' ? 'Mejorando...' : aiStatus.configured ? 'Mejorar redacción con OpenAI' : 'OpenAI pendiente de credencial'}
                </button>
              </div>
              <textarea className="input-base min-h-40" value={form.notasTecnico} onChange={(event) => setForm((current) => ({ ...current, notasTecnico: event.target.value }))} disabled={locked} placeholder="Hallazgos, acciones realizadas, condiciones y recomendaciones..." />
            </label>
          </div>
          {!locked && <div className="flex justify-end"><button type="submit" disabled={busy === 'general'} className="primary-action disabled:opacity-60">{busy === 'general' ? 'Guardando...' : 'Guardar actividad'}</button></div>}
        </form>

        <section className="space-y-4">
          <div className="px-1"><h2 className="text-[1.08rem] font-semibold text-neutral-900">Matrices de cumplimiento</h2><p className="text-[0.8rem] text-neutral-500">Las matrices obligatorias deben quedar completas antes del cierre.</p></div>
          {!activity.matrices.length ? (
            <div className="panel p-6 text-center text-[0.84rem] text-neutral-500">No hay matrices asignadas a esta actividad.</div>
          ) : activity.matrices.map((assignment) => (
            <article key={assignment.id} className="panel overflow-hidden">
              <header className="flex flex-col gap-3 border-b border-neutral-200 bg-neutral-50/70 px-5 py-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2"><h3 className="text-[0.98rem] font-semibold text-neutral-900">{assignment.matriz?.nombre || 'Matriz'}</h3><span className="rounded-full bg-sky-100 px-2 py-1 text-[0.68rem] font-medium uppercase text-sky-800">{assignment.matriz?.categoria === 'evaluacion' ? 'Evaluación' : 'Informe / resultado'}</span></div>
                  <p className="mt-1 text-[0.77rem] text-neutral-500">{assignment.matriz?.descripcion || `${assignment.items.length} ítems`}</p>
                </div>
                <span className={`rounded-full px-2.5 py-1 text-[0.72rem] font-semibold ${assignment.completa ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>{assignment.completa ? 'Completa' : 'Pendiente'}</span>
              </header>
              <div className="divide-y divide-neutral-100 px-5">
                {assignment.items.map((item, index) => (
                  <div key={item.id} className="grid gap-3 py-4 lg:grid-cols-[minmax(220px,0.8fr)_1.2fr] lg:items-start">
                    <div><p className="text-[0.84rem] font-semibold text-neutral-850">{index + 1}. {item.titulo}{item.requerido ? ' *' : ''}</p>{item.descripcion && <p className="mt-1 text-[0.75rem] text-neutral-500">{item.descripcion}</p>}</div>
                    <div>
                      {item.tipoRespuesta === 'numero' && <div className="flex items-center gap-2"><input type="number" step="any" className="input-base" value={responses[assignment.id]?.[item.id] ?? ''} onChange={(event) => setResponse(assignment.id, item.id, event.target.value)} disabled={locked} /><span className="min-w-14 text-[0.8rem] font-medium text-neutral-600">{item.medicion?.simbolo || item.medicion?.unidad || ''}</span></div>}
                      {item.tipoRespuesta === 'dicotomica' && <ComboBox options={[{ id: 'true', label: 'Cumple' }, { id: 'false', label: 'No cumple' }]} value={responses[assignment.id]?.[item.id] === true ? 'true' : responses[assignment.id]?.[item.id] === false ? 'false' : ''} onChange={(value) => setResponse(assignment.id, item.id, value === 'true')} disabled={locked} />}
                      {item.tipoRespuesta === 'seleccion_multiple' && <MultiComboBox options={(item.opciones || []).map((option) => ({ id: option, label: option }))} values={responses[assignment.id]?.[item.id] || []} onChange={(values) => setResponse(assignment.id, item.id, values)} disabled={locked} placeholder="Seleccionar una o más opciones..." />}
                      {item.tipoRespuesta === 'texto' && <textarea className="input-base min-h-24" value={responses[assignment.id]?.[item.id] || ''} onChange={(event) => setResponse(assignment.id, item.id, event.target.value)} disabled={locked} />}
                    </div>
                  </div>
                ))}
              </div>
              {!locked && <footer className="flex justify-end border-t border-neutral-200 px-5 py-4"><button type="button" onClick={() => saveMatrix(assignment.id)} disabled={busy === `matrix-${assignment.id}`} className="rounded-lg bg-sky-700 px-4 py-2 text-[0.8rem] font-semibold text-white hover:bg-sky-800 disabled:opacity-60">{busy === `matrix-${assignment.id}` ? 'Guardando...' : 'Guardar matriz'}</button></footer>}
            </article>
          ))}
        </section>

        <section className="panel p-5 md:p-6">
          <div><h2 className="text-[1rem] font-semibold text-neutral-900">Imágenes de la actividad</h2><p className="text-[0.77rem] text-neutral-500">Estado inicial, recepción, evaluación y entrega se documentan aquí, no en la OT.</p></div>
          {!locked && (
            <form onSubmit={uploadImage} className="mt-4 grid gap-3 rounded-xl border border-dashed border-neutral-300 bg-neutral-50 p-4 md:grid-cols-2 xl:grid-cols-4">
              <label><span className="mb-1 block text-[0.76rem] font-medium text-neutral-700">Imagen</span><input type="file" accept="image/*" onChange={(event) => setImageForm((current) => ({ ...current, file: event.target.files?.[0] || null }))} className="block w-full text-[0.78rem]" /></label>
              <label><span className="mb-1 block text-[0.76rem] font-medium text-neutral-700">Título</span><input className="input-base" value={imageForm.titulo} onChange={(event) => setImageForm((current) => ({ ...current, titulo: event.target.value }))} /></label>
              <label><span className="mb-1 block text-[0.76rem] font-medium text-neutral-700">Descripción</span><input className="input-base" value={imageForm.descripcion} onChange={(event) => setImageForm((current) => ({ ...current, descripcion: event.target.value }))} /></label>
              <button type="submit" disabled={busy === 'image'} className="self-end rounded-lg bg-neutral-900 px-4 py-2 text-[0.8rem] font-semibold text-white disabled:opacity-60">{busy === 'image' ? 'Subiendo...' : 'Agregar imagen'}</button>
            </form>
          )}
          <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {activity.adjuntos.filter((item) => String(item.mimeType || '').startsWith('image/')).map((item) => (
              <figure key={item.id} className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/api/r2/private?key=${encodeURIComponent(item.r2Key)}`} alt={item.metadata?.titulo || item.nombreOriginal} className="h-48 w-full object-cover" />
                <figcaption className="p-3"><p className="text-[0.82rem] font-semibold text-neutral-900">{item.metadata?.titulo || item.nombreOriginal}</p>{item.metadata?.descripcion && <p className="mt-1 text-[0.75rem] text-neutral-500">{item.metadata.descripcion}</p>}</figcaption>
              </figure>
            ))}
            {!activity.adjuntos.some((item) => String(item.mimeType || '').startsWith('image/')) && <p className="text-[0.82rem] text-neutral-500">Todavía no hay imágenes en esta actividad.</p>}
          </div>
        </section>

        <section className="panel overflow-hidden">
          <header className="border-b border-neutral-200 px-5 py-4"><h2 className="text-[1rem] font-semibold text-neutral-900">Auditoría de la actividad</h2><p className="text-[0.76rem] text-neutral-500">Cambios, cierre, respuestas y desbloqueos con actor y motivo.</p></header>
          <div className="divide-y divide-neutral-100">
            {activity.auditoria.map((entry) => (
              <div key={entry.id} className="grid gap-1 px-5 py-4 md:grid-cols-[150px_1fr_auto] md:items-center">
                <span className="text-[0.75rem] font-semibold text-neutral-800">{entry.accion}</span>
                <div><p className="text-[0.8rem] text-neutral-700">{entry.motivo || 'Cambio registrado'}</p><p className="text-[0.72rem] text-neutral-500">{entry.actor?.nombre || 'Actor no disponible'} · {entry.actor?.rol || '-'}</p></div>
                <time className="text-[0.72rem] text-neutral-500">{formatDate(entry.createdAt)}</time>
              </div>
            ))}
            {!activity.auditoria.length && <div className="p-6 text-center text-[0.82rem] text-neutral-500">Sin eventos de auditoría.</div>}
          </div>
        </section>
      </div>
    </div>
  );
}
