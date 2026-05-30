import { assertSupabaseResult, getSupabaseAdmin } from './supabase-server';

const ESTADOS_VISITA = ['pendiente', 'en_progreso', 'completada', 'cancelada'];

const ENTITY_CONFIG = {
  clientes: {
    table: 'Cliente',
    writable: ['nombre', 'email', 'telefono', 'direccion'],
    get: getCliente,
  },
  equipos: {
    table: 'Equipo',
    writable: [
      'sku',
      'codigoInterno',
      'nombre',
      'modelo',
      'serial',
      'categoria',
      'fabricante',
      'ubicacion',
      'imagenUrl',
      'fechaInstalacion',
      'fechaGarantiaFin',
      'estadoOperativo',
      'criticidad',
      'ultimaMantencion',
      'proximaMantencion',
      'observaciones',
      'clienteId',
    ],
    get: getEquipo,
  },
  servicios: {
    table: 'Servicio',
    writable: ['descripcion', 'precio', 'tipo', 'duracionEstimadaMin', 'activo'],
    get: getServicio,
  },
  actividades: {
    table: 'Actividad',
    writable: ['nombre', 'descripcion', 'tipo', 'duracionEstimadaMin', 'obligatoria', 'activa'],
    get: getActividad,
  },
  vendedores: {
    table: 'Vendedor',
    writable: ['nombre', 'email', 'telefono'],
    get: getVendedor,
  },
  tecnicos: {
    table: 'Tecnico',
    writable: [
      'nombre',
      'especialidad',
      'email',
      'telefono',
      'firmaTexto',
      'firmaImagenUrl',
      'firmaImagenR2Key',
      'firmaUpdatedAt',
      'activo',
    ],
    get: getTecnico,
  },
  visitas: {
    table: 'Visita',
    writable: [
      'codigo',
      'clienteId',
      'equipoId',
      'tecnicoId',
      'vendedorId',
      'servicioId',
      'fecha',
      'fechaProgramada',
      'fechaFinProgramada',
      'fechaInicio',
      'fechaCierre',
      'descripcion',
      'notasTecnicas',
      'estado',
      'prioridad',
      'tipoVisita',
      'duracionMin',
      'costoManoObra',
      'costoRepuestos',
      'calendarEventId',
      'clienteMutationId',
      'clientMutationId',
      'offlineEstado',
      'signedAt',
      'firmaTecnicoTexto',
      'firmaTecnicoImagenUrl',
      'selfieAdjuntoId',
    ],
    get: getVisita,
  },
  cotizaciones: {
    table: 'Cotizacion',
    writable: [
      'numero',
      'clienteId',
      'vendedorId',
      'fecha',
      'validaHasta',
      'estado',
      'moneda',
      'descuentoGlobalPct',
      'impuestoPct',
      'subtotal',
      'descuentoMonto',
      'impuestoMonto',
      'total',
      'observaciones',
    ],
    get: getCotizacion,
  },
  adjuntos: {
    table: 'ArchivoAdjunto',
    writable: [
      'visitaId',
      'visitaActividadId',
      'tecnicoId',
      'syncJobId',
      'tipo',
      'nombreOriginal',
      'mimeType',
      'sizeBytes',
      'r2Bucket',
      'r2Key',
      'publicUrl',
      'checksumSha256',
      'metadata',
    ],
    get: null,
  },
  syncJobs: {
    table: 'ColaSincronizacion',
    writable: [
      'clientMutationId',
      'usuarioId',
      'tecnicoId',
      'visitaId',
      'entidad',
      'accion',
      'estado',
      'payload',
      'error',
      'attempts',
      'queuedAt',
      'syncedAt',
    ],
    get: null,
  },
};

const ID_FIELDS = new Set([
  'clienteId',
  'equipoId',
  'tecnicoId',
  'vendedorId',
  'servicioId',
  'actividadId',
  'responsableTecnicoId',
  'visitaId',
  'visitaActividadId',
  'syncJobId',
  'usuarioId',
  'selfieAdjuntoId',
]);

const NUMBER_FIELDS = new Set([
  'precio',
  'duracionEstimadaMin',
  'duracionMin',
  'sizeBytes',
  'attempts',
  'cantidad',
  'precioUnitario',
  'descuentoPct',
  'lineaTotal',
  'descuentoGlobalPct',
  'impuestoPct',
  'subtotal',
  'descuentoMonto',
  'impuestoMonto',
  'total',
  'costoManoObra',
  'costoRepuestos',
  'costo',
  'orden',
]);

const DATE_FIELDS = new Set([
  'fecha',
  'fechaProgramada',
  'fechaFinProgramada',
  'fechaInicio',
  'fechaCierre',
  'signedAt',
  'firmaUpdatedAt',
  'queuedAt',
  'syncedAt',
  'validaHasta',
  'fechaInstalacion',
  'fechaGarantiaFin',
  'ultimaMantencion',
  'proximaMantencion',
  'fechaEvento',
  'fechaReal',
  'lastLoginAt',
]);

const BOOLEAN_FIELDS = new Set(['activo', 'obligatoria', 'activa']);

function supabase() {
  return getSupabaseAdmin();
}

function numericId(id) {
  const value = Number(id);
  return Number.isInteger(value) ? value : null;
}

function normalizeNumber(value) {
  if (value === null || value === '' || typeof value === 'undefined') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : value;
}

function normalizeDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toISOString();
}

function normalizeBoolean(value) {
  if (typeof value === 'boolean') return value;
  if (value === 'true') return true;
  if (value === 'false') return false;
  return Boolean(value);
}

function normalizeRow(row) {
  if (!row) return null;

  return Object.fromEntries(Object.entries(row).map(([key, value]) => {
    if (NUMBER_FIELDS.has(key) && value !== null && typeof value !== 'undefined') {
      return [key, Number(value)];
    }

    return [key, value];
  }));
}

function normalizeRows(rows) {
  return (rows || []).map((row) => normalizeRow(row));
}

function isMissingTableError(error) {
  return error?.code === 'PGRST205' || /Could not find the table/i.test(error?.message || '');
}

function getMissingColumn(error) {
  const message = error?.message || '';
  const postgrestMatch = message.match(/Could not find the '([^']+)' column/i);
  if (postgrestMatch?.[1]) return postgrestMatch[1];

  const postgresMatch = message.match(/column "([^"]+)" of relation/i);
  if (postgresMatch?.[1]) return postgresMatch[1];

  return null;
}

function isPolicyError(error) {
  return error?.code === '42501' || /row-level security policy/i.test(error?.message || '');
}

function pickWritable(entity, payload) {
  const config = ENTITY_CONFIG[entity];
  if (!config) throw new Error(`Entidad no soportada: ${entity}`);

  const normalized = {};

  config.writable.forEach((field) => {
    if (!(field in payload)) return;
    let value = payload[field];

    if (ID_FIELDS.has(field)) {
      value = value === null || value === '' || typeof value === 'undefined' ? null : Number(value);
    } else if (NUMBER_FIELDS.has(field)) {
      value = normalizeNumber(value);
    } else if (DATE_FIELDS.has(field)) {
      value = normalizeDate(value);
    } else if (BOOLEAN_FIELDS.has(field)) {
      value = normalizeBoolean(value);
    }

    normalized[field] = value;
  });

  return normalized;
}

function ensureEstado(estado) {
  if (!estado) return 'pendiente';
  if (!ESTADOS_VISITA.includes(estado)) {
    throw new Error(`Estado inválido. Usa: ${ESTADOS_VISITA.join(', ')}`);
  }
  return estado;
}

function getVisitaEquipoIds(visita, visitaEquipos = []) {
  const ids = visitaEquipos
    .filter((item) => item.visitaId === visita.id)
    .map((item) => item.equipoId);

  if (visita.equipoId) ids.push(visita.equipoId);

  return [...new Set(ids.filter((id) => Number.isInteger(Number(id))).map((id) => Number(id)))];
}

function calculateCotizacion(cotizacion) {
  const items = Array.isArray(cotizacion.items) ? cotizacion.items : [];
  const normalizedItems = items.map((item, index) => {
    const cantidad = Number(item.cantidad || 0);
    const precioUnitario = Number(item.precioUnitario || 0);
    const descuentoPct = Number(item.descuentoPct || 0);
    const lineaTotal = Math.round(cantidad * precioUnitario * (1 - descuentoPct / 100));

    return {
      ...item,
      cantidad,
      precioUnitario,
      descuentoPct,
      lineaTotal,
      orden: Number(item.orden || index + 1),
    };
  });

  const subtotal = normalizedItems.reduce((sum, item) => sum + item.lineaTotal, 0);
  const descuentoGlobalPct = Number(cotizacion.descuentoGlobalPct || 0);
  const impuestoPct = Number(cotizacion.impuestoPct ?? 19);
  const descuentoMonto = Math.round(subtotal * (descuentoGlobalPct / 100));
  const base = subtotal - descuentoMonto;
  const impuestoMonto = Math.round(base * (impuestoPct / 100));

  return {
    ...cotizacion,
    items: normalizedItems,
    descuentoGlobalPct,
    impuestoPct,
    subtotal,
    descuentoMonto,
    impuestoMonto,
    total: base + impuestoMonto,
  };
}

async function selectAll(table, order = 'id', ascending = true, { optional = false } = {}) {
  const result = await supabase()
    .from(table)
    .select('*')
    .order(order, { ascending });

  if (optional && isMissingTableError(result.error)) return [];

  return normalizeRows(assertSupabaseResult(result));
}

async function selectById(table, id) {
  const result = await supabase()
    .from(table)
    .select('*')
    .eq('id', numericId(id))
    .maybeSingle();

  return normalizeRow(assertSupabaseResult(result));
}

async function fetchTable(table, options = {}) {
  return selectAll(table, 'id', true, options);
}

function mapById(rows) {
  return new Map((rows || []).map((row) => [row.id, row]));
}

function shortCliente(cliente) {
  return cliente ? { id: cliente.id, nombre: cliente.nombre, email: cliente.email } : null;
}

function shortEquipo(equipo) {
  return equipo ? {
    id: equipo.id,
    sku: equipo.sku,
    nombre: equipo.nombre,
    serial: equipo.serial,
    modelo: equipo.modelo,
    fabricante: equipo.fabricante,
    ubicacion: equipo.ubicacion,
    imagenUrl: equipo.imagenUrl,
  } : null;
}

function shortTecnico(tecnico) {
  return tecnico ? {
    id: tecnico.id,
    nombre: tecnico.nombre,
    firmaTexto: tecnico.firmaTexto,
    firmaImagenUrl: tecnico.firmaImagenUrl,
    firmaImagenR2Key: tecnico.firmaImagenR2Key,
  } : null;
}

function shortVendedor(vendedor) {
  return vendedor ? { id: vendedor.id, nombre: vendedor.nombre, email: vendedor.email } : null;
}

function shortServicio(servicio) {
  return servicio ? {
    id: servicio.id,
    descripcion: servicio.descripcion,
    precio: Number(servicio.precio || 0),
  } : null;
}

function formatVisita(visita, context) {
  const cliente = context.clientes.get(visita.clienteId);
  const tecnico = context.tecnicos.get(visita.tecnicoId);
  const vendedor = visita.vendedorId ? context.vendedores.get(visita.vendedorId) : null;
  const servicio = context.servicios.get(visita.servicioId);
  const equipoIds = getVisitaEquipoIds(visita, context.visitaEquipos);
  const equipos = equipoIds.map((equipoId) => shortEquipo(context.equipos.get(equipoId))).filter(Boolean);
  const adjuntos = context.adjuntos.filter((adjunto) => adjunto.visitaId === visita.id);

  return {
    ...visita,
    clientMutationId: visita.clientMutationId || visita.clienteMutationId || null,
    equipoIds,
    equipoId: equipos[0]?.id || null,
    cliente: shortCliente(cliente),
    equipo: equipos[0] || null,
    equipos,
    tecnico: shortTecnico(tecnico),
    vendedor: shortVendedor(vendedor),
    servicio: shortServicio(servicio),
    adjuntos,
  };
}

async function getVisitaContext() {
  const [clientes, equipos, tecnicos, vendedores, servicios, visitaEquipos, adjuntos] = await Promise.all([
    fetchTable('Cliente'),
    fetchTable('Equipo'),
    fetchTable('Tecnico'),
    fetchTable('Vendedor'),
    fetchTable('Servicio'),
    fetchTable('VisitaEquipo'),
    fetchTable('ArchivoAdjunto', { optional: true }),
  ]);

  return {
    clientes: mapById(clientes),
    equipos: mapById(equipos),
    tecnicos: mapById(tecnicos),
    vendedores: mapById(vendedores),
    servicios: mapById(servicios),
    visitaEquipos,
    adjuntos,
  };
}

async function upsertVisitaEquipos(visitaId, equipoIds) {
  const normalizedIds = [...new Set((equipoIds || []).map((id) => Number(id)).filter(Number.isInteger))];

  const deleteResult = await supabase()
    .from('VisitaEquipo')
    .delete()
    .eq('visitaId', visitaId);
  if (isPolicyError(deleteResult.error)) return;
  assertSupabaseResult(deleteResult);

  if (!normalizedIds.length) return;

  const insertResult = await supabase()
    .from('VisitaEquipo')
    .insert(normalizedIds.map((equipoId) => ({ visitaId, equipoId })));
  if (isPolicyError(insertResult.error)) return;
  assertSupabaseResult(insertResult);
}

async function insertRow(entity, payload) {
  const config = ENTITY_CONFIG[entity];
  const nextPayload = { ...payload };

  for (let attempt = 0; attempt < 20; attempt += 1) {
    const result = await supabase()
      .from(config.table)
      .insert(nextPayload)
      .select('*')
      .single();

    if (!result.error) return normalizeRow(result.data);

    const missingColumn = getMissingColumn(result.error);
    if (missingColumn && missingColumn in nextPayload) {
      delete nextPayload[missingColumn];
      continue;
    }

    throw new Error(result.error.message);
  }

  throw new Error(`No se pudo insertar ${entity}: demasiadas columnas incompatibles.`);
}

async function updateRow(entity, id, payload) {
  const config = ENTITY_CONFIG[entity];
  const nextPayload = { ...payload };

  for (let attempt = 0; attempt < 20; attempt += 1) {
    const result = await supabase()
      .from(config.table)
      .update(nextPayload)
      .eq('id', numericId(id))
      .select('*')
      .maybeSingle();

    if (!result.error) return normalizeRow(result.data);

    const missingColumn = getMissingColumn(result.error);
    if (missingColumn && missingColumn in nextPayload) {
      delete nextPayload[missingColumn];
      continue;
    }

    throw new Error(result.error.message);
  }

  throw new Error(`No se pudo actualizar ${entity}: demasiadas columnas incompatibles.`);
}

async function createVisita(payload) {
  const equipoIds = Array.isArray(payload.equipoIds)
    ? payload.equipoIds.map((id) => Number(id)).filter(Number.isInteger)
    : [];
  const row = pickWritable('visitas', {
    ...payload,
    estado: ensureEstado(payload.estado),
    fecha: payload.fecha || new Date().toISOString(),
    equipoId: equipoIds[0] || payload.equipoId || null,
  });

  const visita = await insertRow('visitas', row);
  await upsertVisitaEquipos(visita.id, equipoIds.length ? equipoIds : [visita.equipoId].filter(Boolean));

  return getVisita(visita.id);
}

async function updateVisita(id, payload) {
  const updatePayload = { ...payload };
  if ('estado' in updatePayload) updatePayload.estado = ensureEstado(updatePayload.estado);

  if ('equipoIds' in updatePayload && Array.isArray(updatePayload.equipoIds)) {
    updatePayload.equipoId = updatePayload.equipoIds[0] || null;
  }

  const visita = await updateRow('visitas', id, pickWritable('visitas', updatePayload));
  if (!visita) return null;

  if ('equipoIds' in updatePayload || 'equipoId' in updatePayload) {
    const equipoIds = Array.isArray(updatePayload.equipoIds)
      ? updatePayload.equipoIds
      : [updatePayload.equipoId].filter(Boolean);
    await upsertVisitaEquipos(visita.id, equipoIds);
  }

  return getVisita(visita.id);
}

async function insertCotizacionItems(cotizacionId, items) {
  const normalizedItems = (items || []).map((item, index) => {
    const calculated = calculateCotizacion({ items: [item] }).items[0];

    return {
      cotizacionId,
      servicioId: item.servicioId ? Number(item.servicioId) : null,
      equipoId: item.equipoId ? Number(item.equipoId) : null,
      descripcion: item.descripcion || '',
      cantidad: calculated.cantidad,
      precioUnitario: calculated.precioUnitario,
      descuentoPct: calculated.descuentoPct,
      orden: Number(item.orden || index + 1),
    };
  });

  if (!normalizedItems.length) return;

  const result = await supabase()
    .from('CotizacionItem')
    .insert(normalizedItems);
  assertSupabaseResult(result);
}

async function createCotizacion(payload) {
  const calculated = calculateCotizacion(payload);
  const cotizacionPayload = pickWritable('cotizaciones', {
    ...calculated,
    fecha: calculated.fecha || new Date().toISOString(),
    moneda: calculated.moneda || 'CLP',
    estado: calculated.estado || 'borrador',
  });

  const cotizacion = await insertRow('cotizaciones', cotizacionPayload);
  await insertCotizacionItems(cotizacion.id, calculated.items);

  return getCotizacion(cotizacion.id);
}

async function updateCotizacion(id, payload) {
  const calculated = calculateCotizacion(payload);
  const cotizacionPayload = pickWritable('cotizaciones', calculated);
  const cotizacion = Object.keys(cotizacionPayload).length
    ? await updateRow('cotizaciones', id, cotizacionPayload)
    : await selectById('Cotizacion', id);

  if (!cotizacion) return null;

  if ('items' in payload) {
    const deleteResult = await supabase()
      .from('CotizacionItem')
      .delete()
      .eq('cotizacionId', numericId(id));
    assertSupabaseResult(deleteResult);
    await insertCotizacionItems(numericId(id), calculated.items);
  }

  return getCotizacion(id);
}

export async function createEntity(entity, payload) {
  if (entity === 'visitas') return createVisita(payload);
  if (entity === 'cotizaciones') return createCotizacion(payload);

  const row = await insertRow(entity, pickWritable(entity, payload));
  const config = ENTITY_CONFIG[entity];

  return config.get ? config.get(row.id) : row;
}

export async function updateEntity(entity, id, payload) {
  if (entity === 'visitas') return updateVisita(id, payload);
  if (entity === 'cotizaciones') return updateCotizacion(id, payload);

  const row = await updateRow(entity, id, pickWritable(entity, payload));
  if (!row) return null;

  const config = ENTITY_CONFIG[entity];
  return config.get ? config.get(row.id) : row;
}

export async function deleteEntity(entity, id) {
  const config = ENTITY_CONFIG[entity];
  if (!config) throw new Error(`Entidad no soportada: ${entity}`);

  const current = await selectById(config.table, id);
  if (!current) return false;

  const result = await supabase()
    .from(config.table)
    .delete()
    .eq('id', numericId(id));
  assertSupabaseResult(result);

  return true;
}

export async function listClientes() {
  const [clientes, equipos, visitas] = await Promise.all([
    selectAll('Cliente', 'nombre'),
    fetchTable('Equipo'),
    fetchTable('Visita'),
  ]);

  return clientes.map((cliente) => ({
    ...cliente,
    equipos: equipos
      .filter((equipo) => equipo.clienteId === cliente.id)
      .map((equipo) => ({ id: equipo.id, nombre: equipo.nombre, modelo: equipo.modelo, serial: equipo.serial, imagenUrl: equipo.imagenUrl })),
    visitas: visitas
      .filter((visita) => visita.clienteId === cliente.id)
      .map((visita) => ({ id: visita.id, fecha: visita.fecha, descripcion: visita.descripcion, estado: visita.estado })),
  }));
}

export async function getCliente(id) {
  return (await listClientes()).find((cliente) => cliente.id === numericId(id)) || null;
}

export async function listEquipos() {
  const [equipos, clientes, visitas, visitaEquipos, hojaVida, tecnicos, servicios] = await Promise.all([
    selectAll('Equipo', 'nombre'),
    fetchTable('Cliente'),
    fetchTable('Visita'),
    fetchTable('VisitaEquipo'),
    fetchTable('EquipoHojaVida', { optional: true }),
    fetchTable('Tecnico'),
    fetchTable('Servicio'),
  ]);
  const clientesById = mapById(clientes);
  const tecnicosById = mapById(tecnicos);
  const serviciosById = mapById(servicios);

  return equipos.map((equipo) => {
    const visitasEquipo = visitas.filter((visita) => getVisitaEquipoIds(visita, visitaEquipos).includes(equipo.id));
    const hojaVidaDb = hojaVida.filter((evento) => evento.equipoId === equipo.id);
    const hojaVidaBase = hojaVidaDb.length
      ? hojaVidaDb.map((evento) => {
        const tecnico = evento.tecnicoId ? tecnicosById.get(evento.tecnicoId) : null;
        const visita = evento.visitaId ? visitas.find((item) => item.id === evento.visitaId) : null;

        return {
          ...evento,
          tecnico: tecnico?.nombre || '-',
          estado: visita?.estado || '',
        };
      })
      : visitasEquipo.map((visita) => {
        const tecnico = tecnicosById.get(visita.tecnicoId);
        const servicio = serviciosById.get(visita.servicioId);

        return {
          id: visita.id,
          fechaEvento: visita.fechaCierre || visita.fecha,
          tipoEvento: visita.tipoVisita || servicio?.tipo || 'servicio',
          titulo: servicio?.descripcion || 'Servicio técnico',
          detalle: visita.notasTecnicas || visita.descripcion || '',
          tecnico: tecnico?.nombre || '-',
          estado: visita.estado,
        };
      });

    return {
      ...equipo,
      cliente: shortCliente(clientesById.get(equipo.clienteId)),
      visitas: visitasEquipo.map((visita) => ({ id: visita.id, fecha: visita.fecha, descripcion: visita.descripcion, estado: visita.estado })),
      hojaVida: hojaVidaBase.sort((a, b) => new Date(b.fechaEvento).getTime() - new Date(a.fechaEvento).getTime()),
    };
  });
}

export async function getEquipo(id) {
  return (await listEquipos()).find((equipo) => equipo.id === numericId(id)) || null;
}

export async function listServicios() {
  const [servicios, visitas] = await Promise.all([
    selectAll('Servicio', 'descripcion'),
    fetchTable('Visita'),
  ]);

  return servicios.map((servicio) => ({
    ...servicio,
    visitas: visitas
      .filter((visita) => visita.servicioId === servicio.id)
      .map((visita) => ({ id: visita.id, fecha: visita.fecha, descripcion: visita.descripcion, estado: visita.estado })),
  }));
}

export async function getServicio(id) {
  return (await listServicios()).find((servicio) => servicio.id === numericId(id)) || null;
}

export async function listActividades() {
  const [actividades, visitaActividades, visitas] = await Promise.all([
    selectAll('Actividad', 'nombre'),
    fetchTable('VisitaActividad'),
    fetchTable('Visita'),
  ]);
  const visitasById = mapById(visitas);

  return actividades.map((actividad) => ({
    ...actividad,
    visitas: visitaActividades
      .filter((item) => item.actividadId === actividad.id)
      .map((item) => visitasById.get(item.visitaId))
      .filter(Boolean)
      .map((visita) => ({ id: visita.id, fecha: visita.fecha, descripcion: visita.descripcion, estado: visita.estado })),
  }));
}

export async function getActividad(id) {
  return (await listActividades()).find((actividad) => actividad.id === numericId(id)) || null;
}

export async function listVendedores() {
  const [vendedores, visitas] = await Promise.all([
    selectAll('Vendedor', 'nombre'),
    fetchTable('Visita'),
  ]);

  return vendedores.map((vendedor) => ({
    ...vendedor,
    visitas: visitas
      .filter((visita) => visita.vendedorId === vendedor.id)
      .map((visita) => ({ id: visita.id, fecha: visita.fecha, descripcion: visita.descripcion, estado: visita.estado })),
  }));
}

export async function getVendedor(id) {
  return (await listVendedores()).find((vendedor) => vendedor.id === numericId(id)) || null;
}

export async function listTecnicos() {
  const [tecnicos, visitas] = await Promise.all([
    selectAll('Tecnico', 'nombre'),
    fetchTable('Visita'),
  ]);

  return tecnicos.map((tecnico) => ({
    ...tecnico,
    visitas: visitas
      .filter((visita) => visita.tecnicoId === tecnico.id)
      .map((visita) => ({ id: visita.id, fecha: visita.fecha, descripcion: visita.descripcion, estado: visita.estado })),
  }));
}

export async function getTecnico(id) {
  return (await listTecnicos()).find((tecnico) => tecnico.id === numericId(id)) || null;
}

export async function listVisitas() {
  const [visitas, context] = await Promise.all([
    selectAll('Visita', 'fecha', false),
    getVisitaContext(),
  ]);

  return visitas.map((visita) => formatVisita(visita, context));
}

export async function getVisita(id) {
  return (await listVisitas()).find((visita) => visita.id === numericId(id)) || null;
}

async function getCotizacionContext() {
  const [clientes, vendedores, equipos, servicios, items] = await Promise.all([
    fetchTable('Cliente'),
    fetchTable('Vendedor'),
    fetchTable('Equipo'),
    fetchTable('Servicio'),
    fetchTable('CotizacionItem'),
  ]);

  return {
    clientes: mapById(clientes),
    vendedores: mapById(vendedores),
    equipos: mapById(equipos),
    servicios: mapById(servicios),
    items,
  };
}

function formatCotizacion(cotizacion, context) {
  const items = context.items
    .filter((item) => item.cotizacionId === cotizacion.id)
    .sort((a, b) => a.orden - b.orden)
    .map((item) => ({
      ...item,
      equipo: item.equipoId ? shortEquipo(context.equipos.get(item.equipoId)) : null,
      servicio: item.servicioId ? shortServicio(context.servicios.get(item.servicioId)) : null,
    }));

  return {
    ...cotizacion,
    cliente: shortCliente(context.clientes.get(cotizacion.clienteId)),
    vendedor: cotizacion.vendedorId ? shortVendedor(context.vendedores.get(cotizacion.vendedorId)) : null,
    items,
  };
}

export async function listCotizaciones() {
  const [cotizaciones, context] = await Promise.all([
    selectAll('Cotizacion', 'fecha', false),
    getCotizacionContext(),
  ]);

  return cotizaciones.map((cotizacion) => formatCotizacion(cotizacion, context));
}

export async function getCotizacion(id) {
  return (await listCotizaciones()).find((cotizacion) => cotizacion.id === numericId(id)) || null;
}

export async function listAdjuntos() {
  return fetchTable('ArchivoAdjunto', { optional: true });
}

export async function listSyncJobs() {
  return fetchTable('ColaSincronizacion', { optional: true });
}

export async function getDashboardStats() {
  const [clientes, cotizaciones, equipos, tecnicos, visitas] = await Promise.all([
    supabase().from('Cliente').select('id', { count: 'exact', head: true }),
    supabase().from('Cotizacion').select('id', { count: 'exact', head: true }),
    supabase().from('Equipo').select('id', { count: 'exact', head: true }),
    supabase().from('Tecnico').select('id', { count: 'exact', head: true }),
    supabase().from('Visita').select('id', { count: 'exact', head: true }),
  ]);

  [clientes, cotizaciones, equipos, tecnicos, visitas].forEach(assertSupabaseResult);

  return {
    clientes: clientes.count || 0,
    cotizaciones: cotizaciones.count || 0,
    equipos: equipos.count || 0,
    tecnicos: tecnicos.count || 0,
    visitas: visitas.count || 0,
  };
}

function applyDateRange(visitas, desde, hasta) {
  return visitas.filter((visita) => {
    const fecha = new Date(visita.fecha);

    if (desde) {
      const desdeDate = new Date(desde);
      if (fecha < desdeDate) return false;
    }

    if (hasta) {
      const hastaDate = new Date(hasta);
      hastaDate.setHours(23, 59, 59, 999);
      if (fecha > hastaDate) return false;
    }

    return true;
  });
}

export async function getInformeVisitas(filters = {}) {
  const { desde, hasta, estado, clienteId } = filters;
  let visitas = await listVisitas();

  if (estado && estado !== 'todos') {
    visitas = visitas.filter((visita) => visita.estado === estado);
  }

  if (clienteId) {
    visitas = visitas.filter((visita) => visita.clienteId === Number(clienteId));
  }

  visitas = applyDateRange(visitas, desde, hasta)
    .sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());

  const productos = visitas
    .flatMap((visita) => visita.equipos || (visita.equipo ? [visita.equipo] : []))
    .reduce((acc, equipo) => {
      if (!acc.some((producto) => producto.id === equipo.id)) {
        acc.push({
          id: equipo.id,
          nombre: equipo.nombre,
          modelo: equipo.modelo,
          serial: equipo.serial,
          imagenUrl: equipo.imagenUrl,
        });
      }
      return acc;
    }, []);

  return {
    filtros: { desde: desde || '', hasta: hasta || '', estado: estado || 'todos', clienteId: clienteId || '' },
    total: visitas.length,
    visitas,
    productos,
  };
}

export async function getInformeFacturacion(filters = {}) {
  const { desde, hasta } = filters;
  const visitasFiltradas = applyDateRange(await listVisitas(), desde, hasta);
  const resumenPorServicio = {};
  const resumenPorCliente = {};
  let totalServicios = 0;
  let totalFacturado = 0;

  visitasFiltradas.forEach((visita) => {
    const servicioNombre = visita.servicio?.descripcion || 'Servicio sin nombre';
    const clienteNombre = visita.cliente?.nombre || 'Cliente sin nombre';
    const monto = visita.servicio?.precio || 0;

    totalServicios += 1;
    totalFacturado += monto;

    if (!resumenPorServicio[servicioNombre]) {
      resumenPorServicio[servicioNombre] = { servicio: servicioNombre, cantidad: 0, total: 0 };
    }
    resumenPorServicio[servicioNombre].cantidad += 1;
    resumenPorServicio[servicioNombre].total += monto;

    if (!resumenPorCliente[clienteNombre]) {
      resumenPorCliente[clienteNombre] = { cliente: clienteNombre, cantidad: 0, total: 0 };
    }
    resumenPorCliente[clienteNombre].cantidad += 1;
    resumenPorCliente[clienteNombre].total += monto;
  });

  const productos = visitasFiltradas
    .flatMap((visita) => visita.equipos || (visita.equipo ? [visita.equipo] : []))
    .reduce((acc, equipo) => {
      if (!acc.some((producto) => producto.id === equipo.id)) {
        acc.push({
          id: equipo.id,
          nombre: equipo.nombre,
          modelo: equipo.modelo,
          serial: equipo.serial,
          imagenUrl: equipo.imagenUrl,
        });
      }
      return acc;
    }, []);

  return {
    filtros: { desde: desde || '', hasta: hasta || '' },
    totalServicios,
    totalFacturado,
    porServicio: Object.values(resumenPorServicio).sort((a, b) => b.total - a.total),
    porCliente: Object.values(resumenPorCliente).sort((a, b) => b.total - a.total),
    productos,
  };
}
