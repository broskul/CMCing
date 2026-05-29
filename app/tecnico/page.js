'use client';

import Image from 'next/image';
import { useCallback, useEffect, useRef, useState } from 'react';
import { deleteSyncJob, enqueueSyncJob, listSyncJobs, updateSyncJob } from '../lib/offline-queue';

const emptyForm = {
  clienteId: '',
  equipoIds: [],
  tecnicoId: '',
  servicioId: '',
  fecha: '',
  descripcion: '',
  firmaTexto: '',
  attachments: [],
  selfieDataUrl: '',
};

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export default function TecnicoPage() {
  const [form, setForm] = useState(emptyForm);
  const [options, setOptions] = useState({ clientes: [], equipos: [], tecnicos: [], servicios: [] });
  const [online, setOnline] = useState(true);
  const [queue, setQueue] = useState([]);
  const [syncing, setSyncing] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [message, setMessage] = useState('');
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const canvasRef = useRef(null);
  const drawingRef = useRef(false);
  const syncingRef = useRef(false);

  const refreshQueue = useCallback(async () => {
    const jobs = await listSyncJobs();
    setQueue(jobs);
  }, []);

  const loadOptions = useCallback(async () => {
    const [clientesRes, equiposRes, tecnicosRes, serviciosRes, sessionRes] = await Promise.all([
      fetch('/api/clientes'),
      fetch('/api/equipos'),
      fetch('/api/tecnicos'),
      fetch('/api/servicios'),
      fetch('/api/auth/session').catch(() => null),
    ]);

    const [clientes, equipos, tecnicos, servicios] = await Promise.all([
      clientesRes.json(),
      equiposRes.json(),
      tecnicosRes.json(),
      serviciosRes.json(),
    ]);
    const session = sessionRes?.ok ? await sessionRes.json() : { user: null };

    const tecnicoId = session.user?.tecnicoId || tecnicos[0]?.id || '';
    const tecnico = tecnicos.find((item) => Number(item.id) === Number(tecnicoId));

    setOptions({ clientes, equipos, tecnicos, servicios });
    setForm((prev) => ({
      ...prev,
      tecnicoId: prev.tecnicoId || tecnicoId,
      firmaTexto: prev.firmaTexto || tecnico?.firmaTexto || tecnico?.nombre || '',
      fecha: prev.fecha || new Date().toISOString().slice(0, 16),
    }));
  }, []);

  const syncPending = useCallback(async () => {
    if (!navigator.onLine || syncingRef.current) return;

    syncingRef.current = true;
    setSyncing(true);
    setMessage('');

    try {
      const jobs = await listSyncJobs();
      for (const job of jobs) {
        if (job.status === 'synced') continue;
        await updateSyncJob(job.id, { status: 'syncing', attempts: (job.attempts || 0) + 1, error: '' });

        const res = await fetch('/api/tecnico/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(job.payload),
        });
        const data = await res.json();

        if (!res.ok) {
          await updateSyncJob(job.id, { status: 'error', error: data.error || 'Error de sincronización' });
          continue;
        }

        await deleteSyncJob(job.id);
      }

      await refreshQueue();
    } finally {
      syncingRef.current = false;
      setSyncing(false);
    }
  }, [refreshQueue]);

  useEffect(() => {
    setOnline(navigator.onLine);
    loadOptions().catch((error) => console.error('Error cargando app técnico:', error));
    refreshQueue().catch((error) => console.error('Error cargando cola:', error));

    const handleOnline = () => {
      setOnline(true);
      syncPending();
    };
    const handleOffline = () => setOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, [loadOptions, refreshQueue, syncPending]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const setupCanvas = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = rect.width * dpr;
      canvas.height = 160 * dpr;
      const context = canvas.getContext('2d');
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      context.lineWidth = 2.2;
      context.lineCap = 'round';
      context.strokeStyle = '#111827';
    };

    setupCanvas();
    window.addEventListener('resize', setupCanvas);
    return () => window.removeEventListener('resize', setupCanvas);
  }, []);

  const equiposDisponibles = form.clienteId
    ? options.equipos.filter((equipo) => String(equipo.clienteId) === String(form.clienteId))
    : options.equipos;

  const toggleEquipo = (equipoId) => {
    setForm((prev) => {
      const key = String(equipoId);
      const exists = prev.equipoIds.includes(key);
      return {
        ...prev,
        equipoIds: exists ? prev.equipoIds.filter((id) => id !== key) : [...prev.equipoIds, key],
      };
    });
  };

  const handleFiles = async (files) => {
    const attachments = await Promise.all(Array.from(files).map(async (file) => ({
      name: file.name,
      type: file.type,
      size: file.size,
      tipo: 'evidencia',
      dataUrl: await fileToDataUrl(file),
    })));

    setForm((prev) => ({ ...prev, attachments: [...prev.attachments, ...attachments] }));
  };

  const startCamera = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setMessage('Cámara no disponible en este dispositivo.');
      return null;
    }

    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'user' },
      audio: false,
    });
    streamRef.current = stream;
    if (videoRef.current) {
      videoRef.current.srcObject = stream;
      await videoRef.current.play();
    }
    setCameraActive(true);
    return stream;
  };

  const captureSelfie = async () => {
    if (!streamRef.current) {
      await startCamera();
      await new Promise((resolve) => setTimeout(resolve, 700));
    }

    const video = videoRef.current;
    if (!video || !video.videoWidth) return '';

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext('2d');
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.86);
    setForm((prev) => ({ ...prev, selfieDataUrl: dataUrl }));
    return dataUrl;
  };

  const getCanvasPoint = (event) => {
    const rect = canvasRef.current.getBoundingClientRect();
    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    };
  };

  const startDrawing = (event) => {
    drawingRef.current = true;
    const point = getCanvasPoint(event);
    const context = canvasRef.current.getContext('2d');
    context.beginPath();
    context.moveTo(point.x, point.y);
  };

  const draw = (event) => {
    if (!drawingRef.current) return;
    const point = getCanvasPoint(event);
    const context = canvasRef.current.getContext('2d');
    context.lineTo(point.x, point.y);
    context.stroke();
  };

  const stopDrawing = () => {
    drawingRef.current = false;
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');
    context.clearRect(0, 0, canvas.width, canvas.height);
  };

  const saveService = async (event) => {
    event.preventDefault();
    const signedAt = new Date().toISOString();
    let selfieDataUrl = '';
    try {
      selfieDataUrl = await captureSelfie();
    } catch (error) {
      setMessage(`No se pudo capturar la foto frontal: ${error.message}`);
      return;
    }
    if (!selfieDataUrl) {
      setMessage('La foto frontal es requerida para firmar.');
      return;
    }
    const firmaImagenDataUrl = canvasRef.current.toDataURL('image/png');
    const clientMutationId = crypto.randomUUID();

    await enqueueSyncJob({
      ...form,
      clientMutationId,
      equipoIds: form.equipoIds.map((id) => Number(id)),
      tecnicoId: Number(form.tecnicoId),
      clienteId: Number(form.clienteId),
      servicioId: Number(form.servicioId),
      fecha: form.fecha ? new Date(form.fecha).toISOString() : signedAt,
      signedAt,
      firmaImagenDataUrl,
      selfieDataUrl,
      createdAt: signedAt,
    });

    setForm((prev) => ({
      ...emptyForm,
      tecnicoId: prev.tecnicoId,
      firmaTexto: prev.firmaTexto,
      fecha: new Date().toISOString().slice(0, 16),
    }));
    clearSignature();
    await refreshQueue();
    setMessage('Servicio guardado en cola.');
    syncPending();
  };

  return (
    <div className="min-h-screen p-4 md:p-8">
      <div className="mx-auto max-w-5xl space-y-5">
        <header className="panel flex flex-wrap items-center justify-between gap-3 p-5">
          <div>
            <p className="text-[0.82rem] uppercase tracking-[0.16em] text-neutral-500">Técnico</p>
            <h1 className="mt-1 text-[1.45rem] font-semibold text-neutral-900">Ingreso de servicio</h1>
          </div>
          <div className="flex items-center gap-2">
            <span className={`rounded-full px-3 py-1 text-[0.78rem] font-semibold ${online ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
              {online ? 'Online' : 'Offline'}
            </span>
            <button type="button" onClick={syncPending} disabled={!online || syncing} className="rounded-lg bg-neutral-900 px-3 py-2 text-[0.82rem] font-semibold text-white disabled:opacity-50">
              {syncing ? 'Sincronizando' : `Cola ${queue.length}`}
            </button>
          </div>
        </header>

        <form onSubmit={saveService} className="grid gap-5 lg:grid-cols-[1fr_320px]">
          <section className="panel space-y-4 p-5">
            <div className="grid gap-3 md:grid-cols-2">
              <label className="block text-[0.85rem] font-medium text-neutral-700">
                Técnico
                <select value={form.tecnicoId} onChange={(event) => setForm((prev) => ({ ...prev, tecnicoId: event.target.value }))} className="input-base mt-1" required>
                  <option value="">Seleccionar</option>
                  {options.tecnicos.map((tecnico) => <option key={tecnico.id} value={tecnico.id}>{tecnico.nombre}</option>)}
                </select>
              </label>
              <label className="block text-[0.85rem] font-medium text-neutral-700">
                Fecha
                <input type="datetime-local" value={form.fecha} onChange={(event) => setForm((prev) => ({ ...prev, fecha: event.target.value }))} className="input-base mt-1" required />
              </label>
              <label className="block text-[0.85rem] font-medium text-neutral-700">
                Cliente
                <select value={form.clienteId} onChange={(event) => setForm((prev) => ({ ...prev, clienteId: event.target.value, equipoIds: [] }))} className="input-base mt-1" required>
                  <option value="">Seleccionar</option>
                  {options.clientes.map((cliente) => <option key={cliente.id} value={cliente.id}>{cliente.nombre}</option>)}
                </select>
              </label>
              <label className="block text-[0.85rem] font-medium text-neutral-700">
                Servicio
                <select value={form.servicioId} onChange={(event) => setForm((prev) => ({ ...prev, servicioId: event.target.value }))} className="input-base mt-1" required>
                  <option value="">Seleccionar</option>
                  {options.servicios.map((servicio) => <option key={servicio.id} value={servicio.id}>{servicio.descripcion}</option>)}
                </select>
              </label>
            </div>

            <div>
              <p className="mb-2 text-[0.85rem] font-medium text-neutral-700">Equipos</p>
              <div className="grid max-h-44 gap-2 overflow-y-auto rounded-lg border border-neutral-200 bg-neutral-50 p-3">
                {equiposDisponibles.map((equipo) => (
                  <label key={equipo.id} className="flex items-center gap-2 text-[0.88rem] text-neutral-700">
                    <input type="checkbox" checked={form.equipoIds.includes(String(equipo.id))} onChange={() => toggleEquipo(equipo.id)} />
                    <span>{equipo.sku || equipo.codigoInterno || equipo.modelo} | {equipo.serial} | {equipo.nombre}</span>
                  </label>
                ))}
              </div>
            </div>

            <label className="block text-[0.85rem] font-medium text-neutral-700">
              Descripción
              <textarea value={form.descripcion} onChange={(event) => setForm((prev) => ({ ...prev, descripcion: event.target.value }))} className="input-base mt-1 min-h-36" required />
            </label>

            <div>
              <label className="block text-[0.85rem] font-medium text-neutral-700">
                Adjuntos
                <input type="file" accept="image/*,application/pdf" capture="environment" multiple onChange={(event) => handleFiles(event.target.files || [])} className="input-base mt-1" />
              </label>
              {form.attachments.length ? (
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {form.attachments.map((attachment, index) => (
                    <div key={`${attachment.name}-${index}`} className="rounded-lg border border-neutral-200 bg-white p-2 text-[0.82rem] text-neutral-700">
                      {attachment.name}
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          </section>

          <aside className="space-y-5">
            <section className="panel p-5">
              <h2 className="mb-3 text-[1rem] font-semibold text-neutral-900">Firma</h2>
              <input value={form.firmaTexto} onChange={(event) => setForm((prev) => ({ ...prev, firmaTexto: event.target.value }))} className="input-base mb-3" placeholder="Texto firma" required />
              <canvas
                ref={canvasRef}
                className="h-40 w-full touch-none rounded-lg border border-neutral-300 bg-white"
                onPointerDown={startDrawing}
                onPointerMove={draw}
                onPointerUp={stopDrawing}
                onPointerLeave={stopDrawing}
              />
              <button type="button" onClick={clearSignature} className="mt-3 rounded-lg border border-neutral-300 px-3 py-2 text-[0.82rem] font-medium text-neutral-800">Limpiar firma</button>
            </section>

            <section className="panel p-5">
              <div className="mb-3 flex items-center justify-between gap-2">
                <h2 className="text-[1rem] font-semibold text-neutral-900">Foto frontal</h2>
                <button type="button" onClick={startCamera} className="rounded-lg bg-neutral-900 px-3 py-2 text-[0.78rem] font-semibold text-white">Cámara</button>
              </div>
              <video ref={videoRef} playsInline muted className={`h-48 w-full rounded-lg border border-neutral-200 bg-neutral-950 object-cover ${cameraActive ? 'block' : 'hidden'}`} />
              {form.selfieDataUrl ? <Image src={form.selfieDataUrl} alt="Foto técnico" width={320} height={180} unoptimized className="mt-3 h-40 w-full rounded-lg border border-neutral-200 object-cover" /> : null}
            </section>

            <button type="submit" className="w-full rounded-lg bg-emerald-700 px-4 py-3 text-[0.95rem] font-semibold text-white">
              Firmar y guardar
            </button>
          </aside>
        </form>

        {message ? <p className="panel p-3 text-[0.9rem] text-neutral-700">{message}</p> : null}

        {queue.length ? (
          <section className="panel p-5">
            <h2 className="mb-3 text-[1.05rem] font-semibold text-neutral-900">Cola local</h2>
            <div className="space-y-2">
              {queue.map((job) => (
                <div key={job.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-neutral-200 bg-white p-3 text-[0.86rem]">
                  <span>{new Date(job.createdAt).toLocaleString('es-CL')} | {job.payload.descripcion.slice(0, 80)}</span>
                  <span className="font-semibold text-neutral-700">{job.status}</span>
                </div>
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </div>
  );
}
