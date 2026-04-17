'use client';

import Image from 'next/image';
import { useEffect, useMemo, useState } from 'react';

export default function InformeVisitasPage() {
  const [filtros, setFiltros] = useState({ desde: '', hasta: '', estado: 'todos', clienteId: '' });
  const [clientes, setClientes] = useState([]);
  const [resultado, setResultado] = useState({ total: 0, visitas: [], productos: [] });
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [mailForm, setMailForm] = useState({ to: '', cc: '', audience: 'interno' });
  const [mailStatus, setMailStatus] = useState('');

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
      setResultado({ total: data.total || 0, visitas: data.visitas || [], productos: data.productos || [] });
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

  const exportPdf = async () => {
    const res = await fetch(`/api/informes/visitas/pdf?${queryString}`);
    if (!res.ok) {
      alert('No se pudo generar el PDF');
      return;
    }

    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `informe_visitas_${Date.now()}.pdf`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const sendMail = async () => {
    setSending(true);
    setMailStatus('');

    try {
      const res = await fetch('/api/informes/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reportType: 'visitas',
          to: mailForm.to,
          cc: mailForm.cc,
          audience: mailForm.audience,
          ...filtros,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'No se pudo enviar el correo');
      }

      setMailStatus('Correo enviado correctamente.');
    } catch (error) {
      setMailStatus(error.message);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="min-h-screen p-6 md:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="panel p-6">
          <p className="text-[0.85rem] uppercase tracking-[0.18em] text-neutral-500">Informe 1</p>
          <h1 className="mt-1 text-[1.6rem] font-semibold text-neutral-900">Informe de Visitas</h1>
          <p className="mt-2 text-[0.92rem] text-neutral-600">Filtro por fecha/cliente/estado con salida CSV, PDF e integración de envío por MS Graph en HTML con adjunto.</p>
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
            <button onClick={exportPdf} className="rounded-xl bg-sky-700 px-4 py-2 text-[0.9rem] font-medium text-white hover:bg-sky-600">Exportar PDF</button>
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
                    <th className="px-3 py-2 text-left text-[0.8rem] uppercase text-neutral-600">Imagen</th>
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
                      <td className="px-3 py-2 text-[0.88rem]">
                        {v.equipo?.imagenUrl ? (
                          <Image src={v.equipo.imagenUrl} alt={v.equipo.nombre || 'Equipo'} width={120} height={70} className="h-14 w-24 rounded-md border border-neutral-200 object-contain" />
                        ) : (
                          '-'
                        )}
                      </td>
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

        <section className="panel p-5">
          <h2 className="mb-3 text-[1.05rem] font-semibold text-neutral-900">Enviar Informe por Correo (MS Graph)</h2>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
            <label className="text-[0.85rem] text-neutral-700 md:col-span-2">
              Para
              <input type="text" value={mailForm.to} onChange={(e) => setMailForm((prev) => ({ ...prev, to: e.target.value }))} className="input-base mt-1" placeholder="correo1@cliente.cl, correo2@cliente.cl" />
            </label>
            <label className="text-[0.85rem] text-neutral-700 md:col-span-2">
              CC
              <input type="text" value={mailForm.cc} onChange={(e) => setMailForm((prev) => ({ ...prev, cc: e.target.value }))} className="input-base mt-1" placeholder="interno@cmcing.cl" />
            </label>
            <label className="text-[0.85rem] text-neutral-700">
              Tipo destinatario
              <select value={mailForm.audience} onChange={(e) => setMailForm((prev) => ({ ...prev, audience: e.target.value }))} className="input-base mt-1">
                <option value="interno">Interno</option>
                <option value="cliente_final">Cliente final</option>
              </select>
            </label>
            <div className="md:col-span-3 flex items-end">
              <button disabled={sending} onClick={sendMail} className="rounded-xl bg-indigo-700 px-4 py-2 text-[0.9rem] font-medium text-white transition hover:bg-indigo-600 disabled:cursor-not-allowed disabled:opacity-60">
                {sending ? 'Enviando...' : 'Enviar correo con PDF adjunto'}
              </button>
            </div>
          </div>
          {mailStatus ? <p className="mt-3 text-[0.9rem] text-neutral-700">{mailStatus}</p> : null}
        </section>
      </div>
    </div>
  );
}
