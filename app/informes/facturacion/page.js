'use client';

import { useEffect, useMemo, useState } from 'react';

const money = (value) => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(value || 0);

export default function InformeFacturacionPage() {
  const [filtros, setFiltros] = useState({ desde: '', hasta: '' });
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({ totalServicios: 0, totalFacturado: 0, porServicio: [], porCliente: [] });

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    if (filtros.desde) params.set('desde', filtros.desde);
    if (filtros.hasta) params.set('hasta', filtros.hasta);
    return params.toString();
  }, [filtros]);

  useEffect(() => {
    const fetchInforme = async () => {
      setLoading(true);
      const res = await fetch(`/api/informes/facturacion?${queryString}`);
      const result = await res.json();
      setData({
        totalServicios: result.totalServicios || 0,
        totalFacturado: result.totalFacturado || 0,
        porServicio: result.porServicio || [],
        porCliente: result.porCliente || [],
      });
      setLoading(false);
    };

    fetchInforme();
  }, [queryString]);

  const exportCsv = () => {
    const headers = ['Tipo', 'Nombre', 'Cantidad', 'Total'];
    const rowsServicio = data.porServicio.map((item) => ['Servicio', item.servicio, item.cantidad, item.total]);
    const rowsCliente = data.porCliente.map((item) => ['Cliente', item.cliente, item.cantidad, item.total]);
    const csvContent = [headers, ...rowsServicio, ...rowsCliente]
      .map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `informe_facturacion_${Date.now()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen p-6 md:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="panel p-6">
          <p className="text-[0.85rem] uppercase tracking-[0.18em] text-neutral-500">Informe 2</p>
          <h1 className="mt-1 text-[1.6rem] font-semibold text-neutral-900">Informe de Servicios y Facturación</h1>
          <p className="mt-2 text-[0.92rem] text-neutral-600">Consolida cantidad de servicios ejecutados e ingreso estimado por servicio y por cliente.</p>
        </section>

        <section className="panel p-5">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
            <label className="text-[0.85rem] text-neutral-700">
              Desde
              <input
                type="date"
                value={filtros.desde}
                onChange={(e) => setFiltros((prev) => ({ ...prev, desde: e.target.value }))}
                className="input-base mt-1"
              />
            </label>
            <label className="text-[0.85rem] text-neutral-700">
              Hasta
              <input
                type="date"
                value={filtros.hasta}
                onChange={(e) => setFiltros((prev) => ({ ...prev, hasta: e.target.value }))}
                className="input-base mt-1"
              />
            </label>
            <div className="md:col-span-2 flex items-end gap-2">
              <button onClick={() => window.print()} className="rounded-xl bg-neutral-900 px-4 py-2 text-[0.9rem] font-medium text-white hover:bg-neutral-700">Imprimir</button>
              <button onClick={exportCsv} className="rounded-xl bg-emerald-700 px-4 py-2 text-[0.9rem] font-medium text-white hover:bg-emerald-600">Exportar CSV</button>
            </div>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <article className="panel p-5">
            <p className="text-[0.85rem] uppercase tracking-wide text-neutral-500">Servicios Ejecutados</p>
            <p className="mt-2 text-[1.85rem] font-semibold text-neutral-900">{data.totalServicios}</p>
          </article>
          <article className="panel p-5">
            <p className="text-[0.85rem] uppercase tracking-wide text-neutral-500">Facturación Estimada</p>
            <p className="mt-2 text-[1.85rem] font-semibold text-neutral-900">{money(data.totalFacturado)}</p>
          </article>
        </section>

        <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <article className="panel p-5">
            <h2 className="mb-3 text-[1.05rem] font-semibold text-neutral-900">Detalle por servicio</h2>
            {loading ? (
              <p className="text-[0.9rem] text-neutral-600">Cargando...</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full">
                  <thead>
                    <tr className="bg-neutral-100/80">
                      <th className="px-3 py-2 text-left text-[0.8rem] uppercase text-neutral-600">Servicio</th>
                      <th className="px-3 py-2 text-left text-[0.8rem] uppercase text-neutral-600">Cantidad</th>
                      <th className="px-3 py-2 text-left text-[0.8rem] uppercase text-neutral-600">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.porServicio.map((item) => (
                      <tr key={item.servicio} className="border-t border-neutral-200">
                        <td className="px-3 py-2 text-[0.88rem]">{item.servicio}</td>
                        <td className="px-3 py-2 text-[0.88rem]">{item.cantidad}</td>
                        <td className="px-3 py-2 text-[0.88rem]">{money(item.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </article>

          <article className="panel p-5">
            <h2 className="mb-3 text-[1.05rem] font-semibold text-neutral-900">Detalle por cliente</h2>
            {loading ? (
              <p className="text-[0.9rem] text-neutral-600">Cargando...</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full">
                  <thead>
                    <tr className="bg-neutral-100/80">
                      <th className="px-3 py-2 text-left text-[0.8rem] uppercase text-neutral-600">Cliente</th>
                      <th className="px-3 py-2 text-left text-[0.8rem] uppercase text-neutral-600">Cantidad</th>
                      <th className="px-3 py-2 text-left text-[0.8rem] uppercase text-neutral-600">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.porCliente.map((item) => (
                      <tr key={item.cliente} className="border-t border-neutral-200">
                        <td className="px-3 py-2 text-[0.88rem]">{item.cliente}</td>
                        <td className="px-3 py-2 text-[0.88rem]">{item.cantidad}</td>
                        <td className="px-3 py-2 text-[0.88rem]">{money(item.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </article>
        </section>
      </div>
    </div>
  );
}
