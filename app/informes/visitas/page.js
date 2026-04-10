'use client';

import { useEffect, useMemo, useState } from 'react';

export default function InformeVisitasPage() {
  const [filtros, setFiltros] = useState({ desde: '', hasta: '', estado: 'todos', clienteId: '' });
  const [clientes, setClientes] = useState([]);
  const [resultado, setResultado] = useState({ total: 0, visitas: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadInitialData = async () => {
      const clientesRes = await fetch('/api/clientes');
      const clientesData = await clientesRes.json();
      setClientes(Array.isArray(clientesData) ? clientesData : []);
    };

    loadInitialData();
  }, []);

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    if (filtros.desde) params.set('desde', filtros.desde);
    if (filtros.hasta) params.set('hasta', filtros.hasta);
    if (filtros.estado) params.set('estado', filtros.estado);
    if (filtros.clienteId) params.set('clienteId', filtros.clienteId);
    return params.toString();
  }, [filtros]);

  useEffect(() => {
    const fetchInforme = async () => {
      setLoading(true);
      const res = await fetch(`/api/informes/visitas?${queryString}`);
      const data = await res.json();
      setResultado({ total: data.total || 0, visitas: data.visitas || [] });
      setLoading(false);
    };

    fetchInforme();
  }, [queryString]);

  const exportCsv = () => {
    const headers = ['Fecha', 'Cliente', 'Equipo', 'Técnico', 'Servicio', 'Estado'];
    const rows = resultado.visitas.map((v) => [
      new Date(v.fecha).toLocaleString('es-CL'),
      v.cliente?.nombre || '-',
      v.equipo?.nombre || '-',
      v.tecnico?.nombre || '-',
      v.servicio?.descripcion || '-',
      v.estado || '-',
    ]);

    const csvContent = [headers, ...rows]
      .map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `informe_visitas_${Date.now()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen p-6 md:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="panel p-6">
          <p className="text-[0.85rem] uppercase tracking-[0.18em] text-neutral-500">Informe 1</p>
          <h1 className="mt-1 text-[1.6rem] font-semibold text-neutral-900">Informe de Visitas</h1>
          <p className="mt-2 text-[0.92rem] text-neutral-600">Puedes emitir este informe todas las veces que quieras aplicando filtros por fecha, cliente y estado.</p>
        </section>

        <section className="panel p-5">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
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
            <label className="text-[0.85rem] text-neutral-700">
              Estado
              <select
                value={filtros.estado}
                onChange={(e) => setFiltros((prev) => ({ ...prev, estado: e.target.value }))}
                className="input-base mt-1"
              >
                <option value="todos">Todos</option>
                <option value="pendiente">Pendiente</option>
                <option value="en_progreso">En progreso</option>
                <option value="completada">Completada</option>
                <option value="cancelada">Cancelada</option>
              </select>
            </label>
            <label className="text-[0.85rem] text-neutral-700 md:col-span-2">
              Cliente
              <select
                value={filtros.clienteId}
                onChange={(e) => setFiltros((prev) => ({ ...prev, clienteId: e.target.value }))}
                className="input-base mt-1"
              >
                <option value="">Todos los clientes</option>
                {clientes.map((cliente) => (
                  <option key={cliente.id} value={cliente.id}>{cliente.nombre}</option>
                ))}
              </select>
            </label>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <button onClick={() => window.print()} className="rounded-xl bg-neutral-900 px-4 py-2 text-[0.9rem] font-medium text-white hover:bg-neutral-700">Imprimir</button>
            <button onClick={exportCsv} className="rounded-xl bg-emerald-700 px-4 py-2 text-[0.9rem] font-medium text-white hover:bg-emerald-600">Exportar CSV</button>
          </div>
        </section>

        <section className="panel p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-[1.05rem] font-semibold text-neutral-900">Resultados</h2>
            <span className="text-[0.9rem] text-neutral-600">Total registros: {resultado.total}</span>
          </div>
          {loading ? (
            <p className="text-[0.9rem] text-neutral-600">Cargando...</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr className="bg-neutral-100/80">
                    <th className="px-3 py-2 text-left text-[0.8rem] uppercase text-neutral-600">Fecha</th>
                    <th className="px-3 py-2 text-left text-[0.8rem] uppercase text-neutral-600">Cliente</th>
                    <th className="px-3 py-2 text-left text-[0.8rem] uppercase text-neutral-600">Equipo</th>
                    <th className="px-3 py-2 text-left text-[0.8rem] uppercase text-neutral-600">Técnico</th>
                    <th className="px-3 py-2 text-left text-[0.8rem] uppercase text-neutral-600">Servicio</th>
                    <th className="px-3 py-2 text-left text-[0.8rem] uppercase text-neutral-600">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {resultado.visitas.map((v) => (
                    <tr key={v.id} className="border-t border-neutral-200">
                      <td className="px-3 py-2 text-[0.88rem]">{new Date(v.fecha).toLocaleString('es-CL')}</td>
                      <td className="px-3 py-2 text-[0.88rem]">{v.cliente?.nombre || '-'}</td>
                      <td className="px-3 py-2 text-[0.88rem]">{v.equipo?.nombre || '-'}</td>
                      <td className="px-3 py-2 text-[0.88rem]">{v.tecnico?.nombre || '-'}</td>
                      <td className="px-3 py-2 text-[0.88rem]">{v.servicio?.descripcion || '-'}</td>
                      <td className="px-3 py-2 text-[0.88rem]">{v.estado || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
