'use client';

import { useState, useEffect } from 'react';

export default function NuevaVisita() {
  const [form, setForm] = useState({
    clienteId: '',
    equipoId: '',
    tecnicoId: '',
    vendedorId: '',
    servicioId: '',
    fecha: '',
    descripcion: '',
    estado: 'pendiente',
  });
  const [options, setOptions] = useState({
    clientes: [],
    equipos: [],
    tecnicos: [],
    vendedores: [],
    servicios: [],
  });

  useEffect(() => {
    const fetchOptions = async () => {
      try {
        const [clientesRes, equiposRes, tecnicosRes, vendedoresRes, serviciosRes] = await Promise.all([
          fetch('/api/clientes'),
          fetch('/api/equipos'),
          fetch('/api/tecnicos'),
          fetch('/api/vendedores'),
          fetch('/api/servicios'),
        ]);
        setOptions({
          clientes: await clientesRes.json(),
          equipos: await equiposRes.json(),
          tecnicos: await tecnicosRes.json(),
          vendedores: await vendedoresRes.json(),
          servicios: await serviciosRes.json(),
        });
      } catch (error) {
        console.error('Error fetching options:', error);
      }
    };
    fetchOptions();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/visitas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          clienteId: parseInt(form.clienteId),
          equipoId: form.equipoId ? parseInt(form.equipoId) : null,
          tecnicoId: parseInt(form.tecnicoId),
          vendedorId: form.vendedorId ? parseInt(form.vendedorId) : null,
          servicioId: parseInt(form.servicioId),
          fecha: new Date(form.fecha),
        }),
      });
      if (res.ok) {
        alert('Visita creada exitosamente');
        setForm({
          clienteId: '',
          equipoId: '',
          tecnicoId: '',
          vendedorId: '',
          servicioId: '',
          fecha: '',
          descripcion: '',
          estado: 'pendiente',
        });
      } else {
        alert('Error al crear visita');
      }
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  return (
    <div className="min-h-screen p-6 md:p-8">
      <div className="max-w-2xl mx-auto">
        <div className="panel mb-6 p-6">
          <p className="text-[0.85rem] uppercase tracking-[0.18em] text-neutral-500">Operación</p>
          <h1 className="mt-1 text-[1.65rem] font-semibold text-neutral-900">Nueva Visita / Servicio</h1>
        </div>
        <form onSubmit={handleSubmit} className="panel space-y-4 p-6">
          <div>
            <label className="block text-[0.85rem] font-medium text-neutral-700">Cliente</label>
            <select name="clienteId" value={form.clienteId} onChange={handleChange} required className="input-base mt-1 block">
              <option value="">Seleccionar Cliente</option>
              {options.clientes.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[0.85rem] font-medium text-neutral-700">Equipo (opcional)</label>
            <select name="equipoId" value={form.equipoId} onChange={handleChange} className="input-base mt-1 block">
              <option value="">Seleccionar Equipo</option>
              {options.equipos.map(e => <option key={e.id} value={e.id}>{e.nombre} - {e.serial}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[0.85rem] font-medium text-neutral-700">Técnico</label>
            <select name="tecnicoId" value={form.tecnicoId} onChange={handleChange} required className="input-base mt-1 block">
              <option value="">Seleccionar Técnico</option>
              {options.tecnicos.map(t => <option key={t.id} value={t.id}>{t.nombre}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[0.85rem] font-medium text-neutral-700">Vendedor (opcional)</label>
            <select name="vendedorId" value={form.vendedorId} onChange={handleChange} className="input-base mt-1 block">
              <option value="">Seleccionar Vendedor</option>
              {options.vendedores.map(v => <option key={v.id} value={v.id}>{v.nombre}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[0.85rem] font-medium text-neutral-700">Servicio</label>
            <select name="servicioId" value={form.servicioId} onChange={handleChange} required className="input-base mt-1 block">
              <option value="">Seleccionar Servicio</option>
              {options.servicios.map(s => <option key={s.id} value={s.id}>{s.descripcion}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[0.85rem] font-medium text-neutral-700">Fecha</label>
            <input type="datetime-local" name="fecha" value={form.fecha} onChange={handleChange} required className="input-base mt-1 block" />
          </div>
          <div>
            <label className="block text-[0.85rem] font-medium text-neutral-700">Descripción</label>
            <textarea name="descripcion" value={form.descripcion} onChange={handleChange} className="input-base mt-1 block min-h-28"></textarea>
          </div>
          <button type="submit" className="w-full rounded-xl bg-neutral-900 px-4 py-2 text-[0.92rem] font-medium text-white transition hover:bg-neutral-700">Crear Visita</button>
        </form>
      </div>
    </div>
  );
}