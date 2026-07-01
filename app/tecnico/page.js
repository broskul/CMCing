'use client';

import Image from 'next/image';
import { useCallback, useEffect, useRef, useState } from 'react';
import { deleteSyncJob, enqueueSyncJob, listSyncJobs, updateSyncJob } from '../lib/offline-queue';

const checklistTemplate = [
  'Chequeo primario de funcionamiento',
  'Chequeo estructural, accesorios y componentes',
  'Chequeo de controles y comandos',
  'Chequeo de conexiones eléctricas',
  'Hermeticidad de extracción',
  'Verificación de filtro absoluto',
  'Verificación de uniformidad',
  'Verificación de recuento de partículas',
  'Verificación de nivel de ruido',
  'Verificación de iluminación',
  'Verificación de temperatura',
  'Verificación de humedad relativa',
  'Prueba de humo',
];

const defaultObjective = 'Verificar el correcto funcionamiento del equipo de acuerdo a especificaciones de fábrica.';
const defaultSpecifications = 'Para cada medición se debe cumplir que los parámetros de operación programados y obtenidos son los mismos para el proceso.';

const variableOptions = [
  'Temperatura',
  'Velocidad de flujo',
  'Recuento de partículas',
  'Ruido',
  'Iluminación',
  'Humedad relativa',
  'Torque',
];

const unitOptions = ['°C', 'm/s', 'dB', 'Lux', '%HR', '%', 'Nm', 'partículas/pie³', 'N/A'];

const createDefaultChecklist = () => checklistTemplate.slice(0, 4).map((label) => ({ label, checked: false }));

const createEmptyMeasurement = () => ({
  variable: '',
  unidad: '°C',
  programado: '',
  observado: '',
  referencia: '',
  diferenciaModo: 'unidad',
  diferencia: '',
  criterioModo: 'tolerancia',
  criterioUnidad: 'medicion',
  criterioMenos: '',
  criterioMas: '',
  criterioMin: '',
  criterioMax: '',
  cumple: 'Si',
  criterio: '',
});

const createEmptyForm = () => ({
  clienteId: '',
  equipoIds: [],
  tecnicoId: '',
  servicioId: '',
  fecha: '',
  objetivo: defaultObjective,
  especificaciones: defaultSpecifications,
  trabajoRealizado: '',
  checklist: createDefaultChecklist(),
  mediciones: [],
  certificadoInstrumentos: '',
  codigoInstrumento: '',
  codigoServicio: '',
  firmaTexto: '',
  attachments: [],
  imageAttachments: [],
  selfieDataUrl: '',
});

const hasMeasurementData = (measurement) => ['variable', 'programado', 'observado', 'diferencia', 'criterio']
  .some((field) => String(measurement[field] || '').trim());

const normalizeNumberText = (value) => String(value ?? '').replace(',', '.').trim();

const parseMeasurementNumber = (value) => {
  const normalized = normalizeNumberText(value);
  if (!normalized) return null;
  const number = Number(normalized);
  return Number.isFinite(number) ? number : null;
};

const formatMeasurementNumber = (value, decimals = 2) => {
  if (!Number.isFinite(value)) return '';
  const fixed = value.toFixed(decimals);
  return fixed.replace(/\.?0+$/, '');
};

const getCriterionUnit = (measurement) => (measurement.criterioUnidad === 'porcentaje' ? '%' : measurement.unidad || '');

const getDifferenceValue = (measurement, mode = measurement.diferenciaModo) => {
  const observed = parseMeasurementNumber(measurement.observado);
  if (observed === null) return null;

  if (mode === 'porcentaje') {
    const reference = parseMeasurementNumber(measurement.referencia)
      ?? parseMeasurementNumber(measurement.programado);
    if (reference === null || reference === 0) return null;
    return ((observed - reference) / reference) * 100;
  }

  const expected = parseMeasurementNumber(measurement.programado);
  if (expected === null) return null;
  return observed - expected;
};

const buildCriterionText = (measurement) => {
  const unit = getCriterionUnit(measurement);
  const minus = normalizeNumberText(measurement.criterioMenos || measurement.criterioMas);
  const plus = normalizeNumberText(measurement.criterioMas || measurement.criterioMenos);
  const min = normalizeNumberText(measurement.criterioMin);
  const max = normalizeNumberText(measurement.criterioMax);

  if (measurement.criterioModo === 'tolerancia') {
    if (!minus && !plus) return '';
    if (minus && plus && minus !== plus) {
      return `Los valores individuales de operación deben encontrarse entre -${minus} ${unit} y +${plus} ${unit}.`;
    }
    return `Los valores individuales de operación deben encontrarse en ± ${plus || minus} ${unit}.`;
  }

  if (measurement.criterioModo === 'rango') {
    if (!min || !max) return '';
    return `Los valores de operación deben encontrarse entre ${min} ${unit} y ${max} ${unit}.`;
  }

  if (measurement.criterioModo === 'maximo') {
    if (!max) return '';
    return `Valor máximo permitido: ${max} ${unit}.`;
  }

  if (measurement.criterioModo === 'minimo') {
    if (!min) return '';
    return `Valor mínimo permitido: ${min} ${unit}.`;
  }

  return '';
};

const evaluateMeasurement = (measurement) => {
  const observed = parseMeasurementNumber(measurement.observado);
  const rawDifference = getDifferenceValue(measurement, 'unidad');
  const percentDifference = getDifferenceValue(measurement, 'porcentaje');
  const criterionValue = measurement.criterioUnidad === 'porcentaje' ? percentDifference : rawDifference;
  const criterionMode = measurement.criterioModo;

  let cumple = 'N/A';
  if (criterionMode === 'tolerancia') {
    const minus = parseMeasurementNumber(measurement.criterioMenos || measurement.criterioMas);
    const plus = parseMeasurementNumber(measurement.criterioMas || measurement.criterioMenos);
    if (criterionValue !== null && minus !== null && plus !== null) {
      cumple = criterionValue >= -Math.abs(minus) && criterionValue <= Math.abs(plus) ? 'Si' : 'No';
    }
  } else if (criterionMode === 'rango') {
    const min = parseMeasurementNumber(measurement.criterioMin);
    const max = parseMeasurementNumber(measurement.criterioMax);
    const value = measurement.criterioUnidad === 'porcentaje' ? percentDifference : observed;
    if (value !== null && min !== null && max !== null) {
      cumple = value >= min && value <= max ? 'Si' : 'No';
    }
  } else if (criterionMode === 'maximo') {
    const max = parseMeasurementNumber(measurement.criterioMax);
    const value = measurement.criterioUnidad === 'porcentaje' ? percentDifference : observed;
    if (value !== null && max !== null) cumple = value <= max ? 'Si' : 'No';
  } else if (criterionMode === 'minimo') {
    const min = parseMeasurementNumber(measurement.criterioMin);
    const value = measurement.criterioUnidad === 'porcentaje' ? percentDifference : observed;
    if (value !== null && min !== null) cumple = value >= min ? 'Si' : 'No';
  }

  const differenceValue = getDifferenceValue(measurement, measurement.diferenciaModo);
  const differenceUnit = measurement.diferenciaModo === 'porcentaje' ? '%' : measurement.unidad;
  const differenceText = differenceValue === null
    ? ''
    : `${differenceValue > 0 ? '+' : ''}${formatMeasurementNumber(differenceValue)}${differenceUnit ? ` ${differenceUnit}` : ''}`;

  return {
    ...measurement,
    diferencia: differenceText,
    cumple,
    criterio: buildCriterionText(measurement),
  };
};

const buildMeasurementLabel = (measurement) => `${measurement.variable}${measurement.unidad && measurement.unidad !== 'N/A' ? ` ${measurement.unidad}` : ''}`;

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export default function TecnicoPage() {
  const [form, setForm] = useState(() => createEmptyForm());
  const [comboText, setComboText] = useState({
    tecnico: '',
    cliente: '',
    servicio: '',
    equipo: '',
    checklist: '',
  });
  const [measurementDraft, setMeasurementDraft] = useState(() => createEmptyMeasurement());
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
    setComboText((prev) => ({
      ...prev,
      tecnico: prev.tecnico || tecnico?.nombre || '',
    }));
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

  const selectedEquipos = options.equipos.filter((equipo) => form.equipoIds.includes(String(equipo.id)));

  const getClienteLabel = (cliente) => cliente?.nombre || '';
  const getTecnicoLabel = (tecnico) => tecnico?.nombre || '';
  const getServicioLabel = (servicio) => servicio?.descripcion || '';
  const getEquipoLabel = (equipo) => {
    if (!equipo) return '';
    return [equipo.sku || equipo.codigoInterno || equipo.modelo, equipo.serial, equipo.nombre]
      .filter(Boolean)
      .join(' | ');
  };

  const handleComboChange = (field, value) => {
    setComboText((prev) => ({ ...prev, [field]: value }));

    if (field === 'cliente') {
      const cliente = options.clientes.find((item) => getClienteLabel(item) === value);
      setForm((prev) => ({
        ...prev,
        clienteId: cliente ? String(cliente.id) : '',
        equipoIds: cliente && String(cliente.id) === String(prev.clienteId) ? prev.equipoIds : [],
      }));
      setComboText((prev) => ({ ...prev, equipo: '' }));
    }

    if (field === 'tecnico') {
      const tecnico = options.tecnicos.find((item) => getTecnicoLabel(item) === value);
      setForm((prev) => ({
        ...prev,
        tecnicoId: tecnico ? String(tecnico.id) : '',
        firmaTexto: tecnico ? (tecnico.firmaTexto || tecnico.nombre || prev.firmaTexto) : prev.firmaTexto,
      }));
    }

    if (field === 'servicio') {
      const servicio = options.servicios.find((item) => getServicioLabel(item) === value);
      setForm((prev) => ({ ...prev, servicioId: servicio ? String(servicio.id) : '' }));
    }
  };

  const addSelectedEquipo = () => {
    const equipo = equiposDisponibles.find((item) => getEquipoLabel(item) === comboText.equipo);
    if (!equipo) {
      setMessage('Selecciona un equipo válido.');
      return;
    }
    setForm((prev) => {
      const key = String(equipo.id);
      if (prev.equipoIds.includes(key)) return prev;
      return { ...prev, equipoIds: [...prev.equipoIds, key] };
    });
    setComboText((prev) => ({ ...prev, equipo: '' }));
  };

  const removeSelectedEquipo = (equipoId) => {
    setForm((prev) => ({ ...prev, equipoIds: prev.equipoIds.filter((id) => id !== String(equipoId)) }));
  };

  const addChecklistItem = () => {
    const label = comboText.checklist.trim();
    if (!label) return;
    setForm((prev) => {
      if (prev.checklist.some((item) => item.label.toLowerCase() === label.toLowerCase())) return prev;
      return { ...prev, checklist: [...prev.checklist, { label, checked: true }] };
    });
    setComboText((prev) => ({ ...prev, checklist: '' }));
  };

  const removeChecklistItem = (index) => {
    setForm((prev) => ({ ...prev, checklist: prev.checklist.filter((_, itemIndex) => itemIndex !== index) }));
  };

  const updateMeasurementDraft = (field, value) => {
    setMeasurementDraft((prev) => ({ ...prev, [field]: value }));
  };

  const addMeasurement = () => {
    const evaluated = evaluateMeasurement(measurementDraft);
    const requiresExpected = measurementDraft.criterioModo === 'tolerancia'
      && measurementDraft.criterioUnidad === 'medicion';
    const requiresPercentBase = measurementDraft.criterioUnidad === 'porcentaje'
      || measurementDraft.diferenciaModo === 'porcentaje';

    if (!measurementDraft.variable.trim() || !measurementDraft.unidad.trim() || !measurementDraft.observado.trim()) {
      setMessage('Completa variable, unidad y valor observado de la medición.');
      return;
    }

    if (requiresExpected && !measurementDraft.programado.trim()) {
      setMessage('Completa el valor programado para calcular la diferencia.');
      return;
    }

    if (requiresPercentBase && !measurementDraft.programado.trim() && !measurementDraft.referencia.trim()) {
      setMessage('Completa programado o base % para calcular el porcentaje.');
      return;
    }

    if (!evaluated.criterio) {
      setMessage('Completa el criterio de aceptación.');
      return;
    }

    setForm((prev) => ({ ...prev, mediciones: [...prev.mediciones, evaluated] }));
    setMeasurementDraft(createEmptyMeasurement());
    setMessage('');
  };

  const handleFiles = async (files, tipo = 'evidencia') => {
    const attachments = await Promise.all(Array.from(files).map(async (file) => ({
      name: file.name,
      type: file.type,
      size: file.size,
      tipo,
      dataUrl: await fileToDataUrl(file),
    })));

    setForm((prev) => ({ ...prev, attachments: [...prev.attachments, ...attachments] }));
  };

  const handleImageFiles = async (files) => {
    const imageAttachments = await Promise.all(Array.from(files).map(async (file) => ({
      name: file.name,
      type: file.type,
      size: file.size,
      tipo: 'imagen_adjunta',
      titulo: '',
      descripcion: '',
      dataUrl: await fileToDataUrl(file),
    })));

    setForm((prev) => ({ ...prev, imageAttachments: [...prev.imageAttachments, ...imageAttachments] }));
  };

  const updateImageAttachment = (index, field, value) => {
    setForm((prev) => ({
      ...prev,
      imageAttachments: prev.imageAttachments.map((attachment, itemIndex) => (
        itemIndex === index ? { ...attachment, [field]: value } : attachment
      )),
    }));
  };

  const removeImageAttachment = (index) => {
    setForm((prev) => ({
      ...prev,
      imageAttachments: prev.imageAttachments.filter((_, itemIndex) => itemIndex !== index),
    }));
  };

  const toggleChecklist = (index) => {
    setForm((prev) => ({
      ...prev,
      checklist: prev.checklist.map((item, itemIndex) => (
        itemIndex === index ? { ...item, checked: !item.checked } : item
      )),
    }));
  };

  const removeMeasurement = (index) => {
    setForm((prev) => ({
      ...prev,
      mediciones: prev.mediciones.filter((_, itemIndex) => itemIndex !== index),
    }));
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
    const mediciones = form.mediciones.filter(hasMeasurementData);
    const hasInstrumentCertificate = form.attachments.some((attachment) => attachment.tipo === 'certificado_instrumento');

    if (!form.tecnicoId || !form.clienteId || !form.servicioId) {
      setMessage('Selecciona técnico, cliente y servicio desde los cuadros combinados.');
      return;
    }

    if (!form.equipoIds.length) {
      setMessage('Selecciona al menos un equipo.');
      return;
    }

    if (!form.objetivo.trim() || !form.especificaciones.trim()) {
      setMessage('Completa objetivo y especificaciones.');
      return;
    }

    if (!mediciones.length) {
      setMessage('Registra al menos una medición.');
      return;
    }

    if (!form.certificadoInstrumentos.trim() && !hasInstrumentCertificate) {
      setMessage('Registra los certificados de instrumentos usados.');
      return;
    }

    if (!form.codigoInstrumento.trim() || !form.codigoServicio.trim()) {
      setMessage('Registra código de instrumento y código de servicio.');
      return;
    }

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
      descripcion: form.trabajoRealizado,
      objetivo: form.objetivo.trim(),
      especificaciones: form.especificaciones.trim(),
      trabajoRealizado: form.trabajoRealizado.trim(),
      checklist: form.checklist.map((item) => ({ label: item.label, checked: Boolean(item.checked) })),
      mediciones,
      certificadoInstrumentos: form.certificadoInstrumentos.trim(),
      codigoInstrumento: form.codigoInstrumento.trim(),
      codigoServicio: form.codigoServicio.trim(),
      attachments: [
        ...form.attachments,
        ...form.imageAttachments.map((attachment, index) => ({
          ...attachment,
          titulo: attachment.titulo.trim() || `Imagen ${index + 1}`,
          descripcion: attachment.descripcion.trim(),
        })),
      ],
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
      ...createEmptyForm(),
      tecnicoId: prev.tecnicoId,
      firmaTexto: prev.firmaTexto,
      fecha: new Date().toISOString().slice(0, 16),
    }));
    setComboText((prev) => ({
      ...prev,
      cliente: '',
      servicio: '',
      equipo: '',
      checklist: '',
    }));
    setMeasurementDraft(createEmptyMeasurement());
    clearSignature();
    await refreshQueue();
    setMessage('Servicio guardado en cola.');
    syncPending();
  };

  const draftEvaluation = evaluateMeasurement(measurementDraft);

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
          <section className="panel space-y-5 p-5">
            <datalist id="tecnico-options">
              {options.tecnicos.map((tecnico) => <option key={tecnico.id} value={getTecnicoLabel(tecnico)} />)}
            </datalist>
            <datalist id="cliente-options">
              {options.clientes.map((cliente) => <option key={cliente.id} value={getClienteLabel(cliente)} />)}
            </datalist>
            <datalist id="servicio-options">
              {options.servicios.map((servicio) => <option key={servicio.id} value={getServicioLabel(servicio)} />)}
            </datalist>
            <datalist id="equipo-options">
              {equiposDisponibles.map((equipo) => <option key={equipo.id} value={getEquipoLabel(equipo)} />)}
            </datalist>
            <datalist id="checklist-options">
              {checklistTemplate.map((item) => <option key={item} value={item} />)}
            </datalist>
            <datalist id="variable-options">
              {variableOptions.map((item) => <option key={item} value={item} />)}
            </datalist>
            <datalist id="unit-options">
              {unitOptions.map((item) => <option key={item} value={item} />)}
            </datalist>

            <div>
              <h2 className="mb-3 text-[1rem] font-semibold text-neutral-900">DATOS DEL EQUIPO</h2>
              <div className="grid gap-3 md:grid-cols-2">
                <label className="block text-[0.85rem] font-medium text-neutral-700">
                  Técnico
                  <input list="tecnico-options" value={comboText.tecnico} onChange={(event) => handleComboChange('tecnico', event.target.value)} className="input-base mt-1" required />
                </label>
                <label className="block text-[0.85rem] font-medium text-neutral-700">
                  Fecha
                  <input type="datetime-local" value={form.fecha} onChange={(event) => setForm((prev) => ({ ...prev, fecha: event.target.value }))} className="input-base mt-1" required />
                </label>
                <label className="block text-[0.85rem] font-medium text-neutral-700">
                  Cliente
                  <input list="cliente-options" value={comboText.cliente} onChange={(event) => handleComboChange('cliente', event.target.value)} className="input-base mt-1" required />
                </label>
                <label className="block text-[0.85rem] font-medium text-neutral-700">
                  Servicio
                  <input list="servicio-options" value={comboText.servicio} onChange={(event) => handleComboChange('servicio', event.target.value)} className="input-base mt-1" required />
                </label>
              </div>

              <div className="mt-3">
                <p className="mb-2 text-[0.85rem] font-medium text-neutral-700">Equipos</p>
                <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                  <input list="equipo-options" value={comboText.equipo} onChange={(event) => setComboText((prev) => ({ ...prev, equipo: event.target.value }))} className="input-base" />
                  <button type="button" onClick={addSelectedEquipo} className="rounded-lg border border-neutral-300 px-3 py-2 text-[0.84rem] font-medium text-neutral-800">Agregar</button>
                </div>
                {selectedEquipos.length ? (
                  <div className="mt-3 grid gap-2">
                    {selectedEquipos.map((equipo) => (
                      <div key={equipo.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-[0.86rem] text-neutral-700">
                        <span>{getEquipoLabel(equipo)}</span>
                        <button type="button" onClick={() => removeSelectedEquipo(equipo.id)} className="text-[0.78rem] font-semibold text-rose-700">Quitar</button>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <label className="block text-[0.85rem] font-medium text-neutral-700">
                OBJETIVO
                <textarea value={form.objetivo} onChange={(event) => setForm((prev) => ({ ...prev, objetivo: event.target.value }))} className="input-base mt-1 min-h-24" required />
              </label>
              <label className="block text-[0.85rem] font-medium text-neutral-700">
                ESPECIFICACIONES
                <textarea value={form.especificaciones} onChange={(event) => setForm((prev) => ({ ...prev, especificaciones: event.target.value }))} className="input-base mt-1 min-h-24" required />
              </label>
            </div>

            <label className="block text-[0.85rem] font-medium text-neutral-700">
              I. TRABAJOS REALIZADOS Y REPORTES
              <textarea value={form.trabajoRealizado} onChange={(event) => setForm((prev) => ({ ...prev, trabajoRealizado: event.target.value }))} className="input-base mt-1 min-h-32" required />
            </label>

            <div>
              <h2 className="mb-3 text-[1rem] font-semibold text-neutral-900">II. ESTADO INICIAL</h2>
              <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                <input list="checklist-options" value={comboText.checklist} onChange={(event) => setComboText((prev) => ({ ...prev, checklist: event.target.value }))} className="input-base" />
                <button type="button" onClick={addChecklistItem} className="rounded-lg border border-neutral-300 px-3 py-2 text-[0.84rem] font-medium text-neutral-800">Agregar</button>
              </div>
              <div className="mt-3 grid gap-2 rounded-lg border border-neutral-200 bg-neutral-50 p-3">
                {form.checklist.map((item, index) => (
                  <div key={`${item.label}-${index}`} className="flex flex-wrap items-center justify-between gap-2 text-[0.88rem] text-neutral-700">
                    <label className="flex min-w-0 flex-1 items-center gap-2">
                      <input type="checkbox" checked={item.checked} onChange={() => toggleChecklist(index)} />
                      <span className="min-w-0">{item.label}</span>
                    </label>
                    <button type="button" onClick={() => removeChecklistItem(index)} className="text-[0.78rem] font-semibold text-rose-700">Quitar</button>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <div className="mb-3 flex items-center justify-between gap-2">
                <h2 className="text-[1rem] font-semibold text-neutral-900">III. REPORTES DE MEDICIÓN</h2>
                <button type="button" onClick={addMeasurement} className="rounded-lg border border-neutral-300 px-3 py-2 text-[0.8rem] font-medium text-neutral-800">Agregar</button>
              </div>

              <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-3">
                <div className="grid gap-3 md:grid-cols-4">
                  <label className="block text-[0.82rem] font-medium text-neutral-700 md:col-span-2">
                    Variable
                    <input list="variable-options" value={measurementDraft.variable} onChange={(event) => updateMeasurementDraft('variable', event.target.value)} className="input-base mt-1" />
                  </label>
                  <label className="block text-[0.82rem] font-medium text-neutral-700">
                    Unidad
                    <input list="unit-options" value={measurementDraft.unidad} onChange={(event) => updateMeasurementDraft('unidad', event.target.value)} className="input-base mt-1" />
                  </label>
                  <label className="block text-[0.82rem] font-medium text-neutral-700">
                    Diferencia
                    <select value={measurementDraft.diferenciaModo} onChange={(event) => updateMeasurementDraft('diferenciaModo', event.target.value)} className="input-base mt-1">
                      <option value="unidad">Unidad</option>
                      <option value="porcentaje">%</option>
                    </select>
                  </label>
                  <label className="block text-[0.82rem] font-medium text-neutral-700">
                    Programado
                    <input type="number" inputMode="decimal" step="any" value={measurementDraft.programado} onChange={(event) => updateMeasurementDraft('programado', event.target.value)} className="input-base mt-1" />
                  </label>
                  <label className="block text-[0.82rem] font-medium text-neutral-700">
                    Observado
                    <input type="number" inputMode="decimal" step="any" value={measurementDraft.observado} onChange={(event) => updateMeasurementDraft('observado', event.target.value)} className="input-base mt-1" />
                  </label>
                  <label className="block text-[0.82rem] font-medium text-neutral-700">
                    Base %
                    <input type="number" inputMode="decimal" step="any" value={measurementDraft.referencia} onChange={(event) => updateMeasurementDraft('referencia', event.target.value)} className="input-base mt-1" />
                  </label>
                  <label className="block text-[0.82rem] font-medium text-neutral-700">
                    Resultado
                    <input value={draftEvaluation.diferencia || ''} readOnly className="input-base mt-1 bg-white text-neutral-600" />
                  </label>
                </div>

                <div className="mt-3 grid gap-3 md:grid-cols-4">
                  <label className="block text-[0.82rem] font-medium text-neutral-700">
                    Condición
                    <select value={measurementDraft.criterioModo} onChange={(event) => updateMeasurementDraft('criterioModo', event.target.value)} className="input-base mt-1">
                      <option value="tolerancia">±</option>
                      <option value="rango">Mín / máx</option>
                      <option value="maximo">Máximo</option>
                      <option value="minimo">Mínimo</option>
                    </select>
                  </label>
                  <label className="block text-[0.82rem] font-medium text-neutral-700">
                    Unidad criterio
                    <select value={measurementDraft.criterioUnidad} onChange={(event) => updateMeasurementDraft('criterioUnidad', event.target.value)} className="input-base mt-1">
                      <option value="medicion">Medición</option>
                      <option value="porcentaje">%</option>
                    </select>
                  </label>

                  {measurementDraft.criterioModo === 'tolerancia' ? (
                    <>
                      <label className="block text-[0.82rem] font-medium text-neutral-700">
                        -
                        <input type="number" inputMode="decimal" step="any" value={measurementDraft.criterioMenos} onChange={(event) => updateMeasurementDraft('criterioMenos', event.target.value)} className="input-base mt-1" />
                      </label>
                      <label className="block text-[0.82rem] font-medium text-neutral-700">
                        +
                        <input type="number" inputMode="decimal" step="any" value={measurementDraft.criterioMas} onChange={(event) => updateMeasurementDraft('criterioMas', event.target.value)} className="input-base mt-1" />
                      </label>
                    </>
                  ) : null}

                  {measurementDraft.criterioModo === 'rango' ? (
                    <>
                      <label className="block text-[0.82rem] font-medium text-neutral-700">
                        Mín
                        <input type="number" inputMode="decimal" step="any" value={measurementDraft.criterioMin} onChange={(event) => updateMeasurementDraft('criterioMin', event.target.value)} className="input-base mt-1" />
                      </label>
                      <label className="block text-[0.82rem] font-medium text-neutral-700">
                        Máx
                        <input type="number" inputMode="decimal" step="any" value={measurementDraft.criterioMax} onChange={(event) => updateMeasurementDraft('criterioMax', event.target.value)} className="input-base mt-1" />
                      </label>
                    </>
                  ) : null}

                  {measurementDraft.criterioModo === 'maximo' ? (
                    <label className="block text-[0.82rem] font-medium text-neutral-700 md:col-span-2">
                      Máx
                      <input type="number" inputMode="decimal" step="any" value={measurementDraft.criterioMax} onChange={(event) => updateMeasurementDraft('criterioMax', event.target.value)} className="input-base mt-1" />
                    </label>
                  ) : null}

                  {measurementDraft.criterioModo === 'minimo' ? (
                    <label className="block text-[0.82rem] font-medium text-neutral-700 md:col-span-2">
                      Mín
                      <input type="number" inputMode="decimal" step="any" value={measurementDraft.criterioMin} onChange={(event) => updateMeasurementDraft('criterioMin', event.target.value)} className="input-base mt-1" />
                    </label>
                  ) : null}
                </div>

                <div className="mt-3 grid gap-2 rounded-lg border border-neutral-200 bg-white p-3 text-[0.82rem] text-neutral-700">
                  <div><span className="font-semibold">Cumple:</span> {draftEvaluation.cumple}</div>
                  <div><span className="font-semibold">Criterio:</span> {draftEvaluation.criterio || '-'}</div>
                </div>
              </div>

              {form.mediciones.length ? (
                <div className="mt-3 overflow-x-auto rounded-lg border border-neutral-200">
                  <table className="min-w-full divide-y divide-neutral-200 text-left text-[0.82rem]">
                    <thead className="bg-neutral-50 text-neutral-600">
                      <tr>
                        <th className="px-3 py-2 font-semibold">Variable</th>
                        <th className="px-3 py-2 font-semibold">Prog.</th>
                        <th className="px-3 py-2 font-semibold">Obs.</th>
                        <th className="px-3 py-2 font-semibold">Dif.</th>
                        <th className="px-3 py-2 font-semibold">OK</th>
                        <th className="px-3 py-2 font-semibold">Criterio</th>
                        <th className="px-3 py-2"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100 bg-white">
                      {form.mediciones.map((measurement, index) => (
                        <tr key={`${measurement.variable}-${index}`}>
                          <td className="px-3 py-2">{buildMeasurementLabel(measurement)}</td>
                          <td className="px-3 py-2">{measurement.programado || '-'}</td>
                          <td className="px-3 py-2">{measurement.observado || '-'}</td>
                          <td className="px-3 py-2">{measurement.diferencia || '-'}</td>
                          <td className="px-3 py-2">{measurement.cumple || '-'}</td>
                          <td className="max-w-[260px] px-3 py-2">{measurement.criterio || '-'}</td>
                          <td className="px-3 py-2 text-right">
                            <button type="button" onClick={() => removeMeasurement(index)} className="font-semibold text-rose-700">Quitar</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}
            </div>

            <div>
              <h2 className="mb-3 text-[1rem] font-semibold text-neutral-900">IV. CONSIDERACIONES</h2>
              <label className="block text-[0.85rem] font-medium text-neutral-700">
                Certificados de los instrumentos que usaste
                <textarea value={form.certificadoInstrumentos} onChange={(event) => setForm((prev) => ({ ...prev, certificadoInstrumentos: event.target.value }))} className="input-base mt-1 min-h-28" />
              </label>
              <input type="file" accept="image/*,application/pdf" capture="environment" multiple onChange={(event) => handleFiles(event.target.files || [], 'certificado_instrumento')} className="input-base mt-3" />
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

            <div>
              <h2 className="mb-3 text-[1rem] font-semibold text-neutral-900">V. CÓDIGO INSTRUMENTO Y CÓDIGO DEL SERVICIO</h2>
              <div className="grid gap-3 md:grid-cols-2">
                <label className="block text-[0.85rem] font-medium text-neutral-700">
                  Código instrumento
                  <input value={form.codigoInstrumento} onChange={(event) => setForm((prev) => ({ ...prev, codigoInstrumento: event.target.value }))} className="input-base mt-1" required />
                </label>
                <label className="block text-[0.85rem] font-medium text-neutral-700">
                  Código del servicio
                  <input value={form.codigoServicio} onChange={(event) => setForm((prev) => ({ ...prev, codigoServicio: event.target.value }))} className="input-base mt-1" required />
                </label>
              </div>
            </div>

            <div>
              <h2 className="mb-3 text-[1rem] font-semibold text-neutral-900">IMÁGENES ADJUNTAS</h2>
              <input type="file" accept="image/*" capture="environment" multiple onChange={(event) => handleImageFiles(event.target.files || [])} className="input-base" />
              {form.imageAttachments.length ? (
                <div className="mt-3 space-y-3">
                  {form.imageAttachments.map((attachment, index) => (
                    <div key={`${attachment.name}-${index}`} className="grid gap-3 rounded-lg border border-neutral-200 bg-neutral-50 p-3 sm:grid-cols-[120px_1fr]">
                      <Image src={attachment.dataUrl} alt={attachment.titulo || attachment.name} width={120} height={90} unoptimized className="h-24 w-full rounded-md border border-neutral-200 bg-white object-cover sm:w-28" />
                      <div className="space-y-2">
                        <input value={attachment.titulo} onChange={(event) => updateImageAttachment(index, 'titulo', event.target.value)} className="input-base" placeholder="Título" />
                        <textarea value={attachment.descripcion} onChange={(event) => updateImageAttachment(index, 'descripcion', event.target.value)} className="input-base min-h-20" placeholder="Descripción breve" />
                        <button type="button" onClick={() => removeImageAttachment(index)} className="rounded-lg border border-neutral-300 px-3 py-2 text-[0.8rem] font-medium text-neutral-800">Quitar imagen</button>
                      </div>
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
                  <span>{new Date(job.createdAt).toLocaleString('es-CL')} | {String(job.payload.trabajoRealizado || job.payload.descripcion || '').slice(0, 80)}</span>
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
