'use client';

import { useEffect, useMemo, useState } from 'react';

const initialForm = {
  clienteId: '',
  mantencionId: '',
  incidenteId: '',
  equipoIds: [],
  tecnicoId: '',
  vendedorId: '',
  servicioId: '',
  fecha: '',
  descripcion: '',
  resultado: '',
  recomendaciones: '',
  estado: 'pendiente',
};

const getOptionLabel = (item) => {
  if (!item) return '';
  if (item.nroSerie || item.serial) return `${item.nombre} - ${item.nroSerie || item.serial}`;
  if (item.folio || item.titulo) return `${item.folio || 'S/F'} - ${item.titulo || item.id}`;
  if (item.descripcion) return item.descripcion;
  return item.nombre || item.email || item.id;
};

export default function NuevaVisita() {
  const [form, setForm] = useState(initialForm);
  const [files, setFiles] = useState([]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [options, setOptions] = useState({
    clientes: [],
    equipos: [],
    tecnicos: [],
    vendedores: [],
    servicios: [],
    mantenciones: [],
    incidentes: [],
  });

  useEffect(() => {
    const fetchOptions = async () => {
      try {
        const responses = await Promise.all([
          fetch('/api/clientes'),
          fetch('/api/equipos'),
          fetch('/api/tecnicos'),
          fetch('/api/vendedores'),
          fetch('/api/servicios'),
          fetch('/api/mantenciones'),
          fetch('/api/incidentes'),
        ]);
        const [clientes, equipos, tecnicos, vendedores, servicios, mantenciones, incidentes] = await Promise.all(
          responses.map((res) => res.ok ? res.json() : [])
        );
        setOptions({ clientes, equipos, tecnicos, vendedores, servicios, mantenciones, incidentes });
      } catch (error) {
        setMessage(error.message);
      }
    };
    fetchOptions();
  }, []);

  const equiposDisponibles = useMemo(() => {
    if (!form.clienteId) return options.equipos;
    return options.equipos.filter((equipo) => String(equipo.clienteId) === String(form.clienteId));
  }, [form.clienteId, options.equipos]);

  const mantencionesDisponibles = useMemo(() => {
    if (!form.clienteId) return options.mantenciones;
    return options.mantenciones.filter((mantencion) => String(mantencion.clienteId) === String(form.clienteId));
  }, [form.clienteId, options.mantenciones]);

  const incidentesDisponibles = useMemo(() => {
    if (!form.clienteId) return options.incidentes;
    return options.incidentes.filter((incidente) => String(incidente.clienteId) === String(form.clienteId));
  }, [form.clienteId, options.incidentes]);

  const handleChange = (event) => {
    const { name, value } = event.target;
    if (name === 'clienteId') {
      setForm((prev) => ({ ...prev, clienteId: value, equipoIds: [], mantencionId: '', incidenteId: '' }));
      return;
    }
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleEquipoToggle = (equipoId) => {
    setForm((prev) => {
      const exists = prev.equipoIds.includes(equipoId);
      return {
        ...prev,
        equipoIds: exists ? prev.equipoIds.filter((id) => id !== equipoId) : [...prev.equipoIds, equipoId],
      };
    });
  };

  const uploadImages = async (visitaId) => {
    const uploaded = [];
    for (const file of files) {
      const body = new FormData();
      body.append('file', file);
      body.append('visitaId', visitaId);
      body.append('tipo', 'evidencia');
      if (form.equipoIds[0]) body.append('equipoId', form.equipoIds[0]);

      const res = await fetch('/api/uploads/r2', { method: 'POST', body });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'No se pudo subir una imagen');
      uploaded.push(result);
    }
    return uploaded;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setMessage('');

    try {
      const res = await fetch('/api/visitas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          equipoId: form.equipoIds[0] || null,
          equipoIds: form.equipoIds,
          mantencionId: form.mantencionId || null,
          incidenteId: form.incidenteId || null,
          vendedorId: form.vendedorId || null,
          servicioId: form.servicioId || null,
          fecha: new Date(form.fecha).toISOString(),
        }),
      });

      const visita = await res.json();
      if (!res.ok) throw new Error(visita.error || 'No se pudo crear la visita');

      const uploaded = files.length ? await uploadImages(visita.id) : [];
      setMessage(`Visita creada. Imagenes adjuntas: ${uploaded.length}.`);
      setForm(initialForm);
      setFiles([]);
    } catch (error) {
      setMessage(error.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen p-6 md:p-8">
      <div className="mx-auto max-w-4xl">
        <div className="panel mb-6 p-6">
          <p className="text-[0.85rem] uppercase tracking-[0.18em] text-neutral-500">Operacion</p>
          <h1 className="mt-1 text-[1.65rem] font-semibold text-neutral-900">Nueva Visita Tecnica</h1>
        </div>

        {message ? <div className="mb-4 rounded-xl border border-sky-200 bg-sky-50 p-3 text-[0.9rem] text-sky-800">{message}</div> : null}

        <form onSubmit={handleSubmit} className="panel grid grid-cols-1 gap-4 p-6 md:grid-cols-2">
          <label className="text-[0.85rem] font-medium text-neutral-700 md:col-span-2">
            Cliente
            <select name="clienteId" value={form.clienteId} onChange={handleChange} required className="input-base mt-1 block">
              <option value="">Seleccionar cliente</option>
              {options.clientes.map((cliente) => <option key={cliente.id} value={cliente.id}>{cliente.nombre}</option>)}
            </select>
          </label>

          <label className="text-[0.85rem] font-medium text-neutral-700">
            Mantencion
            <select name="mantencionId" value={form.mantencionId} onChange={handleChange} className="input-base mt-1 block">
              <option value="">Sin mantencion asociada</option>
              {mantencionesDisponibles.map((mantencion) => <option key={mantencion.id} value={mantencion.id}>{getOptionLabel(mantencion)}</option>)}
            </select>
          </label>

          <label className="text-[0.85rem] font-medium text-neutral-700">
            Incidente
            <select name="incidenteId" value={form.incidenteId} onChange={handleChange} className="input-base mt-1 block">
              <option value="">Sin incidente asociado</option>
              {incidentesDisponibles.map((incidente) => <option key={incidente.id} value={incidente.id}>{getOptionLabel(incidente)}</option>)}
            </select>
          </label>

          <div className="md:col-span-2">
            <label className="block text-[0.85rem] font-medium text-neutral-700">Equipos</label>
            <div className="mt-2 grid grid-cols-1 gap-2 rounded-xl border border-neutral-200 bg-neutral-50 p-3 md:grid-cols-2">
              {equiposDisponibles.length > 0 ? (
                equiposDisponibles.map((equipo) => (
                  <label key={equipo.id} className="flex items-center gap-2 text-[0.9rem] text-neutral-700">
                    <input type="checkbox" checked={form.equipoIds.includes(equipo.id)} onChange={() => handleEquipoToggle(equipo.id)} />
                    <span>{getOptionLabel(equipo)}</span>
                  </label>
                ))
              ) : (
                <p className="text-[0.85rem] text-neutral-500">No hay equipos para este cliente.</p>
              )}
            </div>
          </div>

          <label className="text-[0.85rem] font-medium text-neutral-700">
            Tecnico
            <select name="tecnicoId" value={form.tecnicoId} onChange={handleChange} required className="input-base mt-1 block">
              <option value="">Seleccionar tecnico</option>
              {options.tecnicos.map((tecnico) => <option key={tecnico.id} value={tecnico.id}>{tecnico.nombre}</option>)}
            </select>
          </label>

          <label className="text-[0.85rem] font-medium text-neutral-700">
            Comercial
            <select name="vendedorId" value={form.vendedorId} onChange={handleChange} className="input-base mt-1 block">
              <option value="">Sin comercial</option>
              {options.vendedores.map((vendedor) => <option key={vendedor.id} value={vendedor.id}>{vendedor.nombre}</option>)}
            </select>
          </label>

          <label className="text-[0.85rem] font-medium text-neutral-700">
            Servicio
            <select name="servicioId" value={form.servicioId} onChange={handleChange} className="input-base mt-1 block">
              <option value="">Sin servicio catalogado</option>
              {options.servicios.map((servicio) => <option key={servicio.id} value={servicio.id}>{servicio.descripcion}</option>)}
            </select>
          </label>

          <label className="text-[0.85rem] font-medium text-neutral-700">
            Fecha
            <input type="datetime-local" name="fecha" value={form.fecha} onChange={handleChange} required className="input-base mt-1 block" />
          </label>

          <label className="text-[0.85rem] font-medium text-neutral-700 md:col-span-2">
            Trabajo realizado
            <textarea name="descripcion" value={form.descripcion} onChange={handleChange} className="input-base mt-1 block min-h-28" />
          </label>

          <label className="text-[0.85rem] font-medium text-neutral-700">
            Resultado
            <textarea name="resultado" value={form.resultado} onChange={handleChange} className="input-base mt-1 block min-h-24" />
          </label>

          <label className="text-[0.85rem] font-medium text-neutral-700">
            Recomendaciones
            <textarea name="recomendaciones" value={form.recomendaciones} onChange={handleChange} className="input-base mt-1 block min-h-24" />
          </label>

          <label className="text-[0.85rem] font-medium text-neutral-700 md:col-span-2">
            Imagenes de la visita
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={(event) => setFiles(Array.from(event.target.files || []))}
              className="input-base mt-1 block"
            />
          </label>

          <button disabled={saving} type="submit" className="w-full rounded-xl bg-neutral-900 px-4 py-2 text-[0.92rem] font-medium text-white transition hover:bg-neutral-700 disabled:cursor-not-allowed disabled:opacity-60 md:col-span-2">
            {saving ? 'Guardando...' : 'Crear visita'}
          </button>
        </form>
      </div>
    </div>
  );
}
