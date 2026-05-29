'use client';

import { useEffect, useMemo, useState } from 'react';

const money = (value) => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(value || 0);

const emptyItem = {
  descripcion: '',
  cantidad: 1,
  precioUnitario: 0,
  descuentoPct: 0,
  servicioId: '',
  equipoId: '',
};

export default function CotizacionesPage() {
  const [cotizaciones, setCotizaciones] = useState([]);
  const [options, setOptions] = useState({ clientes: [], vendedores: [], servicios: [], equipos: [] });
  const [mailTo, setMailTo] = useState('');
  const [mailingId, setMailingId] = useState(null);
  const [form, setForm] = useState({
    clienteId: '',
    vendedorId: '',
    validaHasta: '',
    observaciones: '',
    items: [{ ...emptyItem }],
  });

  const loadData = async () => {
    const [cotizacionesRes, clientesRes, vendedoresRes, serviciosRes, equiposRes] = await Promise.all([
      fetch('/api/cotizaciones'),
      fetch('/api/clientes'),
      fetch('/api/vendedores'),
      fetch('/api/servicios'),
      fetch('/api/equipos'),
    ]);

    setCotizaciones(await cotizacionesRes.json());
    setOptions({
      clientes: await clientesRes.json(),
      vendedores: await vendedoresRes.json(),
      servicios: await serviciosRes.json(),
      equipos: await equiposRes.json(),
    });
  };

  useEffect(() => {
    loadData().catch((error) => console.error('Error cargando cotizaciones:', error));
  }, []);

  const totals = useMemo(() => {
    const subtotal = form.items.reduce((sum, item) => {
      const cantidad = Number(item.cantidad || 0);
      const precio = Number(item.precioUnitario || 0);
      const descuento = Number(item.descuentoPct || 0);
      return sum + Math.round(cantidad * precio * (1 - descuento / 100));
    }, 0);
    const impuesto = Math.round(subtotal * 0.19);
    return { subtotal, impuesto, total: subtotal + impuesto };
  }, [form.items]);

  const updateItem = (index, field, value) => {
    setForm((prev) => ({
      ...prev,
      items: prev.items.map((item, itemIndex) => itemIndex === index ? { ...item, [field]: value } : item),
    }));
  };

  const addItem = () => {
    setForm((prev) => ({ ...prev, items: [...prev.items, { ...emptyItem }] }));
  };

  const removeItem = (index) => {
    setForm((prev) => ({ ...prev, items: prev.items.filter((_, itemIndex) => itemIndex !== index) }));
  };

  const createCotizacion = async (event) => {
    event.preventDefault();
    const payload = {
      ...form,
      clienteId: Number(form.clienteId),
      vendedorId: form.vendedorId ? Number(form.vendedorId) : null,
      fecha: new Date().toISOString(),
      estado: 'borrador',
      moneda: 'CLP',
      descuentoGlobalPct: 0,
      impuestoPct: 19,
      validaHasta: form.validaHasta || null,
      items: form.items.map((item, index) => ({
        ...item,
        cantidad: Number(item.cantidad || 0),
        precioUnitario: Number(item.precioUnitario || 0),
        descuentoPct: Number(item.descuentoPct || 0),
        servicioId: item.servicioId ? Number(item.servicioId) : null,
        equipoId: item.equipoId ? Number(item.equipoId) : null,
        orden: index + 1,
      })),
    };

    const res = await fetch('/api/cotizaciones', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      alert('No se pudo crear la cotización.');
      return;
    }

    setForm({ clienteId: '', vendedorId: '', validaHasta: '', observaciones: '', items: [{ ...emptyItem }] });
    await loadData();
  };

  const exportPdf = async (cotizacion) => {
    const res = await fetch(`/api/cotizaciones/${cotizacion.id}/pdf`);
    if (!res.ok) {
      alert('No se pudo exportar el PDF.');
      return;
    }

    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `cotizacion_${cotizacion.numero || cotizacion.id}.pdf`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const sendMail = async (cotizacion) => {
    if (!mailTo) {
      alert('Ingresa un destinatario.');
      return;
    }

    setMailingId(cotizacion.id);
    try {
      const res = await fetch(`/api/cotizaciones/${cotizacion.id}/email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: mailTo }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'No se pudo enviar.');
      alert('Correo enviado correctamente.');
    } catch (error) {
      alert(error.message);
    } finally {
      setMailingId(null);
    }
  };

  return (
    <div className="min-h-screen p-6 md:p-8">
      <div className="mx-auto grid max-w-7xl gap-6 xl:grid-cols-[1fr_420px]">
        <section className="space-y-6">
          <header className="panel p-6">
            <p className="text-[0.82rem] uppercase tracking-[0.16em] text-neutral-500">Comercial</p>
            <h1 className="mt-1 text-[1.6rem] font-semibold text-neutral-900">Cotizaciones</h1>
          </header>

          <section className="panel p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-[1.05rem] font-semibold text-neutral-900">Listado</h2>
              <input value={mailTo} onChange={(event) => setMailTo(event.target.value)} className="input-base max-w-sm" placeholder="destinatario@cliente.cl" />
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr className="bg-neutral-100/80">
                    <th className="px-3 py-2 text-left text-[0.78rem] uppercase text-neutral-600">Número</th>
                    <th className="px-3 py-2 text-left text-[0.78rem] uppercase text-neutral-600">Cliente</th>
                    <th className="px-3 py-2 text-left text-[0.78rem] uppercase text-neutral-600">Estado</th>
                    <th className="px-3 py-2 text-left text-[0.78rem] uppercase text-neutral-600">Total</th>
                    <th className="px-3 py-2 text-left text-[0.78rem] uppercase text-neutral-600">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {cotizaciones.map((cotizacion) => (
                    <tr key={cotizacion.id} className="border-t border-neutral-200">
                      <td className="px-3 py-2 text-[0.88rem]">{cotizacion.numero}</td>
                      <td className="px-3 py-2 text-[0.88rem]">{cotizacion.cliente?.nombre || '-'}</td>
                      <td className="px-3 py-2 text-[0.88rem]">{cotizacion.estado}</td>
                      <td className="px-3 py-2 text-[0.88rem]">{money(cotizacion.total)}</td>
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap gap-2">
                          <button onClick={() => exportPdf(cotizacion)} className="rounded-lg bg-neutral-900 px-3 py-1.5 text-[0.78rem] font-medium text-white">PDF</button>
                          <button onClick={() => sendMail(cotizacion)} disabled={mailingId === cotizacion.id} className="rounded-lg bg-emerald-700 px-3 py-1.5 text-[0.78rem] font-medium text-white disabled:opacity-60">
                            {mailingId === cotizacion.id ? 'Enviando' : 'Mail'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </section>

        <aside className="panel h-fit p-5">
          <h2 className="mb-4 text-[1.05rem] font-semibold text-neutral-900">Nueva cotización</h2>
          <form onSubmit={createCotizacion} className="space-y-4">
            <label className="block text-[0.85rem] font-medium text-neutral-700">
              Cliente
              <select value={form.clienteId} onChange={(event) => setForm((prev) => ({ ...prev, clienteId: event.target.value }))} className="input-base mt-1" required>
                <option value="">Seleccionar</option>
                {options.clientes.map((cliente) => <option key={cliente.id} value={cliente.id}>{cliente.nombre}</option>)}
              </select>
            </label>
            <label className="block text-[0.85rem] font-medium text-neutral-700">
              Vendedor
              <select value={form.vendedorId} onChange={(event) => setForm((prev) => ({ ...prev, vendedorId: event.target.value }))} className="input-base mt-1">
                <option value="">Sin asignar</option>
                {options.vendedores.map((vendedor) => <option key={vendedor.id} value={vendedor.id}>{vendedor.nombre}</option>)}
              </select>
            </label>
            <label className="block text-[0.85rem] font-medium text-neutral-700">
              Válida hasta
              <input type="date" value={form.validaHasta} onChange={(event) => setForm((prev) => ({ ...prev, validaHasta: event.target.value }))} className="input-base mt-1" />
            </label>

            <div className="space-y-3">
              {form.items.map((item, index) => (
                <div key={index} className="rounded-lg border border-neutral-200 bg-neutral-50 p-3">
                  <input value={item.descripcion} onChange={(event) => updateItem(index, 'descripcion', event.target.value)} className="input-base" placeholder="Descripción" required />
                  <div className="mt-2 grid grid-cols-3 gap-2">
                    <input type="number" value={item.cantidad} onChange={(event) => updateItem(index, 'cantidad', event.target.value)} className="input-base" min="0" step="1" required />
                    <input type="number" value={item.precioUnitario} onChange={(event) => updateItem(index, 'precioUnitario', event.target.value)} className="input-base" min="0" step="1000" required />
                    <input type="number" value={item.descuentoPct} onChange={(event) => updateItem(index, 'descuentoPct', event.target.value)} className="input-base" min="0" max="100" step="1" />
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <select value={item.servicioId} onChange={(event) => updateItem(index, 'servicioId', event.target.value)} className="input-base">
                      <option value="">Servicio</option>
                      {options.servicios.map((servicio) => <option key={servicio.id} value={servicio.id}>{servicio.descripcion}</option>)}
                    </select>
                    <select value={item.equipoId} onChange={(event) => updateItem(index, 'equipoId', event.target.value)} className="input-base">
                      <option value="">Equipo</option>
                      {options.equipos.map((equipo) => <option key={equipo.id} value={equipo.id}>{equipo.nombre} {equipo.serial}</option>)}
                    </select>
                  </div>
                  {form.items.length > 1 ? (
                    <button type="button" onClick={() => removeItem(index)} className="mt-2 text-[0.82rem] font-medium text-rose-700">Eliminar línea</button>
                  ) : null}
                </div>
              ))}
              <button type="button" onClick={addItem} className="rounded-lg border border-neutral-300 px-3 py-2 text-[0.86rem] font-medium text-neutral-800">Agregar línea</button>
            </div>

            <label className="block text-[0.85rem] font-medium text-neutral-700">
              Observaciones
              <textarea value={form.observaciones} onChange={(event) => setForm((prev) => ({ ...prev, observaciones: event.target.value }))} className="input-base mt-1 min-h-20" />
            </label>

            <div className="rounded-lg bg-neutral-100 p-3 text-[0.88rem] text-neutral-700">
              <div className="flex justify-between"><span>Subtotal</span><strong>{money(totals.subtotal)}</strong></div>
              <div className="flex justify-between"><span>IVA</span><strong>{money(totals.impuesto)}</strong></div>
              <div className="mt-2 flex justify-between text-neutral-900"><span>Total</span><strong>{money(totals.total)}</strong></div>
            </div>

            <button type="submit" className="w-full rounded-lg bg-neutral-900 px-4 py-2.5 text-[0.92rem] font-semibold text-white">Guardar cotización</button>
          </form>
        </aside>
      </div>
    </div>
  );
}
