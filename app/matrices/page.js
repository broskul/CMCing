'use client';

import { useCallback, useEffect, useState } from 'react';
import { ComboBox, MultiComboBox } from '../components/ComboBox';
import { requestJson } from '../lib/client-api';

const CATEGORIES = [
  { id: 'evaluacion', label: 'Matriz de evaluación' },
  { id: 'informe_resultado', label: 'Matriz de informe / resultado' },
];

const RESPONSE_TYPES = [
  { id: 'numero', label: 'Cuantitativa · número' },
  { id: 'dicotomica', label: 'Dicotómica · cumple / no cumple' },
  { id: 'seleccion_multiple', label: 'Selección múltiple' },
  { id: 'texto', label: 'Descriptiva · texto libre' },
];

function emptyItem() {
  return { localId: `${Date.now()}-${Math.random().toString(16).slice(2)}`, titulo: '', descripcion: '', tipoRespuesta: 'dicotomica', medicionId: '', opciones: '', requerido: true };
}

function emptyForm() {
  return { nombre: '', descripcion: '', categoria: 'evaluacion', defaultActividadIds: [], items: [emptyItem()] };
}

function measurementLabel(item) {
  const unit = item.simbolo || item.unidad;
  return `${item.nombre}${unit ? ` · ${unit}` : ''}`;
}

export default function ComplianceMatricesPage() {
  const [matrices, setMatrices] = useState([]);
  const [catalogs, setCatalogs] = useState({ tiposActividad: [], mediciones: [] });
  const [form, setForm] = useState(emptyForm);
  const [showCreate, setShowCreate] = useState(false);
  const [measurementIndex, setMeasurementIndex] = useState(null);
  const [measurementDraft, setMeasurementDraft] = useState({ nombre: '', unidad: '', simbolo: '', descripcion: '' });
  const [defaultEditor, setDefaultEditor] = useState(null);
  const [busy, setBusy] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [rows, catalogRows] = await Promise.all([
        requestJson('/api/matrices'),
        requestJson('/api/service-work/catalogs'),
      ]);
      setMatrices(rows);
      setCatalogs(catalogRows);
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const updateItem = (localId, patch) => {
    setForm((current) => ({
      ...current,
      items: current.items.map((item) => item.localId === localId ? { ...item, ...patch } : item),
    }));
  };

  const createMeasurement = async (event) => {
    event.preventDefault();
    setBusy('measurement');
    setError('');
    try {
      const created = await requestJson('/api/mediciones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(measurementDraft),
      });
      setCatalogs((current) => ({ ...current, mediciones: [...current.mediciones, created] }));
      const target = form.items[measurementIndex];
      if (target) updateItem(target.localId, { medicionId: String(created.id) });
      setMeasurementIndex(null);
      setMeasurementDraft({ nombre: '', unidad: '', simbolo: '', descripcion: '' });
      setNotice('Medición creada y seleccionada en el ítem.');
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setBusy('');
    }
  };

  const createMatrix = async (event) => {
    event.preventDefault();
    setBusy('matrix');
    setError('');
    setNotice('');
    try {
      await requestJson('/api/matrices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          items: form.items.map(({ localId: _localId, opciones, ...item }, index) => ({
            ...item,
            orden: index + 1,
            opciones: item.tipoRespuesta === 'seleccion_multiple' ? opciones.split(/\r?\n/).map((value) => value.trim()).filter(Boolean) : [],
          })),
        }),
      });
      setForm(emptyForm());
      setShowCreate(false);
      setNotice('Matriz creada. El tipo de cada ítem quedó bloqueado por diseño.');
      await load();
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setBusy('');
    }
  };

  const saveDefaults = async () => {
    if (!defaultEditor) return;
    setBusy(`defaults-${defaultEditor.matrixId}`);
    setError('');
    try {
      await requestJson(`/api/matrices/${defaultEditor.matrixId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ defaultActividadIds: defaultEditor.values }),
      });
      setDefaultEditor(null);
      setNotice('Actividades por defecto actualizadas.');
      await load();
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setBusy('');
    }
  };

  return (
    <div className="min-h-screen p-4 md:p-7">
      <div className="mx-auto max-w-7xl space-y-5">
        <header className="panel flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between md:p-6">
          <div>
            <p className="text-[0.75rem] font-semibold uppercase tracking-[0.16em] text-sky-700">Control técnico</p>
            <h1 className="mt-1 text-[1.7rem] font-semibold text-neutral-950">Matrices de cumplimiento</h1>
            <p className="mt-1 max-w-3xl text-[0.86rem] text-neutral-600">Checklists cuantitativos, dicotómicos, de selección múltiple y descriptivos aplicables a cada actividad.</p>
          </div>
          <button type="button" onClick={() => setShowCreate((value) => !value)} className="primary-action">{showCreate ? 'Cerrar formulario' : 'Crear matriz'}</button>
        </header>

        {error && <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-[0.86rem] text-rose-800">{error}</div>}
        {notice && <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-[0.86rem] text-emerald-800">{notice}</div>}

        {showCreate && (
          <form onSubmit={createMatrix} className="panel space-y-6 p-5 md:p-6">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <label className="xl:col-span-2"><span className="mb-1 block text-[0.8rem] font-medium text-neutral-700">Nombre</span><input className="input-base" value={form.nombre} onChange={(event) => setForm((current) => ({ ...current, nombre: event.target.value }))} required /></label>
              <label><span className="mb-1 block text-[0.8rem] font-medium text-neutral-700">Categoría</span><ComboBox options={CATEGORIES} value={form.categoria} onChange={(value) => setForm((current) => ({ ...current, categoria: value }))} required /></label>
              <label className="md:col-span-2 xl:col-span-3"><span className="mb-1 block text-[0.8rem] font-medium text-neutral-700">Descripción</span><textarea className="input-base min-h-20" value={form.descripcion} onChange={(event) => setForm((current) => ({ ...current, descripcion: event.target.value }))} /></label>
              <div className="md:col-span-2 xl:col-span-3"><span className="mb-1 block text-[0.8rem] font-medium text-neutral-700">Aplicar por defecto a tipos de actividad</span><MultiComboBox options={catalogs.tiposActividad} values={form.defaultActividadIds} onChange={(values) => setForm((current) => ({ ...current, defaultActividadIds: values }))} placeholder="Agregar tipo de actividad..." emptyText="Sin aplicación por defecto; podrá asignarse manualmente en la OT." /></div>
            </div>

            <section className="space-y-3">
              <div className="flex items-center justify-between"><div><h2 className="text-[1rem] font-semibold text-neutral-900">Ítems de la matriz</h2><p className="text-[0.76rem] text-neutral-500">El tipo de respuesta no podrá cambiar después de crear el ítem.</p></div><button type="button" onClick={() => setForm((current) => ({ ...current, items: [...current.items, emptyItem()] }))} className="rounded-lg border border-neutral-300 px-3 py-2 text-[0.8rem] font-medium text-neutral-800">Agregar ítem</button></div>
              {form.items.map((item, index) => (
                <article key={item.localId} className="rounded-xl border border-neutral-200 bg-neutral-50/70 p-4">
                  <div className="mb-3 flex items-center justify-between"><h3 className="text-[0.84rem] font-semibold text-neutral-800">Ítem {index + 1}</h3>{form.items.length > 1 && <button type="button" onClick={() => setForm((current) => ({ ...current, items: current.items.filter((row) => row.localId !== item.localId) }))} className="text-[0.75rem] font-medium text-rose-700">Quitar</button>}</div>
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    <label className="md:col-span-2"><span className="mb-1 block text-[0.77rem] font-medium text-neutral-700">Pregunta / control</span><input className="input-base" value={item.titulo} onChange={(event) => updateItem(item.localId, { titulo: event.target.value })} required /></label>
                    <label><span className="mb-1 block text-[0.77rem] font-medium text-neutral-700">Tipo de respuesta</span><ComboBox options={RESPONSE_TYPES} value={item.tipoRespuesta} onChange={(value) => updateItem(item.localId, { tipoRespuesta: value, medicionId: value === 'numero' ? item.medicionId : '', opciones: value === 'seleccion_multiple' ? item.opciones : '' })} required /></label>
                    <label className="md:col-span-2"><span className="mb-1 block text-[0.77rem] font-medium text-neutral-700">Descripción / criterio</span><input className="input-base" value={item.descripcion} onChange={(event) => updateItem(item.localId, { descripcion: event.target.value })} /></label>
                    <label className="flex items-center gap-2 self-end pb-2 text-[0.8rem] font-medium text-neutral-700"><input type="checkbox" checked={item.requerido} onChange={(event) => updateItem(item.localId, { requerido: event.target.checked })} /> Obligatorio</label>

                    {item.tipoRespuesta === 'numero' && (
                      <div className="md:col-span-2 xl:col-span-3">
                        <span className="mb-1 block text-[0.77rem] font-medium text-neutral-700">Medición / unidad</span>
                        <ComboBox
                          options={catalogs.mediciones}
                          value={item.medicionId}
                          onChange={(value) => updateItem(item.localId, { medicionId: value })}
                          getOptionLabel={measurementLabel}
                          placeholder="Buscar o seleccionar medición..."
                          createOptionLabel="Crear nueva medición"
                          onCreateOption={(query) => {
                            setMeasurementIndex(index);
                            setMeasurementDraft({ nombre: query, unidad: '', simbolo: '', descripcion: '' });
                          }}
                        />
                      </div>
                    )}

                    {item.tipoRespuesta === 'seleccion_multiple' && <label className="md:col-span-2 xl:col-span-3"><span className="mb-1 block text-[0.77rem] font-medium text-neutral-700">Opciones (una por línea)</span><textarea className="input-base min-h-28" value={item.opciones} onChange={(event) => updateItem(item.localId, { opciones: event.target.value })} required placeholder={'Opción 1\nOpción 2'} /></label>}
                  </div>
                </article>
              ))}
            </section>

            <div className="flex justify-end border-t border-neutral-200 pt-4"><button type="submit" disabled={busy === 'matrix'} className="primary-action disabled:opacity-60">{busy === 'matrix' ? 'Creando matriz...' : 'Crear matriz'}</button></div>
          </form>
        )}

        {measurementIndex !== null && (
          <form onSubmit={createMeasurement} className="rounded-xl border border-sky-200 bg-sky-50 p-5">
            <div className="flex items-center justify-between"><div><h2 className="text-[0.95rem] font-semibold text-sky-950">Nueva medición</h2><p className="text-[0.75rem] text-sky-800">Se agregará al catálogo y quedará seleccionada en el ítem {measurementIndex + 1}.</p></div><button type="button" onClick={() => setMeasurementIndex(null)} className="text-[0.78rem] font-medium text-sky-800">Cancelar</button></div>
            <div className="mt-4 grid gap-3 md:grid-cols-4">
              <label><span className="mb-1 block text-[0.76rem] font-medium text-sky-950">Nombre</span><input className="input-base bg-white" value={measurementDraft.nombre} onChange={(event) => setMeasurementDraft((current) => ({ ...current, nombre: event.target.value }))} required placeholder="Temperatura" /></label>
              <label><span className="mb-1 block text-[0.76rem] font-medium text-sky-950">Unidad</span><input className="input-base bg-white" value={measurementDraft.unidad} onChange={(event) => setMeasurementDraft((current) => ({ ...current, unidad: event.target.value }))} placeholder="grados Celsius" /></label>
              <label><span className="mb-1 block text-[0.76rem] font-medium text-sky-950">Símbolo</span><input className="input-base bg-white" value={measurementDraft.simbolo} onChange={(event) => setMeasurementDraft((current) => ({ ...current, simbolo: event.target.value }))} placeholder="°C" /></label>
              <button type="submit" disabled={busy === 'measurement'} className="self-end rounded-lg bg-sky-800 px-4 py-2 text-[0.8rem] font-semibold text-white disabled:opacity-60">{busy === 'measurement' ? 'Creando...' : 'Crear y seleccionar'}</button>
            </div>
          </form>
        )}

        <section className="space-y-4">
          <div className="flex items-center justify-between px-1"><h2 className="text-[1.05rem] font-semibold text-neutral-900">Matrices disponibles</h2><span className="text-[0.76rem] text-neutral-500">{loading ? 'Cargando...' : `${matrices.length} matrices`}</span></div>
          {loading ? <div className="panel p-8 text-center text-neutral-500">Cargando matrices...</div> : matrices.length === 0 ? <div className="panel p-8 text-center text-neutral-500">No hay matrices creadas.</div> : matrices.map((matrix) => (
            <article key={matrix.id} className="panel overflow-hidden">
              <header className="flex flex-col gap-3 border-b border-neutral-200 px-5 py-4 md:flex-row md:items-center md:justify-between">
                <div><div className="flex flex-wrap items-center gap-2"><h3 className="text-[1rem] font-semibold text-neutral-900">{matrix.nombre}</h3><span className="rounded-full bg-sky-100 px-2 py-1 text-[0.68rem] font-medium uppercase text-sky-800">{matrix.categoria === 'evaluacion' ? 'Evaluación' : 'Informe / resultado'}</span><span className="text-[0.7rem] text-neutral-500">v{matrix.version}</span></div><p className="mt-1 text-[0.78rem] text-neutral-500">{matrix.descripcion || 'Sin descripción.'}</p></div>
                <button type="button" onClick={() => setDefaultEditor(defaultEditor?.matrixId === matrix.id ? null : { matrixId: matrix.id, values: matrix.actividadesDefault.map((item) => String(item.id)) })} className="rounded-lg border border-neutral-300 px-3 py-2 text-[0.78rem] font-medium text-neutral-700">Asignación por defecto</button>
              </header>
              {defaultEditor?.matrixId === matrix.id && <div className="border-b border-neutral-200 bg-neutral-50 p-4"><MultiComboBox options={catalogs.tiposActividad} values={defaultEditor.values} onChange={(values) => setDefaultEditor((current) => ({ ...current, values }))} placeholder="Agregar tipo de actividad..." /><div className="mt-3 flex justify-end"><button type="button" onClick={saveDefaults} disabled={busy === `defaults-${matrix.id}`} className="rounded-lg bg-neutral-900 px-4 py-2 text-[0.78rem] font-semibold text-white">{busy === `defaults-${matrix.id}` ? 'Guardando...' : 'Guardar asignación'}</button></div></div>}
              <div className="grid gap-px bg-neutral-200 md:grid-cols-2 xl:grid-cols-3">
                {matrix.items.map((item, index) => (
                  <div key={item.id} className="bg-white p-4"><div className="flex items-start justify-between gap-3"><p className="text-[0.82rem] font-semibold text-neutral-850">{index + 1}. {item.titulo}</p>{item.requerido && <span className="text-[0.66rem] font-semibold uppercase text-rose-700">Obligatorio</span>}</div><p className="mt-2 text-[0.72rem] font-medium uppercase tracking-wide text-neutral-500">{RESPONSE_TYPES.find((type) => type.id === item.tipoRespuesta)?.label || item.tipoRespuesta}</p>{item.medicion && <p className="mt-1 text-[0.75rem] text-sky-700">{measurementLabel(item.medicion)}</p>}<p className="mt-2 text-[0.72rem] text-neutral-500">Tipo bloqueado después de la creación.</p></div>
                ))}
              </div>
            </article>
          ))}
        </section>
      </div>
    </div>
  );
}
