'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ComboBox, MultiComboBox } from '../components/ComboBox';
import { BarcodeScanner, normalizeScannedCode } from '../components/BarcodeScanner';
import { EquipmentFormModal } from '../components/EquipmentFormModal';
import { requestJson } from '../lib/client-api';

const CRITICALITIES = [
  { id: 'baja', label: 'Baja' },
  { id: 'media', label: 'Media' },
  { id: 'alta', label: 'Alta' },
  { id: 'critica', label: 'Crítica' },
];

function emptyForm() {
  return {
    titulo: '',
    descripcion: '',
    clienteId: '',
    equipoId: '',
    criticidad: 'media',
    fechaProgramada: '',
    actividades: [],
  };
}

function emptyActivity() {
  return {
    localId: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    actividadId: '',
    tecnicoId: '',
    titulo: '',
    descripcionBreve: '',
    fechaProgramada: '',
    matrizIds: [],
  };
}

function formatDate(value) {
  if (!value) return 'Sin fecha';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Sin fecha' : new Intl.DateTimeFormat('es-CL', { dateStyle: 'medium' }).format(date);
}

function matrixLabel(matrix) {
  return `${matrix.nombre} · ${matrix.categoria === 'evaluacion' ? 'Evaluación' : 'Informe / resultado'}`;
}

function emptyEquipmentForm({ nombre = '', clienteId = '', propietarioBloqueado = false } = {}) {
  return {
    nombre,
    modelo: '',
    serial: '',
    partNumber: '',
    ean: '',
    fabricante: '',
    ubicacion: '',
    estadoOperativo: 'operativo',
    clienteId: clienteId ? String(clienteId) : '',
    propietarioTipo: clienteId ? 'CLIENTE' : '',
    propietarioBloqueado,
    observaciones: '',
  };
}

function normalizeIdentifier(value) {
  return normalizeScannedCode(value).toLowerCase().replace(/[\s-]+/g, '');
}

function equipmentDescription(item) {
  return [
    item.codigoInterno,
    item.partNumber ? `PN ${item.partNumber}` : '',
    item.ean ? `EAN ${item.ean}` : '',
    item.serial ? `Serie ${item.serial}` : '',
  ].filter(Boolean).join(' · ') || 'Sin identificadores adicionales';
}

export default function WorkOrdersPage() {
  const [orders, setOrders] = useState([]);
  const [catalogs, setCatalogs] = useState({ clientes: [], equipos: [], equipmentOwners: [], tecnicos: [], tiposActividad: [], matrices: [] });
  const [form, setForm] = useState(emptyForm);
  const [showCreate, setShowCreate] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [showEquipmentCreate, setShowEquipmentCreate] = useState(false);
  const [equipmentForm, setEquipmentForm] = useState(() => emptyEquipmentForm());

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [orderRows, catalogRows, ownerCatalogRes] = await Promise.all([
        requestJson('/api/ordenes-trabajo'),
        requestJson('/api/service-work/catalogs'),
        fetch('/api/equipos/catalogos').catch(() => null),
      ]);
      const ownerCatalog = ownerCatalogRes ? await ownerCatalogRes.json().catch(() => ({})) : {};
      const directOwners = Array.isArray(ownerCatalog?.propietarios) ? ownerCatalog.propietarios : [];
      setOrders(orderRows);
      setCatalogs({
        ...catalogRows,
        equipmentOwners: ownerCatalogRes?.ok && directOwners.length ? directOwners : (catalogRows.equipmentOwners || []),
      });
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const clientEquipment = useMemo(() => catalogs.equipos.filter((item) => (
    !form.clienteId || String(item.clienteId) === String(form.clienteId)
  )), [catalogs.equipos, form.clienteId]);

  const openEquipmentCreate = (suggestedName = '') => {
    setEquipmentForm(emptyEquipmentForm({
      nombre: suggestedName,
      clienteId: form.clienteId,
      propietarioBloqueado: Boolean(form.clienteId),
    }));
    setShowEquipmentCreate(true);
  };

  const handleScannedEquipment = (rawCode) => {
    const code = normalizeIdentifier(rawCode);
    const equipment = catalogs.equipos.find((item) => [item.ean, item.partNumber, item.serial, item.codigoInterno]
      .filter(Boolean)
      .some((value) => normalizeIdentifier(value) === code));
    if (!equipment) {
      setError(`No existe un equipo con el código “${rawCode}”. Puede ingresarlo como nuevo equipo.`);
      openEquipmentCreate('');
      return;
    }
    if (equipment.propietarioTipo === 'CMCING') {
      setError('El código corresponde a un equipo propio de CMCing. Regístrelo desde Equipos o seleccione el cliente de la OT antes de asociarlo.');
      return;
    }
    setError('');
    setForm((current) => ({
      ...current,
      clienteId: String(equipment.clienteId),
      equipoId: String(equipment.id),
    }));
  };

  const updateActivity = (localId, patch) => {
    setForm((current) => ({
      ...current,
      actividades: current.actividades.map((activity) => (
        activity.localId === localId ? { ...activity, ...patch } : activity
      )),
    }));
  };

  const handleActivityType = (activity, id, option) => {
    updateActivity(activity.localId, {
      actividadId: id,
      titulo: activity.titulo || option?.nombre || '',
      matrizIds: (option?.matrizIdsDefault || []).map(String),
    });
  };

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      await requestJson('/api/ordenes-trabajo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          actividades: form.actividades.map(({ localId: _localId, ...activity }) => activity),
        }),
      });
      setForm(emptyForm());
      setShowCreate(false);
      await load();
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setSaving(false);
    }
  };

  const handleEquipmentSave = async ({ imageFile, imageUrl }) => {
    const payload = {
      ...equipmentForm,
      clienteId: equipmentForm.clienteId ? Number(equipmentForm.clienteId) : null,
    };
    delete payload.propietarioBloqueado;
    const saved = await requestJson('/api/equipos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    let finalEquipment = saved;
    let imageWarning = '';
    if (imageFile || imageUrl) {
      const imageData = new FormData();
      if (imageFile) imageData.set('imageFile', imageFile);
      if (imageUrl) imageData.set('imageUrl', imageUrl);
      try {
        finalEquipment = await requestJson(`/api/equipos/${saved.id}/imagen`, { method: 'POST', body: imageData });
      } catch (imageError) {
        imageWarning = imageError.message;
      }
    }
    setShowEquipmentCreate(false);
    await load();
    setForm((current) => ({
      ...current,
      clienteId: String(finalEquipment.clienteId),
      equipoId: String(finalEquipment.id),
    }));
    if (imageWarning) setError(`Equipo creado. ${imageWarning}`);
  };

  return (
    <div className="min-h-screen p-4 md:p-7">
      <div className="mx-auto max-w-7xl space-y-5">
        <header className="panel flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between md:p-6">
          <div>
            <p className="text-[0.75rem] font-semibold uppercase tracking-[0.16em] text-sky-700">Servicio técnico</p>
            <h1 className="mt-1 text-[1.7rem] font-semibold text-neutral-950">Órdenes de trabajo</h1>
            <p className="mt-1 max-w-2xl text-[0.88rem] text-neutral-600">La OT organiza el caso; la ejecución, las matrices y las fotografías viven en cada actividad.</p>
          </div>
          <button type="button" onClick={() => setShowCreate((value) => !value)} className="primary-action">
            {showCreate ? 'Cerrar formulario' : 'Crear OT'}
          </button>
        </header>

        {error && <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-[0.86rem] text-rose-800">{error}</div>}

        {showCreate && (
          <form onSubmit={submit} className="panel space-y-6 p-5 md:p-6">
            <div className="flex items-center justify-between border-b border-neutral-200 pb-3">
              <div>
                <h2 className="text-[1.08rem] font-semibold text-neutral-900">Nueva orden de trabajo</h2>
                <p className="text-[0.8rem] text-neutral-500">Puede guardarse sin actividades y programarlas después.</p>
              </div>
              <span className="rounded-full bg-neutral-100 px-3 py-1 text-[0.75rem] text-neutral-600">{form.actividades.length} actividades</span>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <label className="xl:col-span-2">
                <span className="mb-1 block text-[0.8rem] font-medium text-neutral-700">Título de la OT</span>
                <input className="input-base" value={form.titulo} onChange={(event) => setForm((current) => ({ ...current, titulo: event.target.value }))} required />
              </label>
              <label>
                <span className="mb-1 block text-[0.8rem] font-medium text-neutral-700">Criticidad de la OT</span>
                <ComboBox options={CRITICALITIES} value={form.criticidad} onChange={(id) => setForm((current) => ({ ...current, criticidad: id }))} required allowClear={false} />
              </label>
              <label>
                <span className="mb-1 block text-[0.8rem] font-medium text-neutral-700">Cliente</span>
                <ComboBox
                  options={catalogs.clientes}
                  value={form.clienteId}
                  onChange={(id) => setForm((current) => ({ ...current, clienteId: id, equipoId: '' }))}
                  getOptionLabel={(item) => `${item.nombre}${item.rut ? ` · ${item.rut}` : ''}`}
                  required
                />
              </label>
              <label>
                <span className="mb-1 block text-[0.8rem] font-medium text-neutral-700">Equipo relacionado</span>
                <div className="flex gap-2">
                  <div className="min-w-0 flex-1">
                    <ComboBox
                      options={clientEquipment}
                      value={form.equipoId}
                      onChange={(id) => setForm((current) => ({ ...current, equipoId: id }))}
                      getOptionLabel={(item) => item.nombre}
                      getOptionDescription={equipmentDescription}
                      placeholder="Buscar por nombre, EAN, Part Number o serie"
                      onCreateOption={openEquipmentCreate}
                      createOptionLabel="Ingresar nuevo equipo"
                    />
                  </div>
                  <BarcodeScanner label="Escanear" onDetected={handleScannedEquipment} />
                </div>
              </label>
              <label>
                <span className="mb-1 block text-[0.8rem] font-medium text-neutral-700">Fecha programada</span>
                <input type="datetime-local" className="input-base" value={form.fechaProgramada} onChange={(event) => setForm((current) => ({ ...current, fechaProgramada: event.target.value }))} />
              </label>
              <label className="md:col-span-2 xl:col-span-3">
                <span className="mb-1 block text-[0.8rem] font-medium text-neutral-700">Descripción</span>
                <textarea className="input-base min-h-24" value={form.descripcion} onChange={(event) => setForm((current) => ({ ...current, descripcion: event.target.value }))} />
              </label>
            </div>

            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-[0.96rem] font-semibold text-neutral-900">Actividades iniciales</h3>
                  <p className="text-[0.78rem] text-neutral-500">Las matrices por defecto se cargan desde el tipo de actividad y pueden ajustarse aquí.</p>
                </div>
                <button type="button" onClick={() => setForm((current) => ({ ...current, actividades: [...current.actividades, emptyActivity()] }))} className="rounded-lg border border-neutral-300 px-3 py-2 text-[0.82rem] font-medium text-neutral-800 hover:bg-neutral-50">
                  Agregar actividad
                </button>
              </div>

              {form.actividades.map((activity, index) => (
                <article key={activity.localId} className="rounded-xl border border-neutral-200 bg-neutral-50/70 p-4">
                  <div className="mb-4 flex items-center justify-between">
                    <h4 className="text-[0.85rem] font-semibold text-neutral-800">Actividad {index + 1}</h4>
                    <button type="button" onClick={() => setForm((current) => ({ ...current, actividades: current.actividades.filter((item) => item.localId !== activity.localId) }))} className="text-[0.76rem] font-medium text-rose-700">Quitar</button>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    <label>
                      <span className="mb-1 block text-[0.78rem] font-medium text-neutral-700">Tipo de actividad</span>
                      <ComboBox options={catalogs.tiposActividad} value={activity.actividadId} onChange={(id, option) => handleActivityType(activity, id, option)} required />
                    </label>
                    <label>
                      <span className="mb-1 block text-[0.78rem] font-medium text-neutral-700">Técnico asignado</span>
                      <ComboBox options={catalogs.tecnicos} value={activity.tecnicoId} onChange={(id) => updateActivity(activity.localId, { tecnicoId: id })} required />
                    </label>
                    <label>
                      <span className="mb-1 block text-[0.78rem] font-medium text-neutral-700">Programación</span>
                      <input type="datetime-local" className="input-base" value={activity.fechaProgramada} onChange={(event) => updateActivity(activity.localId, { fechaProgramada: event.target.value })} />
                    </label>
                    <label className="md:col-span-2">
                      <span className="mb-1 block text-[0.78rem] font-medium text-neutral-700">Título</span>
                      <input className="input-base" value={activity.titulo} onChange={(event) => updateActivity(activity.localId, { titulo: event.target.value })} required />
                    </label>
                    <label>
                      <span className="mb-1 block text-[0.78rem] font-medium text-neutral-700">Descripción breve</span>
                      <input className="input-base" value={activity.descripcionBreve} onChange={(event) => updateActivity(activity.localId, { descripcionBreve: event.target.value })} />
                    </label>
                    <div className="md:col-span-2 xl:col-span-3">
                      <span className="mb-1 block text-[0.78rem] font-medium text-neutral-700">Matrices asignadas</span>
                      <MultiComboBox options={catalogs.matrices} values={activity.matrizIds} onChange={(ids) => updateActivity(activity.localId, { matrizIds: ids })} getOptionLabel={matrixLabel} placeholder="Agregar matriz de evaluación o informe..." />
                    </div>
                  </div>
                </article>
              ))}

              {!form.actividades.length && <div className="rounded-xl border border-dashed border-neutral-300 px-4 py-5 text-center text-[0.82rem] text-neutral-500">La OT se creará sin actividades iniciales.</div>}
            </section>

            <div className="flex justify-end gap-3 border-t border-neutral-200 pt-4">
              <button type="button" onClick={() => { setForm(emptyForm()); setShowCreate(false); }} className="rounded-lg border border-neutral-300 px-4 py-2 text-[0.86rem] font-medium text-neutral-700">Cancelar</button>
              <button type="submit" disabled={saving} className="primary-action disabled:opacity-60">{saving ? 'Creando OT...' : 'Crear orden de trabajo'}</button>
            </div>
          </form>
        )}

        <section className="panel overflow-hidden">
          <div className="flex items-center justify-between border-b border-neutral-200 px-5 py-4">
            <h2 className="text-[1rem] font-semibold text-neutral-900">OT registradas</h2>
            <span className="text-[0.78rem] text-neutral-500">{loading ? 'Cargando...' : `${orders.length} registros`}</span>
          </div>
          {loading ? (
            <div className="p-8 text-center text-neutral-500">Cargando órdenes de trabajo...</div>
          ) : orders.length === 0 ? (
            <div className="p-8 text-center text-neutral-500">No existen OT todavía.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="admin-table min-w-[880px]">
                <thead>
                  <tr><th>OT</th><th>Cliente / equipo</th><th>Criticidad</th><th>Actividades</th><th>Programación</th><th>Estado</th><th /></tr>
                </thead>
                <tbody>
                  {orders.map((order) => (
                    <tr key={order.id}>
                      <td><span className="font-mono text-[0.78rem] text-sky-700">{order.codigo || `OT #${order.id}`}</span><strong className="mt-1 block text-[0.86rem] text-neutral-900">{order.titulo}</strong></td>
                      <td><span className="block text-[0.83rem] text-neutral-800">{order.cliente?.nombre || '-'}</span><span className="text-[0.75rem] text-neutral-500">{order.equipo?.nombre || 'Sin equipo asociado'}</span></td>
                      <td className="capitalize">{order.criticidad || order.prioridad}</td>
                      <td><span className="font-semibold text-neutral-900">{order.resumen.total}</span><span className="ml-2 text-[0.75rem] text-neutral-500">{order.resumen.abiertas} abiertas</span></td>
                      <td>{formatDate(order.fechaProgramada)}</td>
                      <td><span className={`rounded-full px-2.5 py-1 text-[0.74rem] font-medium ${order.estado === 'cerrada' ? 'bg-emerald-100 text-emerald-800' : 'bg-sky-100 text-sky-800'}`}>{order.estado}</span></td>
                      <td><Link href={`/ordenes-trabajo/${order.id}`} className="table-action table-action-edit">Abrir</Link></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      <EquipmentFormModal
        open={showEquipmentCreate}
        mode="create"
        formData={equipmentForm}
        equipos={catalogs.equipos}
        propietarios={catalogs.equipmentOwners}
        onChange={(event) => setEquipmentForm((current) => ({ ...current, [event.target.name]: event.target.value }))}
        onOwnerChange={(id, option) => setEquipmentForm((current) => ({
          ...current,
          propietarioTipo: option?.propietarioTipo || (id === 'CMCING' ? 'CMCING' : 'CLIENTE'),
          clienteId: id === 'CMCING' ? '' : String(id || ''),
        }))}
        onClose={() => setShowEquipmentCreate(false)}
        onSubmit={handleEquipmentSave}
      />
    </div>
  );
}
