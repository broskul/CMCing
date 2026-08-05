import { getSupabaseAdmin } from './supabase-server';

const MATRIX_CATEGORIES = new Set(['evaluacion', 'informe_resultado']);
const RESPONSE_TYPES = new Set(['numero', 'dicotomica', 'seleccion_multiple', 'texto']);
const OT_CRITICALITIES = new Set(['baja', 'media', 'alta', 'critica']);
const OT_STATES = new Set(['abierta', 'cerrada', 'cancelada']);

function db() {
  return getSupabaseAdmin();
}

function domainError(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function isMissingServiceWorkSchema(error) {
  return error?.code === 'PGRST205'
    || /Could not find the table.*(OrdenTrabajo|MatrizCumplimiento|MedicionCatalogo)/i.test(error?.message || '');
}

function unwrap(result, context = 'operación') {
  if (!result.error) return result.data;
  if (isMissingServiceWorkSchema(result.error)) {
    throw domainError(
      'Falta aplicar la migración 20260715160000_ordenes_trabajo_matrices_cumplimiento.sql en Supabase.',
      503,
    );
  }
  const error = domainError(`${context}: ${result.error.message}`, 500);
  error.code = result.error.code;
  throw error;
}

function integerId(value, label = 'ID') {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) throw domainError(`${label} inválido.`);
  return id;
}

function optionalIntegerId(value, label = 'ID') {
  if (value === null || value === '' || typeof value === 'undefined') return null;
  return integerId(value, label);
}

function isoDate(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw domainError('Fecha inválida.');
  return date.toISOString();
}

function mapById(rows) {
  return new Map((rows || []).map((row) => [Number(row.id), row]));
}

function uniqueIds(values) {
  return [...new Set((values || []).map(Number).filter((value) => Number.isInteger(value) && value > 0))];
}

function safeText(value, fallback = '') {
  return String(value ?? fallback).trim();
}

function rowLabel(row) {
  return row?.nombre || row?.titulo || row?.descripcion || `#${row?.id || ''}`;
}

function responseValueForItem(item, response) {
  if (!response) return null;
  if (item.tipoRespuesta === 'numero') return response.valorNumero;
  if (item.tipoRespuesta === 'dicotomica') return response.valorBooleano;
  if (item.tipoRespuesta === 'seleccion_multiple') return response.valorOpciones;
  return response.valorTexto;
}

function isAnswered(item, response) {
  const value = responseValueForItem(item, response);
  if (item.tipoRespuesta === 'numero') return value !== null && value !== '' && Number.isFinite(Number(value));
  if (item.tipoRespuesta === 'dicotomica') return typeof value === 'boolean';
  if (item.tipoRespuesta === 'seleccion_multiple') return Array.isArray(value) && value.length > 0;
  return safeText(value).length > 0;
}

async function selectTable(table, { order = 'id', ascending = true, eq = null } = {}) {
  let query = db().from(table).select('*');
  if (eq) query = query.eq(eq.column, eq.value);
  const result = await query.order(order, { ascending });
  return unwrap(result, `No se pudo leer ${table}`) || [];
}

async function selectById(table, id) {
  const result = await db().from(table).select('*').eq('id', integerId(id)).maybeSingle();
  return unwrap(result, `No se pudo leer ${table}`);
}

async function listOrdenTrabajoContext() {
  const [clientes, equipos, tecnicos, tiposActividad, actividades, asignaciones, matrices] = await Promise.all([
    selectTable('Cliente', { order: 'nombre' }),
    selectTable('Equipo', { order: 'nombre' }),
    selectTable('Tecnico', { order: 'nombre' }),
    selectTable('Actividad', { order: 'nombre' }),
    selectTable('OrdenTrabajoActividad'),
    selectTable('ActividadMatrizAsignada'),
    selectTable('MatrizCumplimiento', { order: 'nombre' }),
  ]);

  return {
    clientes: mapById(clientes),
    equipos: mapById(equipos),
    tecnicos: mapById(tecnicos),
    tiposActividad: mapById(tiposActividad),
    actividades,
    asignaciones,
    matrices: mapById(matrices),
  };
}

function formatOrdenTrabajo(orden, context) {
  const actividades = context.actividades
    .filter((actividad) => Number(actividad.ordenTrabajoId) === Number(orden.id))
    .sort((a, b) => new Date(a.fechaProgramada || a.createdAt) - new Date(b.fechaProgramada || b.createdAt))
    .map((actividad) => ({
      ...actividad,
      tecnico: context.tecnicos.get(Number(actividad.tecnicoId)) || null,
      tipoActividad: actividad.actividadId ? context.tiposActividad.get(Number(actividad.actividadId)) || null : null,
      matrices: context.asignaciones
        .filter((asignacion) => Number(asignacion.ordenTrabajoActividadId) === Number(actividad.id))
        .map((asignacion) => ({
          ...asignacion,
          matriz: context.matrices.get(Number(asignacion.matrizId)) || null,
        })),
    }));

  return {
    ...orden,
    cliente: context.clientes.get(Number(orden.clienteId)) || null,
    equipo: orden.equipoId ? context.equipos.get(Number(orden.equipoId)) || null : null,
    actividades,
    resumen: {
      total: actividades.length,
      abiertas: actividades.filter((item) => item.estado === 'abierta').length,
      cerradas: actividades.filter((item) => item.estado === 'cerrada').length,
    },
  };
}

export async function listOrdenesTrabajo() {
  const [ordenes, context] = await Promise.all([
    selectTable('OrdenTrabajo', { order: 'createdAt', ascending: false }),
    listOrdenTrabajoContext(),
  ]);
  return ordenes.map((orden) => formatOrdenTrabajo(orden, context));
}

export async function getOrdenTrabajo(id) {
  const numericId = integerId(id, 'OT');
  return (await listOrdenesTrabajo()).find((orden) => Number(orden.id) === numericId) || null;
}

async function defaultMatrixIdsForActivityType(actividadId) {
  if (!actividadId) return [];
  const rows = await selectTable('ActividadMatrizDefault', {
    eq: { column: 'actividadId', value: actividadId },
  });
  return uniqueIds(rows.map((row) => row.matrizId));
}

async function setActivityMatrices(activityId, actividadTipoId, requestedMatrixIds) {
  const defaultIds = await defaultMatrixIdsForActivityType(actividadTipoId);
  const finalIds = Array.isArray(requestedMatrixIds) ? uniqueIds(requestedMatrixIds) : defaultIds;
  const existing = await selectTable('ActividadMatrizAsignada', {
    eq: { column: 'ordenTrabajoActividadId', value: activityId },
  });
  const existingIds = new Set(existing.map((row) => Number(row.matrizId)));
  const finalIdSet = new Set(finalIds);

  const toRemove = existing.filter((row) => !finalIdSet.has(Number(row.matrizId)));
  for (const row of toRemove) {
    const countResult = await db()
      .from('ActividadMatrizRespuesta')
      .select('id', { count: 'exact', head: true })
      .eq('actividadMatrizAsignadaId', row.id);
    unwrap(countResult, 'No se pudo validar las respuestas de la matriz');
    if ((countResult.count || 0) > 0) {
      throw domainError('No se puede quitar una matriz que ya tiene respuestas.');
    }
    unwrap(await db().from('ActividadMatrizAsignada').delete().eq('id', row.id), 'No se pudo quitar la matriz');
  }

  const rows = finalIds
    .filter((matrizId) => !existingIds.has(matrizId))
    .map((matrizId) => ({
      ordenTrabajoActividadId: activityId,
      matrizId,
      origen: defaultIds.includes(matrizId) ? 'default' : 'manual',
      obligatoria: true,
    }));

  if (rows.length) {
    unwrap(await db().from('ActividadMatrizAsignada').insert(rows), 'No se pudieron asignar las matrices');
  }
}

async function createWorkActivity(ordenTrabajoId, payload, actorUserId) {
  const tecnicoId = integerId(payload.tecnicoId, 'Técnico');
  const actividadId = optionalIntegerId(payload.actividadId, 'Tipo de actividad');
  const titulo = safeText(payload.titulo);
  if (!titulo) throw domainError('Cada actividad debe tener un título.');

  const row = {
    ordenTrabajoId,
    actividadId,
    tecnicoId,
    titulo,
    descripcionBreve: safeText(payload.descripcionBreve) || null,
    fechaProgramada: isoDate(payload.fechaProgramada),
    createdByUsuarioId: actorUserId,
    updatedByUsuarioId: actorUserId,
  };
  const result = await db().from('OrdenTrabajoActividad').insert(row).select('*').single();
  const activity = unwrap(result, 'No se pudo crear la actividad');
  await setActivityMatrices(activity.id, actividadId, payload.matrizIds);
  return activity;
}

export async function createOrdenTrabajo(payload, actor) {
  const titulo = safeText(payload.titulo);
  if (!titulo) throw domainError('La OT debe tener un título.');
  const clienteId = integerId(payload.clienteId, 'Cliente');
  const requestedCriticality = payload.criticidad ?? payload.prioridad;
  const criticidad = OT_CRITICALITIES.has(requestedCriticality) ? requestedCriticality : 'media';
  const actorUserId = integerId(actor.id, 'Usuario');
  const activities = Array.isArray(payload.actividades) ? payload.actividades : [];
  const equipoId = optionalIntegerId(payload.equipoId, 'Equipo');

  if (equipoId) {
    const equipo = await selectById('Equipo', equipoId);
    if (!equipo) throw domainError('Equipo no encontrado.', 404);
    if (Number(equipo.clienteId) !== clienteId) {
      throw domainError('El equipo seleccionado pertenece a otro cliente.');
    }
  }

  const result = await db().from('OrdenTrabajo').insert({
    titulo,
    descripcion: safeText(payload.descripcion) || null,
    clienteId,
    equipoId,
    criticidad,
    prioridad: criticidad,
    fechaProgramada: isoDate(payload.fechaProgramada),
    createdByUsuarioId: actorUserId,
  }).select('*').single();
  const orden = unwrap(result, 'No se pudo crear la OT');

  try {
    for (const activity of activities) {
      await createWorkActivity(orden.id, activity, actorUserId);
    }
  } catch (error) {
    await db().from('OrdenTrabajo').delete().eq('id', orden.id);
    throw error;
  }

  return getOrdenTrabajo(orden.id);
}

export async function addOrdenTrabajoActivity(ordenTrabajoId, payload, actor) {
  const orden = await selectById('OrdenTrabajo', ordenTrabajoId);
  if (!orden) throw domainError('OT no encontrada.', 404);
  if (orden.estado !== 'abierta') throw domainError('Solo se pueden agregar actividades a una OT abierta.', 409);
  const activity = await createWorkActivity(orden.id, payload, integerId(actor.id, 'Usuario'));
  return getActividadTrabajo(activity.id);
}

export async function updateOrdenTrabajo(id, payload) {
  const ordenId = integerId(id, 'OT');
  const current = await selectById('OrdenTrabajo', ordenId);
  if (!current) throw domainError('OT no encontrada.', 404);
  const update = {};
  if ('titulo' in payload) {
    update.titulo = safeText(payload.titulo);
    if (!update.titulo) throw domainError('La OT debe tener un título.');
  }
  if ('descripcion' in payload) update.descripcion = safeText(payload.descripcion) || null;
  if ('clienteId' in payload) update.clienteId = integerId(payload.clienteId, 'Cliente');
  if ('equipoId' in payload) update.equipoId = optionalIntegerId(payload.equipoId, 'Equipo');
  const targetEquipmentId = 'equipoId' in update ? update.equipoId : current.equipoId;
  if (targetEquipmentId) {
    const equipo = await selectById('Equipo', targetEquipmentId);
    const clientId = Number(update.clienteId ?? current.clienteId);
    if (!equipo) throw domainError('Equipo no encontrado.', 404);
    if (Number(equipo.clienteId) !== clientId) throw domainError('El equipo seleccionado pertenece a otro cliente.');
  }
  if ('criticidad' in payload || 'prioridad' in payload) {
    const criticidad = payload.criticidad ?? payload.prioridad;
    if (!OT_CRITICALITIES.has(criticidad)) throw domainError('Criticidad inválida.');
    update.criticidad = criticidad;
    update.prioridad = criticidad;
  }
  if ('estado' in payload) {
    if (!OT_STATES.has(payload.estado)) throw domainError('Estado de OT inválido.');
    update.estado = payload.estado;
    update.fechaCierre = payload.estado === 'cerrada' ? new Date().toISOString() : null;
  }
  if ('fechaProgramada' in payload) update.fechaProgramada = isoDate(payload.fechaProgramada);

  unwrap(await db().from('OrdenTrabajo').update(update).eq('id', ordenId), 'No se pudo actualizar la OT');
  return getOrdenTrabajo(ordenId);
}

export async function getServiceWorkCatalogs() {
  const [clientes, equipos, tecnicos, tiposActividad, matrices, mediciones, defaults] = await Promise.all([
    selectTable('Cliente', { order: 'nombre' }),
    selectTable('Equipo', { order: 'nombre' }),
    selectTable('Tecnico', { order: 'nombre' }),
    selectTable('Actividad', { order: 'nombre' }),
    selectTable('MatrizCumplimiento', { order: 'nombre' }),
    selectTable('MedicionCatalogo', { order: 'nombre' }),
    selectTable('ActividadMatrizDefault'),
  ]);
  const cmcingClient = clientes.find((row) => row.esEmpresaCMCing);
  return {
    clientes: [
      ...clientes.filter((row) => !row.esEmpresaCMCing),
      ...(cmcingClient ? [{ ...cmcingClient, nombre: 'CMCing · Equipo propio' }] : []),
    ],
    equipmentOwners: [
      ...(cmcingClient ? [{ id: 'CMCING', nombre: 'CMCing', detalle: 'Equipo propio de CMCing', propietarioTipo: 'CMCING' }] : []),
      ...clientes.filter((row) => !row.esEmpresaCMCing).map((row) => ({
        id: String(row.id),
        nombre: row.nombre,
        detalle: row.rut || 'Cliente',
        propietarioTipo: 'CLIENTE',
      })),
    ],
    equipos: equipos.map((row) => ({
      ...row,
      propietarioTipo: Number(row.clienteId) === Number(cmcingClient?.id) ? 'CMCING' : 'CLIENTE',
    })),
    tecnicos: tecnicos.filter((row) => row.activo !== false),
    tiposActividad: tiposActividad.filter((row) => row.activa !== false).map((row) => ({
      ...row,
      matrizIdsDefault: defaults.filter((item) => Number(item.actividadId) === Number(row.id)).map((item) => Number(item.matrizId)),
    })),
    matrices: matrices.filter((row) => row.activa !== false),
    mediciones: mediciones.filter((row) => row.activa !== false),
  };
}

export async function listMatricesCumplimiento() {
  const [matrices, items, mediciones, defaults, tiposActividad] = await Promise.all([
    selectTable('MatrizCumplimiento', { order: 'nombre' }),
    selectTable('MatrizItem'),
    selectTable('MedicionCatalogo', { order: 'nombre' }),
    selectTable('ActividadMatrizDefault'),
    selectTable('Actividad', { order: 'nombre' }),
  ]);
  const medicionesById = mapById(mediciones);
  const tiposById = mapById(tiposActividad);
  return matrices.map((matriz) => ({
    ...matriz,
    items: items
      .filter((item) => Number(item.matrizId) === Number(matriz.id))
      .sort((a, b) => Number(a.orden) - Number(b.orden))
      .map((item) => ({
        ...item,
        medicion: item.medicionId ? medicionesById.get(Number(item.medicionId)) || null : null,
      })),
    actividadesDefault: defaults
      .filter((row) => Number(row.matrizId) === Number(matriz.id))
      .map((row) => tiposById.get(Number(row.actividadId)))
      .filter(Boolean),
  }));
}

export async function getMatrizCumplimiento(id) {
  const matrizId = integerId(id, 'Matriz');
  return (await listMatricesCumplimiento()).find((item) => Number(item.id) === matrizId) || null;
}

function validateMatrixItem(item, index) {
  const titulo = safeText(item.titulo);
  if (!titulo) throw domainError(`El ítem ${index + 1} necesita un título.`);
  if (!RESPONSE_TYPES.has(item.tipoRespuesta)) throw domainError(`Tipo de respuesta inválido en ${titulo}.`);
  const opciones = item.tipoRespuesta === 'seleccion_multiple'
    ? [...new Set((Array.isArray(item.opciones) ? item.opciones : String(item.opciones || '').split('\n')).map(safeText).filter(Boolean))]
    : [];
  if (item.tipoRespuesta === 'seleccion_multiple' && opciones.length < 2) {
    throw domainError(`${titulo} necesita al menos dos opciones.`);
  }
  return {
    titulo,
    descripcion: safeText(item.descripcion) || null,
    tipoRespuesta: item.tipoRespuesta,
    medicionId: item.tipoRespuesta === 'numero' ? optionalIntegerId(item.medicionId, 'Medición') : null,
    opciones,
    requerido: item.requerido !== false,
    orden: Number(item.orden || index + 1),
  };
}

export async function createMatrizCumplimiento(payload, actor) {
  const nombre = safeText(payload.nombre);
  if (!nombre) throw domainError('La matriz debe tener un nombre.');
  if (!MATRIX_CATEGORIES.has(payload.categoria)) throw domainError('Categoría de matriz inválida.');
  const items = (Array.isArray(payload.items) ? payload.items : []).map(validateMatrixItem);
  if (!items.length) throw domainError('La matriz debe contener al menos un ítem.');

  const result = await db().from('MatrizCumplimiento').insert({
    nombre,
    descripcion: safeText(payload.descripcion) || null,
    categoria: payload.categoria,
    createdByUsuarioId: integerId(actor.id, 'Usuario'),
  }).select('*').single();
  const matriz = unwrap(result, 'No se pudo crear la matriz');

  try {
    unwrap(await db().from('MatrizItem').insert(items.map((item) => ({ ...item, matrizId: matriz.id }))), 'No se pudieron crear los ítems');
    const defaultActivityIds = uniqueIds(payload.defaultActividadIds);
    if (defaultActivityIds.length) {
      unwrap(await db().from('ActividadMatrizDefault').insert(
        defaultActivityIds.map((actividadId) => ({ actividadId, matrizId: matriz.id })),
      ), 'No se pudieron asignar las actividades por defecto');
    }
  } catch (error) {
    await db().from('MatrizCumplimiento').delete().eq('id', matriz.id);
    throw error;
  }
  return getMatrizCumplimiento(matriz.id);
}

export async function updateMatrizCumplimiento(id, payload) {
  const matrizId = integerId(id, 'Matriz');
  const current = await getMatrizCumplimiento(matrizId);
  if (!current) throw domainError('Matriz no encontrada.', 404);
  const update = {};
  if ('nombre' in payload) {
    update.nombre = safeText(payload.nombre);
    if (!update.nombre) throw domainError('La matriz debe tener un nombre.');
  }
  if ('descripcion' in payload) update.descripcion = safeText(payload.descripcion) || null;
  if ('activa' in payload) update.activa = Boolean(payload.activa);
  if ('categoria' in payload) {
    if (!MATRIX_CATEGORIES.has(payload.categoria)) throw domainError('Categoría inválida.');
    update.categoria = payload.categoria;
  }
  if (Object.keys(update).length) {
    unwrap(await db().from('MatrizCumplimiento').update(update).eq('id', matrizId), 'No se pudo actualizar la matriz');
  }

  if (Array.isArray(payload.defaultActividadIds)) {
    unwrap(await db().from('ActividadMatrizDefault').delete().eq('matrizId', matrizId), 'No se pudieron actualizar los valores por defecto');
    const ids = uniqueIds(payload.defaultActividadIds);
    if (ids.length) {
      unwrap(await db().from('ActividadMatrizDefault').insert(ids.map((actividadId) => ({ actividadId, matrizId }))), 'No se pudieron actualizar los valores por defecto');
    }
  }
  return getMatrizCumplimiento(matrizId);
}

export async function listMedicionesCatalogo() {
  return selectTable('MedicionCatalogo', { order: 'nombre' });
}

export async function createMedicionCatalogo(payload) {
  const nombre = safeText(payload.nombre);
  if (!nombre) throw domainError('La medición debe tener un nombre.');
  const result = await db().from('MedicionCatalogo').insert({
    nombre,
    unidad: safeText(payload.unidad) || null,
    simbolo: safeText(payload.simbolo) || null,
    descripcion: safeText(payload.descripcion) || null,
  }).select('*').single();
  return unwrap(result, 'No se pudo crear la medición');
}

async function getActivityContext(activityId) {
  const activity = await selectById('OrdenTrabajoActividad', activityId);
  if (!activity) return null;
  const [orden, cliente, equipo, tecnico, tipoActividad, asignaciones, adjuntos, auditoria] = await Promise.all([
    selectById('OrdenTrabajo', activity.ordenTrabajoId),
    selectById('OrdenTrabajo', activity.ordenTrabajoId).then((ot) => (ot ? selectById('Cliente', ot.clienteId) : null)),
    selectById('OrdenTrabajo', activity.ordenTrabajoId).then((ot) => (ot?.equipoId ? selectById('Equipo', ot.equipoId) : null)),
    selectById('Tecnico', activity.tecnicoId),
    activity.actividadId ? selectById('Actividad', activity.actividadId) : null,
    selectTable('ActividadMatrizAsignada', { eq: { column: 'ordenTrabajoActividadId', value: activity.id } }),
    selectTable('ArchivoAdjunto', { eq: { column: 'ordenTrabajoActividadId', value: activity.id } }),
    selectTable('ActividadAuditoria', { order: 'createdAt', ascending: false, eq: { column: 'ordenTrabajoActividadId', value: activity.id } }),
  ]);
  const actorIds = uniqueIds(auditoria.map((row) => row.actorUsuarioId));
  let actors = [];
  if (actorIds.length) {
    const actorResult = await db().from('Usuario').select('id,nombre,email,rol').in('id', actorIds);
    actors = unwrap(actorResult, 'No se pudo leer los usuarios de auditoría') || [];
  }
  const actorById = mapById(actors);
  const matrizIds = uniqueIds(asignaciones.map((row) => row.matrizId));
  let matrices = [];
  let items = [];
  let respuestas = [];
  let mediciones = [];
  if (matrizIds.length) {
    matrices = unwrap(await db().from('MatrizCumplimiento').select('*').in('id', matrizIds), 'No se pudieron leer las matrices') || [];
    items = unwrap(await db().from('MatrizItem').select('*').in('matrizId', matrizIds).order('orden'), 'No se pudieron leer los ítems') || [];
    const assignmentIds = asignaciones.map((row) => row.id);
    respuestas = assignmentIds.length
      ? unwrap(await db().from('ActividadMatrizRespuesta').select('*').in('actividadMatrizAsignadaId', assignmentIds), 'No se pudieron leer las respuestas') || []
      : [];
    const medicionIds = uniqueIds(items.map((row) => row.medicionId));
    mediciones = medicionIds.length
      ? unwrap(await db().from('MedicionCatalogo').select('*').in('id', medicionIds), 'No se pudieron leer las mediciones') || []
      : [];
  }
  return {
    activity,
    orden,
    cliente,
    equipo,
    tecnico,
    tipoActividad,
    asignaciones,
    adjuntos,
    auditoria: auditoria.map((row) => ({ ...row, actor: actorById.get(Number(row.actorUsuarioId)) || null })),
    matrices,
    items,
    respuestas,
    mediciones,
  };
}

export async function getActividadTrabajo(id) {
  const context = await getActivityContext(integerId(id, 'Actividad'));
  if (!context) return null;
  const matricesById = mapById(context.matrices);
  const medicionesById = mapById(context.mediciones);
  return {
    ...context.activity,
    ordenTrabajo: context.orden ? { ...context.orden, cliente: context.cliente, equipo: context.equipo } : null,
    tecnico: context.tecnico,
    tipoActividad: context.tipoActividad,
    adjuntos: context.adjuntos,
    auditoria: context.auditoria,
    matrices: context.asignaciones.map((assignment) => {
      const matrixItems = context.items
        .filter((item) => Number(item.matrizId) === Number(assignment.matrizId))
        .map((item) => ({
          ...item,
          medicion: item.medicionId ? medicionesById.get(Number(item.medicionId)) || null : null,
          respuesta: context.respuestas.find((response) => (
            Number(response.actividadMatrizAsignadaId) === Number(assignment.id)
            && Number(response.matrizItemId) === Number(item.id)
          )) || null,
        }));
      return {
        ...assignment,
        matriz: matricesById.get(Number(assignment.matrizId)) || null,
        items: matrixItems,
        completa: matrixItems.filter((item) => item.requerido).every((item) => isAnswered(item, item.respuesta)),
      };
    }),
  };
}

export async function updateActividadTrabajo(id, payload, actor) {
  const activityId = integerId(id, 'Actividad');
  const current = await selectById('OrdenTrabajoActividad', activityId);
  if (!current) throw domainError('Actividad no encontrada.', 404);
  if (current.bloqueada || current.estado === 'cerrada') {
    throw domainError('La actividad está cerrada y bloqueada. Un administrador debe desbloquearla.', 409);
  }
  const update = { updatedByUsuarioId: integerId(actor.id, 'Usuario') };
  if ('titulo' in payload) {
    update.titulo = safeText(payload.titulo);
    if (!update.titulo) throw domainError('La actividad debe tener un título.');
  }
  if ('descripcionBreve' in payload) update.descripcionBreve = safeText(payload.descripcionBreve) || null;
  if ('notasTecnico' in payload) update.notasTecnico = safeText(payload.notasTecnico) || null;
  if ('tecnicoId' in payload) update.tecnicoId = integerId(payload.tecnicoId, 'Técnico');
  if ('actividadId' in payload) update.actividadId = optionalIntegerId(payload.actividadId, 'Tipo de actividad');
  if ('fechaProgramada' in payload) update.fechaProgramada = isoDate(payload.fechaProgramada);
  if ('fechaInicio' in payload) update.fechaInicio = isoDate(payload.fechaInicio);
  unwrap(await db().from('OrdenTrabajoActividad').update(update).eq('id', activityId), 'No se pudo actualizar la actividad');

  if (Array.isArray(payload.matrizIds)) {
    await setActivityMatrices(activityId, update.actividadId ?? current.actividadId, payload.matrizIds);
  }
  return getActividadTrabajo(activityId);
}

function normalizeResponse(item, rawValue, assignmentId, actorUserId) {
  const base = {
    actividadMatrizAsignadaId: assignmentId,
    matrizItemId: item.id,
    valorNumero: null,
    valorBooleano: null,
    valorTexto: null,
    valorOpciones: null,
    respondidoByUsuarioId: actorUserId,
    respondidoAt: new Date().toISOString(),
  };
  if (item.tipoRespuesta === 'numero') {
    if (rawValue === '' || rawValue === null || typeof rawValue === 'undefined') return null;
    const value = Number(rawValue);
    if (!Number.isFinite(value)) throw domainError(`${item.titulo}: ingrese un número válido.`);
    base.valorNumero = value;
  } else if (item.tipoRespuesta === 'dicotomica') {
    if (typeof rawValue !== 'boolean') return null;
    base.valorBooleano = rawValue;
  } else if (item.tipoRespuesta === 'seleccion_multiple') {
    if (!Array.isArray(rawValue) || rawValue.length === 0) return null;
    const allowed = new Set(Array.isArray(item.opciones) ? item.opciones : []);
    const values = [...new Set(rawValue.map(safeText).filter((value) => allowed.has(value)))];
    if (!values.length) throw domainError(`${item.titulo}: seleccione una opción válida.`);
    base.valorOpciones = values;
  } else {
    const value = safeText(rawValue);
    if (!value) return null;
    base.valorTexto = value;
  }
  return base;
}

export async function saveActivityMatrixResponses(activityIdValue, payload, actor) {
  const activityId = integerId(activityIdValue, 'Actividad');
  const activity = await getActividadTrabajo(activityId);
  if (!activity) throw domainError('Actividad no encontrada.', 404);
  if (activity.bloqueada) throw domainError('La actividad está cerrada y no admite respuestas.', 409);
  const assignmentId = integerId(payload.asignacionId, 'Asignación de matriz');
  const assignment = activity.matrices.find((item) => Number(item.id) === assignmentId);
  if (!assignment) throw domainError('La matriz no está asignada a esta actividad.', 404);
  const values = payload.respuestas && typeof payload.respuestas === 'object' ? payload.respuestas : {};
  const actorUserId = integerId(actor.id, 'Usuario');

  for (const item of assignment.items) {
    const row = normalizeResponse(item, values[item.id], assignmentId, actorUserId);
    if (!row) {
      unwrap(
        await db().from('ActividadMatrizRespuesta').delete().eq('actividadMatrizAsignadaId', assignmentId).eq('matrizItemId', item.id),
        'No se pudo limpiar la respuesta',
      );
      continue;
    }
    unwrap(
      await db().from('ActividadMatrizRespuesta').upsert(row, { onConflict: 'actividadMatrizAsignadaId,matrizItemId' }),
      'No se pudo guardar la respuesta',
    );
  }

  const refreshed = await getActividadTrabajo(activityId);
  const refreshedAssignment = refreshed.matrices.find((item) => Number(item.id) === assignmentId);
  unwrap(await db().from('ActividadMatrizAsignada').update({
    estado: refreshedAssignment.completa ? 'completa' : 'pendiente',
    completedAt: refreshedAssignment.completa ? new Date().toISOString() : null,
  }).eq('id', assignmentId), 'No se pudo actualizar el estado de la matriz');
  unwrap(await db().from('ActividadAuditoria').insert({
    ordenTrabajoActividadId: activityId,
    accion: 'ACTUALIZACION',
    actorUsuarioId: actorUserId,
    motivo: `Respuestas actualizadas en matriz ${rowLabel(refreshedAssignment.matriz)}`,
    datosDespues: { asignacionId, completa: refreshedAssignment.completa },
  }), 'No se pudo registrar la auditoría de respuestas');
  return getActividadTrabajo(activityId);
}

export async function closeActividadTrabajo(id, actor) {
  const activityId = integerId(id, 'Actividad');
  const activity = await getActividadTrabajo(activityId);
  if (!activity) throw domainError('Actividad no encontrada.', 404);
  if (activity.bloqueada || activity.estado === 'cerrada') throw domainError('La actividad ya está cerrada.', 409);
  const incomplete = activity.matrices.filter((matrix) => matrix.obligatoria && !matrix.completa);
  if (incomplete.length) {
    throw domainError(`Debe completar las matrices obligatorias: ${incomplete.map((item) => rowLabel(item.matriz)).join(', ')}.`, 409);
  }
  const now = new Date().toISOString();
  unwrap(await db().from('OrdenTrabajoActividad').update({
    estado: 'cerrada',
    bloqueada: true,
    bloqueadaAt: now,
    fechaCierre: now,
    updatedByUsuarioId: integerId(actor.id, 'Usuario'),
  }).eq('id', activityId), 'No se pudo cerrar la actividad');

  const openResult = await db()
    .from('OrdenTrabajoActividad')
    .select('id', { count: 'exact', head: true })
    .eq('ordenTrabajoId', activity.ordenTrabajoId)
    .eq('estado', 'abierta');
  unwrap(openResult, 'No se pudo validar el estado de la OT');
  if ((openResult.count || 0) === 0) {
    unwrap(await db().from('OrdenTrabajo').update({ estado: 'cerrada', fechaCierre: now }).eq('id', activity.ordenTrabajoId), 'No se pudo cerrar la OT');
  }
  return getActividadTrabajo(activityId);
}

export async function unlockActividadTrabajo(id, motivo, actor) {
  const activityId = integerId(id, 'Actividad');
  const cleanReason = safeText(motivo);
  if (cleanReason.length < 10) throw domainError('El motivo debe tener al menos 10 caracteres.');
  const result = await db().rpc('desbloquear_orden_trabajo_actividad', {
    p_actividad_id: activityId,
    p_actor_usuario_id: integerId(actor.id, 'Usuario'),
    p_motivo: cleanReason,
  });
  unwrap(result, 'No se pudo desbloquear la actividad');
  const activity = await selectById('OrdenTrabajoActividad', activityId);
  if (activity) {
    unwrap(await db().from('OrdenTrabajo').update({ estado: 'abierta', fechaCierre: null }).eq('id', activity.ordenTrabajoId), 'No se pudo reabrir la OT');
  }
  return getActividadTrabajo(activityId);
}

export async function createActividadAdjunto(activityIdValue, metadata, actor) {
  const activityId = integerId(activityIdValue, 'Actividad');
  const activity = await selectById('OrdenTrabajoActividad', activityId);
  if (!activity) throw domainError('Actividad no encontrada.', 404);
  if (activity.bloqueada) throw domainError('La actividad está cerrada y no admite imágenes.', 409);
  const existingResult = await db().from('ArchivoAdjunto').select('*').eq('r2Key', metadata.r2Key).maybeSingle();
  unwrap(existingResult, 'No se pudo validar la idempotencia del adjunto');
  if (existingResult.data) {
    if (Number(existingResult.data.ordenTrabajoActividadId) !== activityId) {
      throw domainError('La evidencia ya pertenece a otra actividad.', 409);
    }
    return existingResult.data;
  }
  const result = await db().rpc('registrar_adjunto_actividad', {
    p_actividad_id: activityId,
    p_actor_usuario_id: integerId(actor?.id, 'Usuario'),
    p_archivo: {
      tipo: metadata.tipo || 'imagen_actividad',
      nombreOriginal: metadata.nombreOriginal,
      mimeType: metadata.mimeType,
      sizeBytes: metadata.sizeBytes,
      r2Bucket: metadata.r2Bucket,
      r2Key: metadata.r2Key,
      checksumSha256: metadata.checksumSha256,
      metadata: metadata.metadata || {},
    },
  }).single();
  return unwrap(result, 'No se pudo registrar la imagen y su auditoría');
}

export async function getServiceWorkDashboardStats() {
  const [ordenes, actividadesAbiertas, actividadesCerradas, matrices] = await Promise.all([
    db().from('OrdenTrabajo').select('id', { count: 'exact', head: true }),
    db().from('OrdenTrabajoActividad').select('id', { count: 'exact', head: true }).eq('estado', 'abierta'),
    db().from('OrdenTrabajoActividad').select('id', { count: 'exact', head: true }).eq('estado', 'cerrada'),
    db().from('MatrizCumplimiento').select('id', { count: 'exact', head: true }).eq('activa', true),
  ]);
  [ordenes, actividadesAbiertas, actividadesCerradas, matrices].forEach((result) => unwrap(result, 'No se pudo leer el resumen de servicio técnico'));
  return {
    ordenesTrabajo: ordenes.count || 0,
    actividadesAbiertas: actividadesAbiertas.count || 0,
    actividadesCerradas: actividadesCerradas.count || 0,
    matrices: matrices.count || 0,
  };
}
