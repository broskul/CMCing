'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { MultiComboBox } from '../components/ComboBox';
import {
  configureOfflinePartition,
  createOfflineUuid,
  enqueueOfflineMutation,
  getActiveOfflineUser,
  getOfflineBlob,
  getWorkPackage,
  listOfflineMutations,
  listOfflineSnapshots,
  putOfflineBlob,
  removeOfflineBlob,
  runOfflineSyncCoordinator,
  saveWorkPackage,
  upsertOfflineSnapshot,
} from '../lib/offline-queue';

const WORK_PACKAGE_ID = 'technician-bootstrap-v1';
const DRAFT_ENTITY = 'technician-activity-draft';
const TENANT_ID = 'cmcing';

function formatDate(value, options = {}) {
  if (!value) return 'Sin fecha programada';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Sin fecha programada';
  return new Intl.DateTimeFormat('es-CL', {
    day: '2-digit',
    month: 'short',
    hour: options.dateOnly ? undefined : '2-digit',
    minute: options.dateOnly ? undefined : '2-digit',
  }).format(date);
}

function normalizeOption(option, index) {
  if (option && typeof option === 'object') {
    const value = option.value ?? option.id ?? option.codigo ?? option.label ?? option.nombre ?? option;
    return {
      id: `option-${index}-${JSON.stringify(value)}`,
      label: String(option.label || option.nombre || option.descripcion || value),
      value,
    };
  }
  return { id: `option-${index}-${String(option)}`, label: String(option), value: option };
}

function sameJson(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function answerValue(item, response) {
  if (!response) return item.tipoRespuesta === 'seleccion_multiple' ? [] : '';
  if (item.tipoRespuesta === 'numero') return response.valorNumero ?? '';
  if (item.tipoRespuesta === 'dicotomica') return typeof response.valorBooleano === 'boolean' ? response.valorBooleano : '';
  if (item.tipoRespuesta === 'seleccion_multiple') return Array.isArray(response.valorOpciones) ? response.valorOpciones : [];
  return response.valorTexto || '';
}

function buildDraft(activity) {
  const answers = {};
  for (const assignment of activity.matrices || []) {
    answers[assignment.id] = {};
    for (const item of assignment.items || []) {
      const response = assignment.respuestas?.find((row) => Number(row.matrizItemId) === Number(item.itemId));
      answers[assignment.id][item.itemId] = answerValue(item, response);
    }
  }
  return {
    activityId: activity.id,
    notes: activity.notasTecnico || '',
    answers,
    baseRevision: Number(activity.rowRevision || 1),
    dirty: { notes: false, matrices: {} },
    updatedAt: Date.now(),
  };
}

function hasDirtyDraft(draft) {
  return Boolean(draft?.dirty?.notes)
    || Object.values(draft?.dirty?.matrices || {}).some(Boolean);
}

function isAnswered(item, value) {
  if (item.tipoRespuesta === 'numero') return value !== '' && value !== null && Number.isFinite(Number(value));
  if (item.tipoRespuesta === 'dicotomica') return typeof value === 'boolean';
  if (item.tipoRespuesta === 'seleccion_multiple') return Array.isArray(value) && value.length > 0;
  return Boolean(String(value || '').trim());
}

function missingItems(assignment, draft) {
  return (assignment.items || []).filter((item) => item.requerido
    && !isAnswered(item, draft?.answers?.[assignment.id]?.[item.itemId]));
}

function buildAnswerPayload(assignment, draft) {
  return (assignment.items || []).flatMap((item) => {
    const value = draft?.answers?.[assignment.id]?.[item.itemId];
    if (!isAnswered(item, value)) return [];
    const base = { matrizItemId: Number(item.itemId) };
    if (item.tipoRespuesta === 'numero') return [{ ...base, valorNumero: Number(value) }];
    if (item.tipoRespuesta === 'dicotomica') return [{ ...base, valorBooleano: value }];
    if (item.tipoRespuesta === 'seleccion_multiple') return [{ ...base, valorOpciones: value }];
    return [{ ...base, valorTexto: String(value).trim() }];
  });
}

function priorityLabel(value) {
  return ({ critica: 'Crítica', alta: 'Alta', media: 'Media', baja: 'Baja' })[value] || 'Media';
}

async function fetchJson(url, options) {
  const response = await fetch(url, { cache: 'no-store', ...options });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.error || `Error HTTP ${response.status}`);
    error.status = response.status;
    error.data = data;
    throw error;
  }
  return data;
}

function MatrixInput({ item, value, onChange, disabled }) {
  if (item.tipoRespuesta === 'numero') {
    return (
      <div className="technician-number-field">
        <input type="number" inputMode="decimal" value={value ?? ''} onChange={(event) => onChange(event.target.value)} disabled={disabled} className="input-base" placeholder="0,00" />
        {item.medicion?.simbolo || item.medicion?.unidad ? <span>{item.medicion.simbolo || item.medicion.unidad}</span> : null}
      </div>
    );
  }
  if (item.tipoRespuesta === 'dicotomica') {
    return (
      <div className="technician-binary" role="group" aria-label={item.titulo}>
        <button type="button" className={value === true ? 'is-selected is-pass' : ''} onClick={() => onChange(true)} disabled={disabled}>Cumple</button>
        <button type="button" className={value === false ? 'is-selected is-fail' : ''} onClick={() => onChange(false)} disabled={disabled}>No cumple</button>
      </div>
    );
  }
  if (item.tipoRespuesta === 'seleccion_multiple') {
    const options = (Array.isArray(item.opciones) ? item.opciones : []).map(normalizeOption);
    const selectedIds = options.filter((option) => (value || []).some((chosen) => sameJson(chosen, option.value))).map((option) => option.id);
    return (
      <MultiComboBox
        options={options}
        values={selectedIds}
        onChange={(ids) => onChange(ids.map((id) => options.find((option) => option.id === id)?.value).filter((option) => option !== undefined))}
        getOptionLabel={(option) => option.label}
        placeholder="Seleccionar opción..."
        emptyText="Sin opciones seleccionadas."
        disabled={disabled}
      />
    );
  }
  return <textarea value={value || ''} onChange={(event) => onChange(event.target.value)} disabled={disabled} className="input-base min-h-24 resize-y" placeholder="Describa el resultado observado..." />;
}

function QueueBadge({ entries }) {
  if (!entries.length) return <span className="technician-state is-synced">Al día</span>;
  if (entries.some((entry) => entry.status === 'blocked')) return <span className="technician-state is-conflict">Conflicto</span>;
  if (entries.some((entry) => entry.status === 'running')) return <span className="technician-state is-syncing">Sincronizando</span>;
  if (entries.some((entry) => entry.status === 'failed')) return <span className="technician-state is-pending">Reintento pendiente</span>;
  return <span className="technician-state is-pending">Pendiente</span>;
}

export default function TecnicoPage() {
  const [activities, setActivities] = useState([]);
  const [drafts, setDrafts] = useState({});
  const [selectedId, setSelectedId] = useState(null);
  const [queue, setQueue] = useState([]);
  const [online, setOnline] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState(null);
  const [openAI, setOpenAI] = useState({ checked: false, enabled: false });
  const [aiLoading, setAiLoading] = useState(false);
  const [pendingPhotos, setPendingPhotos] = useState({});
  const draftsRef = useRef({});
  const revisionRef = useRef({});
  const syncingRef = useRef(false);
  const initializedRef = useRef(false);
  const previewUrlsRef = useRef(new Set());

  const setDraftState = useCallback((activityId, updater) => {
    const current = draftsRef.current;
    const existing = current[activityId];
    if (!existing) return;
    const nextDraft = typeof updater === 'function' ? updater(existing) : { ...existing, ...updater };
    const next = { ...current, [activityId]: { ...nextDraft, updatedAt: Date.now() } };
    draftsRef.current = next;
    setDrafts(next);
  }, []);

  const refreshQueue = useCallback(async () => {
    try {
      const entries = await listOfflineMutations({ rehydrate: 'reference' });
      setQueue(entries);
      return entries;
    } catch {
      setQueue([]);
      return [];
    }
  }, []);

  const hydratePackage = useCallback(async (payload) => {
    const [storedDrafts, pending] = await Promise.all([
      listOfflineSnapshots(DRAFT_ENTITY, { rehydrate: 'reference' }).catch(() => []),
      listOfflineMutations({ rehydrate: 'reference' }).catch(() => []),
    ]);
    const storedByActivity = new Map(storedDrafts.map((snapshot) => [Number(snapshot.entityId), snapshot.payload]));
    const pendingByActivity = new Map();
    for (const entry of pending) {
      const activityId = Number(entry.entityId || entry.payload?.activityId);
      if (!Number.isInteger(activityId)) continue;
      const list = pendingByActivity.get(activityId) || [];
      list.push(entry);
      pendingByActivity.set(activityId, list);
    }
    const nextDrafts = {};
    for (const activity of payload.activities || []) {
      const activityId = Number(activity.id);
      const pendingEntries = pendingByActivity.get(activityId) || [];
      revisionRef.current[activityId] = pendingEntries.length
        ? Number(pendingEntries[0].baseRevision || pendingEntries[0].payload?.expectedRevision || 1)
        : Number(activity.rowRevision || 1);
      const serverDraft = buildDraft(activity);
      const localDraft = draftsRef.current[activityId] || storedByActivity.get(activityId);
      nextDrafts[activityId] = localDraft && (hasDirtyDraft(localDraft) || pendingEntries.length > 0)
        ? localDraft
        : serverDraft;
    }
    draftsRef.current = nextDrafts;
    setDrafts(nextDrafts);
    setActivities(payload.activities || []);
    setSelectedId((current) => (payload.activities || []).some((activity) => Number(activity.id) === Number(current))
      ? current
      : null);
    setQueue(pending);
  }, []);

  const refreshFromServer = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setNotice(null);
    const payload = await fetchJson('/api/tecnico/bootstrap');
    const highestRevision = Math.max(1, ...(payload.activities || []).map((activity) => Number(activity.rowRevision || 1)));
    await saveWorkPackage({ id: WORK_PACKAGE_ID, payload, revision: highestRevision });
    await hydratePackage(payload);
    return payload;
  }, [hydratePackage]);

  const markMutationApplied = useCallback((entry, result) => {
    const activityId = Number(entry.entityId || entry.payload?.activityId);
    if (Number.isInteger(Number(result?.rowRevision))) revisionRef.current[activityId] = Number(result.rowRevision);
    setActivities((current) => current.map((activity) => {
      if (Number(activity.id) !== activityId) return activity;
      const next = { ...activity, rowRevision: Number(result?.rowRevision || activity.rowRevision) };
      if (entry.operation === 'ACTUALIZAR_NOTAS') next.notasTecnico = result.notes ?? entry.payload.notes;
      if (entry.operation === 'CERRAR_ACTIVIDAD') {
        next.estado = result.state || 'cerrada';
        next.bloqueada = result.locked ?? true;
        next.fechaCierre = result.closedAt || new Date().toISOString();
      }
      if (entry.operation === 'GUARDAR_RESPUESTAS') {
        next.matrices = (activity.matrices || []).map((assignment) => Number(assignment.id) === Number(entry.payload.assignmentId)
          ? { ...assignment, estado: result.assignmentComplete ? 'completa' : 'pendiente' }
          : assignment);
      }
      return next;
    }));
    setDraftState(activityId, (draft) => ({
      ...draft,
      baseRevision: Number(result?.rowRevision || draft.baseRevision),
      dirty: {
        notes: entry.operation === 'ACTUALIZAR_NOTAS' ? false : draft.dirty.notes,
        matrices: entry.operation === 'GUARDAR_RESPUESTAS'
          ? { ...draft.dirty.matrices, [entry.payload.assignmentId]: false }
          : draft.dirty.matrices,
      },
    }));
  }, [setDraftState]);

  const syncNow = useCallback(async ({ silent = false } = {}) => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      if (!silent) setNotice({ type: 'info', text: 'Sin conexión: el trabajo permanece guardado en este dispositivo.' });
      return;
    }
    if (syncingRef.current) return;
    syncingRef.current = true;
    setSyncing(true);
    if (!silent) setNotice(null);
    try {
      const summary = await runOfflineSyncCoordinator(async (entry) => {
        const activityId = Number(entry.entityId || entry.payload?.activityId);
        if (entry.operation === 'SUBIR_IMAGEN') {
          const expectedRevision = Number(revisionRef.current[activityId] || entry.payload.expectedRevision || entry.baseRevision);
          const beforeUpload = await fetchJson('/api/tecnico/bootstrap');
          const beforeActivity = beforeUpload.activities?.find((activity) => Number(activity.id) === activityId);
          if (!beforeActivity) return { ok: false, retryable: false, error: 'La actividad dejó de estar disponible.' };
          if (Number(beforeActivity.rowRevision) !== expectedRevision) {
            await upsertOfflineSnapshot({
              entity: 'technician-sync-conflict',
              entityId: entry.id,
              payload: {
                status: 'conflict',
                expectedRevision,
                actualRevision: Number(beforeActivity.rowRevision),
                serverSnapshot: beforeActivity,
              },
              revision: Number(beforeActivity.rowRevision),
              baseRevision: expectedRevision,
            });
            return { ok: false, retryable: false, error: 'La actividad cambió antes de subir la fotografía.' };
          }
          const stored = await getOfflineBlob(entry.payload.blobId);
          if (!stored?.blob) return { ok: false, retryable: false, error: 'La foto local ya no está disponible.' };
          const formData = new FormData();
          const file = typeof File !== 'undefined'
            ? new File([stored.blob], entry.payload.name || 'imagen-actividad.jpg', { type: stored.type })
            : stored.blob;
          formData.append('file', file, entry.payload.name || 'imagen-actividad.jpg');
          formData.append('clientActionId', entry.id);
          formData.append('titulo', entry.payload.title || 'Evidencia en terreno');
          formData.append('descripcion', entry.payload.description || '');
          const uploadResponse = await fetch(`/api/ot-actividades/${activityId}/imagenes`, { method: 'POST', body: formData });
          const uploadData = await uploadResponse.json().catch(() => ({}));
          if (!uploadResponse.ok) {
            return { ok: false, retryable: uploadResponse.status >= 500, error: uploadData.error || 'No se pudo subir la foto.' };
          }
          // La inserción del adjunto incrementa la revisión de la actividad. Se
          // vuelve a leer antes de ejecutar cualquier dependencia posterior.
          const refreshed = await fetchJson('/api/tecnico/bootstrap');
          const serverActivity = refreshed.activities?.find((activity) => Number(activity.id) === activityId);
          if (!serverActivity) return { ok: false, retryable: false, error: 'La actividad dejó de estar disponible.' };
          revisionRef.current[activityId] = Number(serverActivity.rowRevision || 1);
          await saveWorkPackage({ id: WORK_PACKAGE_ID, payload: refreshed, revision: Number(serverActivity.rowRevision || 1) });
          await removeOfflineBlob(entry.payload.blobId);
          setPendingPhotos((current) => {
            const completed = (current[activityId] || []).find((photo) => photo.mutationId === entry.id);
            if (completed?.previewUrl) {
              URL.revokeObjectURL(completed.previewUrl);
              previewUrlsRef.current.delete(completed.previewUrl);
            }
            return {
              ...current,
              [activityId]: (current[activityId] || []).filter((photo) => photo.mutationId !== entry.id),
            };
          });
          return;
        }

        const expectedRevision = Number(revisionRef.current[activityId] || entry.payload.expectedRevision || entry.baseRevision);
        const response = await fetch('/api/tecnico/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            operation: entry.operation,
            clientMutationId: entry.idempotencyKey,
            activityId,
            expectedRevision,
            payload: entry.operation === 'ACTUALIZAR_NOTAS'
              ? { notes: entry.payload.notes }
              : entry.operation === 'GUARDAR_RESPUESTAS'
                ? { assignmentId: entry.payload.assignmentId, answers: entry.payload.answers }
                : {},
          }),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          if (data.conflict || response.status === 409 && data.status === 'conflict') {
            await upsertOfflineSnapshot({
              entity: 'technician-sync-conflict',
              entityId: entry.id,
              payload: data,
              revision: data.actualRevision || expectedRevision,
              baseRevision: expectedRevision,
            });
          }
          return {
            ok: false,
            retryable: data.retryable !== false,
            retryAfterMs: data.retryAfterMs,
            error: data.error || `Error HTTP ${response.status}`,
          };
        }
        markMutationApplied(entry, data);
        return;
      }, { limit: 50 });

      await refreshQueue();
      if (summary.succeeded > 0) await refreshFromServer({ silent: true });
      if (!silent) {
        if (summary.blocked > 0) setNotice({ type: 'error', text: 'Hay un conflicto. Actualice la actividad antes de continuar.' });
        else if (summary.succeeded > 0) setNotice({ type: 'success', text: `${summary.succeeded} cambio(s) sincronizado(s).` });
        else if (!summary.acquired) setNotice({ type: 'info', text: 'Otra pestaña está sincronizando esta jornada.' });
      }
    } catch (error) {
      if (!silent) setNotice({ type: 'error', text: error.message || 'No se pudo sincronizar.' });
    } finally {
      syncingRef.current = false;
      setSyncing(false);
    }
  }, [markMutationApplied, refreshFromServer, refreshQueue]);

  const enqueueForActivity = useCallback(async (activityId, operation, payload, { autoSync = true } = {}) => {
    const existing = await listOfflineMutations({ rehydrate: 'reference' });
    const sameActivity = existing.filter((entry) => Number(entry.entityId || entry.payload?.activityId) === Number(activityId));
    if (sameActivity.some((entry) => entry.status === 'blocked')) {
      throw new Error('La actividad tiene un conflicto pendiente y no admite nuevos cambios.');
    }
    const previous = sameActivity.at(-1);
    const clientMutationId = createOfflineUuid();
    await enqueueOfflineMutation({
      id: clientMutationId,
      clientMutationId,
      idempotencyKey: clientMutationId,
      operation,
      entity: 'OrdenTrabajoActividad',
      entityId: String(activityId),
      payload: {
        activityId: Number(activityId),
        expectedRevision: Number(revisionRef.current[activityId] || 1),
        ...payload,
      },
      dependsOn: previous ? [previous.id] : [],
      baseRevision: Number(revisionRef.current[activityId] || 1),
    });
    await refreshQueue();
    if (autoSync && navigator.onLine) void syncNow({ silent: true });
    return clientMutationId;
  }, [refreshQueue, syncNow]);

  useEffect(() => {
    let cancelled = false;
    const initialize = async () => {
      setOnline(navigator.onLine);
      try {
        if (navigator.onLine) {
          const session = await fetchJson('/api/auth/session');
          configureOfflinePartition({
            tenantId: TENANT_ID,
            userId: session.user.id,
            technicianId: session.user.tecnicoId,
            email: session.user.email,
          });
        } else if (!getActiveOfflineUser()) {
          throw new Error('Conecte el dispositivo e inicie sesión una vez para habilitar el modo terreno.');
        }

        const cached = await getWorkPackage(WORK_PACKAGE_ID, { allowExpired: true }).catch(() => null);
        if (cached?.payload && !cancelled) await hydratePackage(cached.payload);
        await refreshQueue();
        if (navigator.onLine && !cancelled) await refreshFromServer({ silent: Boolean(cached) });
        if (navigator.onLine) {
          fetchJson('/api/ia/notas-tecnico').then((status) => {
            if (!cancelled) setOpenAI({ checked: true, enabled: Boolean(status.enabled ?? status.configured) });
          }).catch(() => {
            if (!cancelled) setOpenAI({ checked: true, enabled: false });
          });
        } else {
          setOpenAI({ checked: true, enabled: false });
        }
        initializedRef.current = true;
        if (navigator.onLine) void syncNow({ silent: true });
      } catch (error) {
        if (!cancelled) setNotice({ type: 'error', text: error.message });
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void initialize();
    return () => { cancelled = true; };
  }, [hydratePackage, refreshFromServer, refreshQueue, syncNow]);

  useEffect(() => {
    const handleOnline = () => {
      setOnline(true);
      if (initializedRef.current) void syncNow({ silent: true });
    };
    const handleOffline = () => setOnline(false);
    const handleFocus = () => {
      if (navigator.onLine && initializedRef.current) void syncNow({ silent: true });
    };
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('focus', handleFocus);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('focus', handleFocus);
    };
  }, [syncNow]);

  useEffect(() => {
    if (!initializedRef.current || !Object.keys(drafts).length) return undefined;
    const timer = window.setTimeout(() => {
      Object.values(drafts).forEach((draft) => {
        void upsertOfflineSnapshot({
          entity: DRAFT_ENTITY,
          entityId: String(draft.activityId),
          payload: draft,
          revision: Number(revisionRef.current[draft.activityId] || draft.baseRevision || 1),
          baseRevision: Number(draft.baseRevision || 1),
        });
      });
    }, 350);
    return () => window.clearTimeout(timer);
  }, [drafts]);

  useEffect(() => () => {
    previewUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    previewUrlsRef.current.clear();
  }, []);

  const selectedActivity = activities.find((activity) => Number(activity.id) === Number(selectedId)) || null;
  const selectedDraft = selectedActivity ? drafts[selectedActivity.id] : null;
  const selectedQueue = selectedActivity
    ? queue.filter((entry) => Number(entry.entityId || entry.payload?.activityId) === Number(selectedActivity.id))
    : [];
  const conflictCount = queue.filter((entry) => entry.status === 'blocked').length;

  const summary = useMemo(() => ({
    open: activities.filter((activity) => activity.estado === 'abierta').length,
    critical: activities.filter((activity) => activity.estado === 'abierta' && activity.ordenTrabajo?.prioridad === 'critica').length,
    closed: activities.filter((activity) => activity.estado === 'cerrada').length,
  }), [activities]);

  const sortedActivities = useMemo(() => [...activities].sort((left, right) => {
    if (left.estado !== right.estado) return left.estado === 'abierta' ? -1 : 1;
    const priority = { critica: 0, alta: 1, media: 2, baja: 3 };
    const priorityDiff = (priority[left.ordenTrabajo?.prioridad] ?? 2) - (priority[right.ordenTrabajo?.prioridad] ?? 2);
    if (priorityDiff) return priorityDiff;
    return new Date(left.fechaProgramada || 8640000000000000) - new Date(right.fechaProgramada || 8640000000000000);
  }), [activities]);

  const setNotes = (value) => setDraftState(selectedActivity.id, (draft) => ({
    ...draft,
    notes: value,
    dirty: { ...draft.dirty, notes: true },
  }));

  const setMatrixValue = (assignmentId, itemId, value) => setDraftState(selectedActivity.id, (draft) => ({
    ...draft,
    answers: {
      ...draft.answers,
      [assignmentId]: { ...draft.answers[assignmentId], [itemId]: value },
    },
    dirty: { ...draft.dirty, matrices: { ...draft.dirty.matrices, [assignmentId]: true } },
  }));

  const saveNotes = async () => {
    try {
      await enqueueForActivity(selectedActivity.id, 'ACTUALIZAR_NOTAS', { notes: selectedDraft.notes || '' });
      setNotice({ type: 'success', text: online ? 'Notas guardadas y listas para sincronizar.' : 'Notas guardadas en el dispositivo.' });
    } catch (error) {
      setNotice({ type: 'error', text: error.message });
    }
  };

  const saveMatrix = async (assignment) => {
    const missing = missingItems(assignment, selectedDraft);
    if (assignment.obligatoria && missing.length) {
      setNotice({ type: 'error', text: `Complete ${missing.length} respuesta(s) obligatoria(s) de la matriz.` });
      return;
    }
    const answers = buildAnswerPayload(assignment, selectedDraft);
    if (!answers.length) {
      setNotice({ type: 'error', text: 'Registre al menos una respuesta antes de guardar.' });
      return;
    }
    try {
      await enqueueForActivity(selectedActivity.id, 'GUARDAR_RESPUESTAS', { assignmentId: Number(assignment.id), answers });
      setNotice({ type: 'success', text: online ? 'Matriz guardada y lista para sincronizar.' : 'Matriz guardada en el dispositivo.' });
    } catch (error) {
      setNotice({ type: 'error', text: error.message });
    }
  };

  const queuePhotos = async (fileList) => {
    const files = Array.from(fileList || []);
    if (!selectedActivity || !files.length) return;
    for (const file of files) {
      if (!file.type.startsWith('image/')) {
        setNotice({ type: 'error', text: `${file.name}: sólo se permiten imágenes.` });
        continue;
      }
      if (file.size > 12 * 1024 * 1024) {
        setNotice({ type: 'error', text: `${file.name}: supera el máximo de 12 MB.` });
        continue;
      }
      const blobId = createOfflineUuid();
      const previewUrl = URL.createObjectURL(file);
      previewUrlsRef.current.add(previewUrl);
      await putOfflineBlob({ id: blobId, blob: file, ownerId: `activity:${selectedActivity.id}`, name: file.name });
      try {
        const mutationId = await enqueueForActivity(selectedActivity.id, 'SUBIR_IMAGEN', {
          blobId,
          name: file.name,
          type: file.type,
          title: 'Evidencia en terreno',
        }, { autoSync: false });
        setPendingPhotos((current) => ({
          ...current,
          [selectedActivity.id]: [...(current[selectedActivity.id] || []), { mutationId, blobId, name: file.name, previewUrl }],
        }));
      } catch (error) {
        await removeOfflineBlob(blobId);
        URL.revokeObjectURL(previewUrl);
        previewUrlsRef.current.delete(previewUrl);
        setNotice({ type: 'error', text: error.message });
      }
    }
    await refreshQueue();
    if (navigator.onLine) void syncNow({ silent: true });
  };

  const improveNotes = async () => {
    if (!openAI.enabled || !online || !selectedActivity) return;
    setAiLoading(true);
    try {
      const result = await fetchJson('/api/ia/notas-tecnico', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actividadId: selectedActivity.id, notas: selectedDraft.notes }),
      });
      setNotes(result.text);
      setNotice({ type: 'success', text: 'Propuesta aplicada. Revísela y guarde las notas.' });
    } catch (error) {
      setNotice({ type: 'error', text: error.message });
    } finally {
      setAiLoading(false);
    }
  };

  const closeActivity = async () => {
    const missing = (selectedActivity.matrices || [])
      .filter((assignment) => assignment.obligatoria)
      .flatMap((assignment) => missingItems(assignment, selectedDraft));
    if (missing.length) {
      setNotice({ type: 'error', text: `No puede cerrar: faltan ${missing.length} respuesta(s) obligatoria(s).` });
      return;
    }
    const unsaved = (selectedActivity.matrices || []).filter((assignment) => assignment.obligatoria).filter((assignment) => (
      selectedDraft.dirty?.matrices?.[assignment.id]
      && !selectedQueue.some((entry) => entry.operation === 'GUARDAR_RESPUESTAS'
        && Number(entry.payload?.assignmentId) === Number(assignment.id))
    ));
    if (unsaved.length) {
      setNotice({ type: 'error', text: 'Guarde las matrices modificadas antes de cerrar la actividad.' });
      return;
    }
    try {
      await enqueueForActivity(selectedActivity.id, 'CERRAR_ACTIVIDAD', {});
      setNotice({ type: 'success', text: online ? 'Cierre en proceso de sincronización.' : 'Cierre guardado; se aplicará al recuperar conexión.' });
    } catch (error) {
      setNotice({ type: 'error', text: error.message });
    }
  };

  const mandatoryMissing = selectedActivity && selectedDraft
    ? (selectedActivity.matrices || []).filter((assignment) => assignment.obligatoria)
      .reduce((total, assignment) => total + missingItems(assignment, selectedDraft).length, 0)
    : 0;
  const mandatoryUnsaved = selectedActivity && selectedDraft
    ? (selectedActivity.matrices || []).filter((assignment) => assignment.obligatoria).filter((assignment) => (
      selectedDraft.dirty?.matrices?.[assignment.id]
      && !selectedQueue.some((entry) => entry.operation === 'GUARDAR_RESPUESTAS'
        && Number(entry.payload?.assignmentId) === Number(assignment.id))
    )).length
    : 0;

  return (
    <main className={`min-h-screen technician-workspace ${selectedActivity ? 'has-selection' : ''}`}>
      <header className="technician-topbar">
        <div>
          <span className="technician-eyebrow">CMC · Servicio técnico</span>
          <h1>Mi jornada</h1>
        </div>
        <div className="technician-topbar__actions">
          <span className={`technician-connectivity ${online ? 'is-online' : 'is-offline'}`}><i />{online ? 'En línea' : 'Sin conexión'}</span>
          <span className="technician-queue-count">{queue.length} en cola</span>
          {conflictCount ? <span className="technician-conflict-count">{conflictCount} conflicto(s)</span> : null}
          <button type="button" onClick={() => void syncNow()} disabled={!online || syncing} className="technician-sync-button">{syncing ? 'Sincronizando…' : 'Sincronizar'}</button>
          <Link href="/" className="technician-home-link">Panel 360</Link>
        </div>
      </header>

      {notice ? <div className={`technician-notice is-${notice.type}`} role="status">{notice.text}<button type="button" onClick={() => setNotice(null)} aria-label="Cerrar aviso">×</button></div> : null}

      <div className="technician-layout">
        <aside className="technician-day-list">
          <div className="technician-day-summary">
            <div><strong>{summary.open}</strong><span>Abiertas</span></div>
            <div><strong>{summary.critical}</strong><span>Críticas</span></div>
            <div><strong>{summary.closed}</strong><span>Cerradas</span></div>
          </div>
          <div className="technician-list-heading"><h2>Actividades asignadas</h2><span>{activities.length}</span></div>
          {loading && !activities.length ? <div className="technician-empty">Preparando jornada…</div> : null}
          {!loading && !activities.length ? <div className="technician-empty"><strong>Sin actividades asignadas</strong><span>Cuando Operaciones asigne una actividad aparecerá aquí.</span></div> : null}
          <div className="technician-cards">
            {sortedActivities.map((activity) => {
              const activityQueue = queue.filter((entry) => Number(entry.entityId || entry.payload?.activityId) === Number(activity.id));
              return (
                <button type="button" key={activity.id} onClick={() => setSelectedId(activity.id)} className={`technician-card ${Number(selectedId) === Number(activity.id) ? 'is-active' : ''}`}>
                  <div className="technician-card__top"><span className={`priority is-${activity.ordenTrabajo?.prioridad || 'media'}`}>{priorityLabel(activity.ordenTrabajo?.prioridad)}</span><QueueBadge entries={activityQueue} /></div>
                  <strong>{activity.titulo}</strong>
                  <span>{activity.ordenTrabajo?.codigo || `OT ${activity.ordenTrabajoId}`} · {activity.ordenTrabajo?.cliente?.nombre || 'Cliente'}</span>
                  <small>{formatDate(activity.fechaProgramada)}{activity.tecnico?.nombre ? ` · ${activity.tecnico.nombre}` : ''}</small>
                </button>
              );
            })}
          </div>
        </aside>

        <section className="technician-detail">
          {!selectedActivity || !selectedDraft ? (
            <div className="technician-detail-empty"><span>360°</span><h2>Seleccione una actividad</h2><p>Notas, matrices, fotos y cierre permanecen juntos en el contexto de la actividad.</p></div>
          ) : (
            <>
              <div className="technician-detail-header">
                <button type="button" className="technician-back" onClick={() => setSelectedId(null)}>← Jornada</button>
                <div className="technician-detail-title">
                  <span>{selectedActivity.ordenTrabajo?.codigo || `OT ${selectedActivity.ordenTrabajoId}`}</span>
                  <h2>{selectedActivity.titulo}</h2>
                  <p>{selectedActivity.descripcionBreve || 'Sin descripción breve.'}</p>
                </div>
                <QueueBadge entries={selectedQueue} />
              </div>

              {selectedQueue.some((entry) => entry.status === 'blocked') ? (
                <div className="technician-conflict-panel"><strong>Conflicto de revisión</strong><p>La actividad cambió en el servidor. No se enviarán nuevos cambios hasta que Operaciones revise el conflicto.</p></div>
              ) : null}

              <div className="technician-context-grid">
                <article><span>Cliente</span><strong>{selectedActivity.ordenTrabajo?.cliente?.nombre || 'Sin cliente'}</strong><small>{selectedActivity.ordenTrabajo?.cliente?.direccion || selectedActivity.ordenTrabajo?.cliente?.telefono || 'Sin contacto registrado'}</small></article>
                <article><span>Equipo</span><strong>{selectedActivity.ordenTrabajo?.equipos?.[0]?.nombre || 'Sin equipo asociado'}</strong><small>{[selectedActivity.ordenTrabajo?.equipos?.[0]?.modelo, selectedActivity.ordenTrabajo?.equipos?.[0]?.serial].filter(Boolean).join(' · ') || 'Sin modelo/serie'}</small></article>
                <article><span>Programación</span><strong>{formatDate(selectedActivity.fechaProgramada)}</strong><small>{priorityLabel(selectedActivity.ordenTrabajo?.prioridad)} · {selectedActivity.estado}</small></article>
              </div>

              <div className="technician-progress">
                <div><span>Notas</span><strong>{selectedDraft.notes.trim() ? 'Registradas' : 'Pendientes'}</strong></div>
                <div><span>Matrices</span><strong>{(selectedActivity.matrices || []).filter((assignment) => !missingItems(assignment, selectedDraft).length).length}/{selectedActivity.matrices?.length || 0}</strong></div>
                <div><span>Fotos</span><strong>{(selectedActivity.adjuntos?.length || 0) + (pendingPhotos[selectedActivity.id]?.length || 0)}</strong></div>
                <div><span>Cierre</span><strong>{selectedActivity.estado === 'cerrada' ? 'Cerrada' : mandatoryMissing ? `${mandatoryMissing} pendiente(s)` : mandatoryUnsaved ? 'Guardar matrices' : 'Disponible'}</strong></div>
              </div>

              <article className="technician-panel">
                <div className="technician-panel__heading"><div><span>Paso 1</span><h3>Notas técnicas</h3></div>{openAI.enabled ? <button type="button" className="technician-ai-button" onClick={() => void improveNotes()} disabled={!online || aiLoading || !selectedDraft.notes.trim() || selectedActivity.bloqueada}>{aiLoading ? 'Puliendo…' : 'Pulir con IA'}</button> : null}</div>
                <textarea value={selectedDraft.notes} onChange={(event) => setNotes(event.target.value)} disabled={selectedActivity.bloqueada} className="input-base technician-notes" placeholder="Hallazgos, diagnóstico, trabajo ejecutado y recomendaciones…" maxLength={20000} />
                {!openAI.enabled && openAI.checked ? <p className="technician-ai-pending">Asistencia de redacción pendiente de credenciales OpenAI.</p> : null}
                <div className="technician-panel__footer"><span>{selectedDraft.notes.length}/20.000</span><button type="button" onClick={() => void saveNotes()} disabled={selectedActivity.bloqueada || selectedQueue.some((entry) => entry.status === 'blocked')}>Guardar notas</button></div>
              </article>

              <article className="technician-panel">
                <div className="technician-panel__heading"><div><span>Paso 2</span><h3>Matrices de cumplimiento</h3></div><small>{selectedActivity.matrices?.length || 0} asignada(s)</small></div>
                {!selectedActivity.matrices?.length ? <div className="technician-empty compact">Esta actividad no tiene matrices asignadas.</div> : null}
                <div className="technician-matrices">
                  {(selectedActivity.matrices || []).map((assignment) => {
                    const missing = missingItems(assignment, selectedDraft);
                    return (
                      <section key={assignment.id} className="technician-matrix">
                        <header><div><strong>{assignment.matrizNombreSnapshot || assignment.definitionSnapshot?.nombre || 'Matriz'}</strong><span>v{assignment.matrizVersion || assignment.definitionSnapshot?.version || 1} · {assignment.matrizCategoria === 'evaluacion' ? 'Evaluación' : 'Informe / resultado'}</span></div><span className={missing.length ? 'is-incomplete' : 'is-complete'}>{assignment.obligatoria ? 'Obligatoria' : 'Opcional'} · {missing.length ? `${missing.length} pendiente(s)` : 'Completa'}</span></header>
                        <div className="technician-matrix-items">
                          {(assignment.items || []).map((item, index) => (
                            <fieldset key={item.itemId} className="technician-matrix-item">
                              <legend className="technician-matrix-item__title"><i>{index + 1}</i><span><strong>{item.titulo}</strong>{item.descripcion ? <small>{item.descripcion}</small> : null}</span>{item.requerido ? <em>Requerido</em> : null}</legend>
                              <MatrixInput item={item} value={selectedDraft.answers?.[assignment.id]?.[item.itemId]} onChange={(value) => setMatrixValue(assignment.id, item.itemId, value)} disabled={selectedActivity.bloqueada || selectedQueue.some((entry) => entry.status === 'blocked')} />
                            </fieldset>
                          ))}
                        </div>
                        <footer><button type="button" onClick={() => void saveMatrix(assignment)} disabled={selectedActivity.bloqueada || selectedQueue.some((entry) => entry.status === 'blocked')}>Guardar matriz</button></footer>
                      </section>
                    );
                  })}
                </div>
              </article>

              <article className="technician-panel">
                <div className="technician-panel__heading"><div><span>Paso 3</span><h3>Fotografías de la actividad</h3></div><small>JPEG, PNG, WebP o GIF · 12 MB</small></div>
                <label className={`technician-photo-picker ${selectedActivity.bloqueada ? 'is-disabled' : ''}`}><input type="file" accept="image/*" capture="environment" multiple disabled={selectedActivity.bloqueada || selectedQueue.some((entry) => entry.status === 'blocked')} onChange={(event) => { void queuePhotos(event.target.files); event.target.value = ''; }} /><span>＋</span><strong>Tomar o agregar fotografías</strong><small>Se guardan como archivos locales; nunca como texto base64.</small></label>
                <div className="technician-photo-grid">
                  {(pendingPhotos[selectedActivity.id] || []).map((photo) => <figure key={photo.mutationId}><Image src={photo.previewUrl} alt={photo.name} width={180} height={120} unoptimized /><figcaption>{photo.name}<span>Pendiente</span></figcaption></figure>)}
                  {(selectedActivity.adjuntos || []).filter((attachment) => String(attachment.mimeType || '').startsWith('image/')).map((attachment) => <div key={attachment.id} className="technician-photo-record"><span>✓</span><strong>{attachment.nombreOriginal}</strong><small>Sincronizada · {Math.round(Number(attachment.sizeBytes || 0) / 1024)} KB</small></div>)}
                </div>
              </article>

              <article className="technician-close-panel">
                <div><span>Paso 4</span><h3>Cerrar y bloquear actividad</h3><p>Después del cierre sólo un administrador podrá desbloquearla dejando motivo y auditoría.</p></div>
                <button type="button" onClick={() => void closeActivity()} disabled={selectedActivity.bloqueada || mandatoryMissing > 0 || mandatoryUnsaved > 0 || selectedQueue.some((entry) => entry.status === 'blocked')}>{selectedActivity.estado === 'cerrada' ? 'Actividad cerrada' : mandatoryMissing ? `Faltan ${mandatoryMissing} respuestas` : mandatoryUnsaved ? 'Guarde las matrices' : 'Cerrar actividad'}</button>
              </article>
            </>
          )}
        </section>
      </div>
    </main>
  );
}
