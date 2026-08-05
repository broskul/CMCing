import { assertSupabaseResult, getSupabaseAdmin } from './supabase-server';

const ESTADOS_VISITA = ['pendiente', 'en_progreso', 'completada', 'cancelada'];

const ENTITY_CONFIG = {
  clientes: {
    table: 'Cliente',
    writable: ['nombre', 'rut', 'email', 'telefono', 'direccion', 'tipoEntidad', 'giro', 'notas'],
    requiredColumns: ['rut'],
    get: getCliente,
  },
  equipos: {
    table: 'Equipo',
    writable: [
      'nombre',
      'modelo',
      'serial',
      'partNumber',
      'ean',
      'categoria',
      'fabricante',
      'ubicacion',
      'fechaInstalacion',
      'fechaGarantiaFin',
      'estadoOperativo',
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
  camiones: {
    table: 'Camion',
    writable: [
      'patente',
      'codigoInterno',
      'marca',
      'modelo',
      'anio',
      'tipo',
      'largoM',
      'anchoM',
      'altoM',
      'taraKg',
      'cargaMaxKg',
      'volumenM3',
      'propietarioTipo',
      'propietarioClienteId',
      'proveedorNombre',
      'estado',
      'observaciones',
    ],
    get: getCamion,
  },
  conductores: {
    table: 'Conductor',
    writable: [
      'nombre',
      'rut',
      'telefono',
      'email',
      'licencia',
      'licenciaVence',
      'estado',
      'observaciones',
    ],
    get: getConductor,
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
      'descuentoGlobalTipo',
      'descuentoGlobalValor',
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
  'camionId',
  'conductorId',
  'contactoId',
  'direccionId',
  'propietarioClienteId',
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
  'anio',
  'largoM',
  'anchoM',
  'altoM',
  'taraKg',
  'cargaMaxKg',
  'volumenM3',
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
  'licenciaVence',
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

  const qualifiedColumnMatch = message.match(/column [^."]+\.([A-Za-z0-9_]+) does not exist/i);
  if (qualifiedColumnMatch?.[1]) return qualifiedColumnMatch[1];

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
    } else if (field === 'rut') {
      value = value ? formatRutText(value) : null;
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
    const sourceServices = Array.isArray(item.servicios) && item.servicios.length
      ? item.servicios
      : item.servicioId ? [item] : [];
    const servicios = sourceServices.map((service, serviceIndex) => {
      const cantidad = Number(service.cantidad || 0);
      const precioUnitario = Number(service.precioUnitario || 0);
      const descuentoTipo = service.descuentoTipo === 'monto' ? 'monto' : 'porcentaje';
      const bruto = Math.round(cantidad * precioUnitario);
      const descuentoValor = Math.max(0, Number(service.descuentoValor ?? service.descuentoPct ?? 0));
      const descuentoMonto = descuentoTipo === 'monto'
        ? Math.min(bruto, descuentoValor)
        : Math.round(bruto * Math.min(descuentoValor, 100) / 100);
      const descuentoPct = bruto > 0 ? Math.round((descuentoMonto * 10000) / bruto) / 100 : 0;

      return {
        ...service,
        servicioId: service.servicioId ? Number(service.servicioId) : null,
        descripcionDetalle: String(service.descripcionDetalle ?? service.descripcion ?? '').trim() || null,
        cantidad,
        precioUnitario,
        descuentoTipo,
        descuentoValor: descuentoTipo === 'monto' ? descuentoValor : Math.min(descuentoValor, 100),
        descuentoPct,
        lineaTotal: Math.max(0, bruto - descuentoMonto),
        orden: Number(service.orden || serviceIndex + 1),
      };
    });
    const lineaTotal = servicios.reduce((sum, service) => sum + service.lineaTotal, 0);

    return {
      ...item,
      equipoId: item.equipoId ? Number(item.equipoId) : null,
      servicios,
      lineaTotal,
      orden: Number(item.orden || index + 1),
    };
  });

  const subtotal = normalizedItems.reduce((sum, item) => sum + item.lineaTotal, 0);
  const descuentoGlobalTipo = cotizacion.descuentoGlobalTipo === 'monto' ? 'monto' : 'porcentaje';
  const descuentoGlobalValor = Math.max(0, Number(cotizacion.descuentoGlobalValor ?? cotizacion.descuentoGlobalPct ?? 0));
  const impuestoPct = Number(cotizacion.impuestoPct ?? 19);
  const descuentoMonto = descuentoGlobalTipo === 'monto'
    ? Math.min(subtotal, descuentoGlobalValor)
    : Math.round(subtotal * Math.min(descuentoGlobalValor, 100) / 100);
  const descuentoGlobalPct = subtotal > 0 ? Math.round((descuentoMonto * 10000) / subtotal) / 100 : 0;
  const base = subtotal - descuentoMonto;
  const impuestoMonto = Math.round(base * (impuestoPct / 100));

  return {
    ...cotizacion,
    items: normalizedItems,
    descuentoGlobalTipo,
    descuentoGlobalValor: descuentoGlobalTipo === 'monto' ? descuentoGlobalValor : Math.min(descuentoGlobalValor, 100),
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
  return cliente ? {
    id: cliente.id,
    nombre: cliente.nombre,
    esEmpresaCMCing: Boolean(cliente.esEmpresaCMCing),
    email: cliente.email,
    telefono: cliente.telefono,
    direccion: cliente.direccion,
  } : null;
}

function shortEquipo(equipo) {
  return equipo ? {
    id: equipo.id,
    codigoInterno: equipo.codigoInterno,
    nombre: equipo.nombre,
    serial: equipo.serial,
    modelo: equipo.modelo,
    partNumber: equipo.partNumber,
    ean: equipo.ean,
    fabricante: equipo.fabricante,
    ubicacion: equipo.ubicacion,
    imagenUrl: equipo.imagenUrl,
    imagenR2Key: equipo.imagenR2Key,
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
    tipo: servicio.tipo,
  } : null;
}

function shortCamion(camion) {
  return camion ? {
    id: camion.id,
    patente: camion.patente,
    codigoInterno: camion.codigoInterno,
    marca: camion.marca,
    modelo: camion.modelo,
    tipo: camion.tipo,
    estado: camion.estado,
  } : null;
}

function shortConductor(conductor) {
  return conductor ? {
    id: conductor.id,
    nombre: conductor.nombre,
    rut: conductor.rut,
    telefono: conductor.telefono,
    licencia: conductor.licencia,
    estado: conductor.estado,
  } : null;
}

function normalizeRutText(value) {
  return String(value || '')
    .replace(/\./g, '')
    .replace(/-/g, '')
    .trim()
    .toUpperCase();
}

function formatRutText(value) {
  const clean = normalizeRutText(value);
  if (clean.length < 2) return String(value || '').trim();
  return `${clean.slice(0, -1)}-${clean.slice(-1)}`;
}

function getPrivateFileUrl(adjunto) {
  if (!adjunto?.r2Key) return adjunto?.publicUrl || adjunto?.url || '';
  return `/api/r2/private?key=${encodeURIComponent(adjunto.r2Key)}`;
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
      if (config.requiredColumns?.includes(missingColumn)) {
        throw new Error(`Falta aplicar la migración de base de datos para la columna ${missingColumn}.`);
      }
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
      if (config.requiredColumns?.includes(missingColumn)) {
        throw new Error(`Falta aplicar la migración de base de datos para la columna ${missingColumn}.`);
      }
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
  const calculatedItems = calculateCotizacion({ items }).items;
  if (!calculatedItems.length) return;

  const [equipos, servicios] = await Promise.all([
    fetchTable('Equipo'),
    fetchTable('Servicio'),
  ]);
  const equiposById = mapById(equipos);
  const serviciosById = mapById(servicios);

  for (const item of calculatedItems) {
    const equipo = equiposById.get(item.equipoId);
    if (!equipo) throw new Error('El ítem seleccionado ya no está disponible. Actualiza la cotización e inténtalo nuevamente.');

    const nombre = String(equipo.nombre || '').trim();
    const codigo = [equipo.partNumber, equipo.ean, equipo.serial, equipo.codigoInterno]
      .map((value) => String(value || '').trim())
      .find(Boolean) || null;
    const descripcion = [equipo.fabricante, equipo.modelo]
      .map((value) => String(value || '').trim())
      .filter(Boolean)
      .join(' · ') || nombre;
    const primaryServiceId = item.servicios[0]?.servicioId || null;

    const itemResult = await supabase()
      .from('CotizacionItem')
      .insert({
        cotizacionId,
        servicioId: primaryServiceId,
        equipoId: item.equipoId,
        nombre,
        codigo,
        descripcion,
        cantidad: 1,
        precioUnitario: 0,
        descuentoTipo: 'porcentaje',
        descuentoValor: 0,
        descuentoPct: 0,
        orden: item.orden,
      })
      .select('id')
      .single();
    assertSupabaseResult(itemResult);

    const serviceRows = item.servicios.map((service) => {
      const catalogService = serviciosById.get(service.servicioId);
      if (!catalogService) throw new Error('Uno de los servicios seleccionados ya no está disponible. Actualiza la cotización e inténtalo nuevamente.');

      return {
        cotizacionItemId: itemResult.data.id,
        servicioId: service.servicioId,
        nombre: String(catalogService.descripcion || catalogService.nombre || 'Servicio').trim(),
        descripcionDetalle: service.descripcionDetalle,
        cantidad: service.cantidad,
        precioUnitario: service.precioUnitario,
        descuentoTipo: service.descuentoTipo,
        descuentoValor: service.descuentoValor,
        descuentoPct: service.descuentoPct,
        orden: service.orden,
      };
    });
    const serviceResult = await supabase().from('CotizacionItemServicio').insert(serviceRows);
    assertSupabaseResult(serviceResult);
  }
}

function assertValidCotizacion(payload) {
  if (!Number.isInteger(Number(payload?.clienteId))) {
    throw new Error('Debes seleccionar un cliente para la cotización.');
  }

  if (!Array.isArray(payload?.items) || payload.items.length === 0) {
    throw new Error('Agrega al menos un ítem a la cotización.');
  }

  payload.items.forEach((item, index) => {
    if (!Number.isInteger(Number(item?.equipoId))) throw new Error(`Debes seleccionar el ítem ${index + 1}.`);
    if (!Array.isArray(item?.servicios) || item.servicios.length === 0) throw new Error(`El ítem ${index + 1} debe incluir al menos un servicio.`);
    item.servicios.forEach((service, serviceIndex) => {
      if (!Number.isInteger(Number(service?.servicioId))) throw new Error(`Debes seleccionar el servicio ${serviceIndex + 1} del ítem ${index + 1}.`);
      if (!Number.isFinite(Number(service?.cantidad)) || Number(service.cantidad) <= 0) throw new Error(`La cantidad del servicio ${serviceIndex + 1} del ítem ${index + 1} debe ser mayor que cero.`);
      if (!Number.isFinite(Number(service?.precioUnitario)) || Number(service.precioUnitario) < 0) throw new Error(`El precio unitario del servicio ${serviceIndex + 1} del ítem ${index + 1} no es válido.`);
    });
  });
}

async function createCotizacion(payload) {
  assertValidCotizacion(payload);
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
  if ('items' in payload) assertValidCotizacion(payload);
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

async function syncCamionConductorLinks(ownerField, ownerId, targetField, targetIds) {
  const normalizedIds = [...new Set((targetIds || []).map((id) => Number(id)).filter(Number.isInteger))];
  const desiredIds = new Set(normalizedIds);

  const existingResult = await supabase()
    .from('CamionConductor')
    .select('*')
    .eq(ownerField, Number(ownerId));
  if (isMissingTableError(existingResult.error)) {
    throw new Error('Falta aplicar la migración de transporte para CamionConductor.');
  }
  const existingRows = normalizeRows(assertSupabaseResult(existingResult));
  const existingByTarget = new Map(existingRows.map((row) => [Number(row[targetField]), row]));

  await Promise.all(existingRows.map((row) => {
    const shouldBeActive = desiredIds.has(Number(row[targetField]));
    if (Boolean(row.activo) === shouldBeActive) return null;
    return supabase()
      .from('CamionConductor')
      .update({ activo: shouldBeActive })
      .eq('id', row.id)
      .then(assertSupabaseResult);
  }).filter(Boolean));

  const missingIds = normalizedIds.filter((targetId) => !existingByTarget.has(targetId));
  if (!missingIds.length) return;

  const insertResult = await supabase()
    .from('CamionConductor')
    .insert(missingIds.map((targetId) => ({
      [ownerField]: Number(ownerId),
      [targetField]: targetId,
      activo: true,
    })));
  assertSupabaseResult(insertResult);
}

async function upsertCamionConductores(camionId, conductorIds) {
  return syncCamionConductorLinks('camionId', camionId, 'conductorId', conductorIds);
}

async function upsertConductorCamiones(conductorId, camionIds) {
  return syncCamionConductorLinks('conductorId', conductorId, 'camionId', camionIds);
}

async function createCamion(payload) {
  const row = await insertRow('camiones', pickWritable('camiones', {
    ...payload,
    patente: String(payload.patente || '').trim().toUpperCase(),
  }));
  await upsertCamionConductores(row.id, payload.conductorIds);
  return getCamion(row.id);
}

async function updateCamion(id, payload) {
  const nextPayload = { ...payload };
  if ('patente' in nextPayload) nextPayload.patente = String(nextPayload.patente || '').trim().toUpperCase();
  const row = await updateRow('camiones', id, pickWritable('camiones', nextPayload));
  if (!row) return null;
  if ('conductorIds' in payload) await upsertCamionConductores(row.id, payload.conductorIds);
  return getCamion(row.id);
}

async function createConductor(payload) {
  const row = await insertRow('conductores', pickWritable('conductores', payload));
  await upsertConductorCamiones(row.id, payload.camionIds);
  return getConductor(row.id);
}

async function updateConductor(id, payload) {
  const row = await updateRow('conductores', id, pickWritable('conductores', payload));
  if (!row) return null;
  if ('camionIds' in payload) await upsertConductorCamiones(row.id, payload.camionIds);
  return getConductor(row.id);
}

export async function createEntity(entity, payload) {
  if (entity === 'visitas') return createVisita(payload);
  if (entity === 'cotizaciones') return createCotizacion(payload);
  if (entity === 'camiones') return createCamion(payload);
  if (entity === 'conductores') return createConductor(payload);

  const row = await insertRow(entity, pickWritable(entity, payload));
  const config = ENTITY_CONFIG[entity];

  return config.get ? config.get(row.id) : row;
}

export async function updateEntity(entity, id, payload) {
  if (entity === 'visitas') return updateVisita(id, payload);
  if (entity === 'cotizaciones') return updateCotizacion(id, payload);
  if (entity === 'camiones') return updateCamion(id, payload);
  if (entity === 'conductores') return updateConductor(id, payload);

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
  const [clientes, equipos, visitas, contactos, direcciones, cotizaciones, ordenesTrabajo, adjuntos] = await Promise.all([
    selectAll('Cliente', 'nombre'),
    fetchTable('Equipo'),
    fetchTable('Visita'),
    fetchTable('ClienteContacto', { optional: true }),
    fetchTable('ClienteDireccion', { optional: true }),
    fetchTable('Cotizacion', { optional: true }),
    fetchTable('OrdenTrabajo', { optional: true }),
    fetchTable('ArchivoAdjunto', { optional: true }),
  ]);

  return clientes.filter((cliente) => !cliente.esEmpresaCMCing).map((cliente) => ({
    ...cliente,
    contactos: contactos.filter((contacto) => contacto.clienteId === cliente.id),
    direcciones: direcciones.filter((direccion) => direccion.clienteId === cliente.id),
    equipos: equipos
      .filter((equipo) => equipo.clienteId === cliente.id)
      .map((equipo) => ({ id: equipo.id, nombre: equipo.nombre, modelo: equipo.modelo, serial: equipo.serial, partNumber: equipo.partNumber, ean: equipo.ean, imagenUrl: equipo.imagenUrl, imagenR2Key: equipo.imagenR2Key })),
    visitas: visitas
      .filter((visita) => visita.clienteId === cliente.id)
      .map((visita) => ({ id: visita.id, fecha: visita.fecha, descripcion: visita.descripcion, estado: visita.estado })),
    historial: [
      ...visitas
        .filter((visita) => visita.clienteId === cliente.id)
        .map((visita) => ({
          id: `visita-${visita.id}`,
          tipo: 'Visita',
          titulo: visita.codigo || visita.descripcion || `Visita ${visita.id}`,
          fecha: visita.fecha,
          estado: visita.estado,
          refId: visita.id,
        })),
      ...ordenesTrabajo
        .filter((orden) => orden.clienteId === cliente.id)
        .map((orden) => ({
          id: `ot-${orden.id}`,
          tipo: 'Orden de trabajo',
          titulo: orden.titulo || `OT ${orden.id}`,
          fecha: orden.fechaProgramada || orden.createdAt,
          estado: orden.estado,
          refId: orden.id,
        })),
      ...cotizaciones
        .filter((cotizacion) => cotizacion.clienteId === cliente.id)
        .map((cotizacion) => ({
          id: `cotizacion-${cotizacion.id}`,
          tipo: 'Cotización',
          titulo: cotizacion.numero || `Cotización ${cotizacion.id}`,
          fecha: cotizacion.fecha,
          estado: cotizacion.estado,
          refId: cotizacion.id,
        })),
    ].sort((a, b) => new Date(b.fecha || 0).getTime() - new Date(a.fecha || 0).getTime()),
    documentos: [
      ...cotizaciones
        .filter((cotizacion) => cotizacion.clienteId === cliente.id)
        .map((cotizacion) => ({
          id: `cotizacion-${cotizacion.id}`,
          tipo: 'Cotización',
          nombre: cotizacion.numero || `Cotización ${cotizacion.id}`,
          fecha: cotizacion.fecha,
          estado: cotizacion.estado,
        })),
      ...adjuntos
        .filter((adjunto) => visitas.some((visita) => visita.clienteId === cliente.id && visita.id === adjunto.visitaId))
        .map((adjunto) => ({
          id: `adjunto-${adjunto.id}`,
          tipo: adjunto.tipo || 'Adjunto',
          nombre: adjunto.nombreOriginal || adjunto.r2Key || `Adjunto ${adjunto.id}`,
          fecha: adjunto.createdAt,
          url: getPrivateFileUrl(adjunto),
        })),
    ].sort((a, b) => new Date(b.fecha || 0).getTime() - new Date(a.fecha || 0).getTime()),
  }));
}

export async function getCliente(id) {
  return (await listClientes()).find((cliente) => cliente.id === numericId(id)) || null;
}

function cleanText(value) {
  const text = String(value || '').trim();
  return text || null;
}

export async function createClienteContacto(clienteId, payload) {
  const row = {
    clienteId: numericId(clienteId),
    nombre: cleanText(payload.nombre),
    cargo: cleanText(payload.cargo),
    email: cleanText(payload.email),
    telefono: cleanText(payload.telefono),
    rol: cleanText(payload.rol) || 'principal',
    principal: Boolean(payload.principal),
    notas: cleanText(payload.notas),
  };
  if (!row.clienteId || !row.nombre) throw new Error('Contacto incompleto.');
  const result = await supabase().from('ClienteContacto').insert(row).select('*').single();
  return normalizeRow(assertSupabaseResult(result));
}

export async function updateClienteContacto(clienteId, contactoId, payload) {
  const row = {};
  ['nombre', 'cargo', 'email', 'telefono', 'rol', 'notas'].forEach((field) => {
    if (field in payload) row[field] = cleanText(payload[field]);
  });
  if ('principal' in payload) row.principal = Boolean(payload.principal);
  const result = await supabase()
    .from('ClienteContacto')
    .update(row)
    .eq('clienteId', numericId(clienteId))
    .eq('id', numericId(contactoId))
    .select('*')
    .maybeSingle();
  return normalizeRow(assertSupabaseResult(result));
}

export async function deleteClienteContacto(clienteId, contactoId) {
  const result = await supabase()
    .from('ClienteContacto')
    .delete()
    .eq('clienteId', numericId(clienteId))
    .eq('id', numericId(contactoId));
  assertSupabaseResult(result);
  return true;
}

export async function createClienteDireccion(clienteId, payload) {
  const row = {
    clienteId: numericId(clienteId),
    tipo: cleanText(payload.tipo) || 'servicio',
    nombre: cleanText(payload.nombre),
    direccion: cleanText(payload.direccion),
    comuna: cleanText(payload.comuna),
    ciudad: cleanText(payload.ciudad),
    region: cleanText(payload.region),
    principal: Boolean(payload.principal),
    notas: cleanText(payload.notas),
  };
  if (!row.clienteId || !row.direccion) throw new Error('Dirección incompleta.');
  const result = await supabase().from('ClienteDireccion').insert(row).select('*').single();
  return normalizeRow(assertSupabaseResult(result));
}

export async function updateClienteDireccion(clienteId, direccionId, payload) {
  const row = {};
  ['tipo', 'nombre', 'direccion', 'comuna', 'ciudad', 'region', 'notas'].forEach((field) => {
    if (field in payload) row[field] = cleanText(payload[field]);
  });
  if ('principal' in payload) row.principal = Boolean(payload.principal);
  const result = await supabase()
    .from('ClienteDireccion')
    .update(row)
    .eq('clienteId', numericId(clienteId))
    .eq('id', numericId(direccionId))
    .select('*')
    .maybeSingle();
  return normalizeRow(assertSupabaseResult(result));
}

export async function deleteClienteDireccion(clienteId, direccionId) {
  const result = await supabase()
    .from('ClienteDireccion')
    .delete()
    .eq('clienteId', numericId(clienteId))
    .eq('id', numericId(direccionId));
  assertSupabaseResult(result);
  return true;
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
    const visitasEquipoResumen = visitasEquipo.map((visita) => {
      const tecnico = tecnicosById.get(visita.tecnicoId);
      const servicio = serviciosById.get(visita.servicioId);
      const cliente = clientesById.get(visita.clienteId);

      return {
        id: visita.id,
        codigo: visita.codigo,
        clienteId: visita.clienteId,
        equipoId: equipo.id,
        tecnicoId: visita.tecnicoId,
        servicioId: visita.servicioId,
        fecha: visita.fecha,
        fechaCierre: visita.fechaCierre,
        descripcion: visita.descripcion,
        notasTecnicas: visita.notasTecnicas,
        estado: visita.estado,
        tipoVisita: visita.tipoVisita,
        prioridad: visita.prioridad,
        cliente: shortCliente(cliente),
        tecnico: shortTecnico(tecnico),
        servicio: shortServicio(servicio),
      };
    });
    const hojaVidaDb = hojaVida.filter((evento) => evento.equipoId === equipo.id);
    const hojaVidaBase = hojaVidaDb.length
      ? hojaVidaDb.map((evento) => {
        const tecnico = evento.tecnicoId ? tecnicosById.get(evento.tecnicoId) : null;
        const visita = evento.visitaId ? visitas.find((item) => item.id === evento.visitaId) : null;
        const servicio = visita?.servicioId ? serviciosById.get(visita.servicioId) : null;

        return {
          ...evento,
          tecnico: tecnico?.nombre || '-',
          tecnicoDetalle: shortTecnico(tecnico),
          visitaId: visita?.id || evento.visitaId || null,
          servicio: shortServicio(servicio),
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
          tecnicoDetalle: shortTecnico(tecnico),
          visitaId: visita.id,
          servicio: shortServicio(servicio),
          estado: visita.estado,
        };
      });
    const serviciosRelacionados = Object.values(visitasEquipoResumen.reduce((acc, visita) => {
      const key = visita.servicio?.id || visita.servicioId || `sin-servicio-${visita.id}`;
      if (!acc[key]) {
        acc[key] = {
          id: visita.servicio?.id || visita.servicioId || null,
          descripcion: visita.servicio?.descripcion || 'Servicio sin nombre',
          tipo: visita.servicio?.tipo || '',
          precio: visita.servicio?.precio || 0,
          visitas: [],
          tecnicos: [],
          ultimaFecha: null,
        };
      }

      acc[key].visitas.push(visita);
      if (visita.tecnico && !acc[key].tecnicos.some((item) => item.id === visita.tecnico.id)) {
        acc[key].tecnicos.push(visita.tecnico);
      }

      const candidateDate = visita.fechaCierre || visita.fecha;
      if (!acc[key].ultimaFecha || new Date(candidateDate).getTime() > new Date(acc[key].ultimaFecha).getTime()) {
        acc[key].ultimaFecha = candidateDate;
      }

      return acc;
    }, {})).sort((a, b) => new Date(b.ultimaFecha || 0).getTime() - new Date(a.ultimaFecha || 0).getTime());

    return {
      ...equipo,
      cliente: shortCliente(clientesById.get(equipo.clienteId)),
      visitas: visitasEquipoResumen,
      serviciosRelacionados,
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

export async function listCamiones() {
  const [camiones, conductores, relaciones, clientes, fotos] = await Promise.all([
    fetchTable('Camion', { optional: true }),
    fetchTable('Conductor', { optional: true }),
    fetchTable('CamionConductor', { optional: true }),
    fetchTable('Cliente'),
    fetchTable('CamionFoto', { optional: true }),
  ]);
  const conductoresById = mapById(conductores);
  const clientesById = mapById(clientes);

  return camiones
    .map((camion) => ({
      ...camion,
      propietarioCliente: camion.propietarioClienteId ? shortCliente(clientesById.get(camion.propietarioClienteId)) : null,
      conductores: relaciones
        .filter((relacion) => relacion.camionId === camion.id && relacion.activo !== false)
        .map((relacion) => shortConductor(conductoresById.get(relacion.conductorId)))
        .filter(Boolean),
      conductorIds: relaciones
        .filter((relacion) => relacion.camionId === camion.id && relacion.activo !== false)
        .map((relacion) => relacion.conductorId),
      fotos: fotos
        .filter((foto) => foto.camionId === camion.id)
        .map((foto) => ({ ...foto, url: getPrivateFileUrl(foto) }))
        .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()),
      historial: [
        ...relaciones
          .filter((relacion) => relacion.camionId === camion.id)
          .map((relacion) => ({
            id: `conductor-${relacion.conductorId}`,
            tipo: 'Asignación conductor',
            titulo: conductoresById.get(relacion.conductorId)?.nombre || `Conductor ${relacion.conductorId}`,
            fecha: relacion.updatedAt || relacion.createdAt,
            estado: relacion.activo === false ? 'inactivo' : 'activo',
          })),
        ...fotos
          .filter((foto) => foto.camionId === camion.id)
          .map((foto) => ({
            id: `foto-${foto.id}`,
            tipo: 'Foto',
            titulo: foto.nombreOriginal || foto.titulo || `Foto ${foto.id}`,
            fecha: foto.createdAt,
            estado: foto.tipo || 'foto',
          })),
      ].sort((a, b) => new Date(b.fecha || 0).getTime() - new Date(a.fecha || 0).getTime()),
    }))
    .sort((a, b) => String(a.patente || '').localeCompare(String(b.patente || ''), 'es'));
}

export async function getCamion(id) {
  return (await listCamiones()).find((camion) => camion.id === numericId(id)) || null;
}

export async function listConductores() {
  const [conductores, camiones, relaciones] = await Promise.all([
    fetchTable('Conductor', { optional: true }),
    fetchTable('Camion', { optional: true }),
    fetchTable('CamionConductor', { optional: true }),
  ]);
  const camionesById = mapById(camiones);

  return conductores
    .map((conductor) => ({
      ...conductor,
      camiones: relaciones
        .filter((relacion) => relacion.conductorId === conductor.id && relacion.activo !== false)
        .map((relacion) => shortCamion(camionesById.get(relacion.camionId)))
        .filter(Boolean),
      camionIds: relaciones
        .filter((relacion) => relacion.conductorId === conductor.id && relacion.activo !== false)
        .map((relacion) => relacion.camionId),
      historial: relaciones
        .filter((relacion) => relacion.conductorId === conductor.id)
        .map((relacion) => ({
          id: `camion-${relacion.camionId}`,
          tipo: 'Asignación camión',
          titulo: camionesById.get(relacion.camionId)?.patente || `Camión ${relacion.camionId}`,
          fecha: relacion.updatedAt || relacion.createdAt,
          estado: relacion.activo === false ? 'inactivo' : 'activo',
        })),
    }))
    .sort((a, b) => String(a.nombre || '').localeCompare(String(b.nombre || ''), 'es'));
}

export async function getConductor(id) {
  return (await listConductores()).find((conductor) => conductor.id === numericId(id)) || null;
}

export async function createCamionFoto(camionId, metadata) {
  const row = {
    camionId: numericId(camionId),
    tipo: cleanText(metadata.tipo) || 'foto',
    titulo: cleanText(metadata.titulo),
    nombreOriginal: cleanText(metadata.nombreOriginal),
    mimeType: cleanText(metadata.mimeType),
    sizeBytes: normalizeNumber(metadata.sizeBytes),
    r2Bucket: metadata.r2Bucket,
    r2Key: metadata.r2Key,
    checksumSha256: metadata.checksumSha256,
    observaciones: cleanText(metadata.observaciones),
  };
  if (!row.camionId || !row.r2Bucket || !row.r2Key) throw new Error('Foto de camión incompleta.');

  const result = await supabase().from('CamionFoto').insert(row).select('*').single();
  if (!result.error) return normalizeRow(result.data);

  if (result.error.code !== '23505') {
    const storageError = new Error(result.error.message);
    storageError.code = result.error.code;
    throw storageError;
  }

  // CamionFoto_r2Key_key es el árbitro de idempotencia. Si otra solicitud
  // ganó la carrera, se devuelve esa misma fila en vez de tratar de compensar
  // borrando el objeto compartido en R2.
  const existingResult = await supabase()
    .from('CamionFoto')
    .select('*')
    .eq('r2Key', row.r2Key)
    .maybeSingle();

  if (existingResult.error) {
    const lookupError = new Error(existingResult.error.message);
    lookupError.code = existingResult.error.code;
    throw lookupError;
  }

  const existing = normalizeRow(existingResult.data);
  const sameEvidence = existing
    && Number(existing.camionId) === row.camionId
    && existing.r2Bucket === row.r2Bucket
    && existing.checksumSha256 === row.checksumSha256;

  if (!sameEvidence) {
    const conflictError = new Error('La evidencia R2 ya está registrada con otro contenido o camión.');
    conflictError.status = 409;
    conflictError.code = 'CAMION_FOTO_R2_KEY_CONFLICT';
    throw conflictError;
  }

  return existing;
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
  const [clientes, vendedores, equipos, servicios, items, itemServicios] = await Promise.all([
    fetchTable('Cliente'),
    fetchTable('Vendedor'),
    fetchTable('Equipo'),
    fetchTable('Servicio'),
    fetchTable('CotizacionItem'),
    fetchTable('CotizacionItemServicio', { optional: true }),
  ]);

  return {
    clientes: mapById(clientes),
    vendedores: mapById(vendedores),
    equipos: mapById(equipos),
    servicios: mapById(servicios),
    items,
    itemServicios,
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
      servicios: context.itemServicios
        .filter((service) => service.cotizacionItemId === item.id)
        .sort((a, b) => a.orden - b.orden)
        .map((service) => ({
          ...service,
          servicio: service.servicioId ? shortServicio(context.servicios.get(service.servicioId)) : null,
        })),
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
  const [clientes, cotizaciones, equipos, tecnicos, visitas, camiones, conductores] = await Promise.all([
    supabase().from('Cliente').select('id', { count: 'exact', head: true }),
    supabase().from('Cotizacion').select('id', { count: 'exact', head: true }),
    supabase().from('Equipo').select('id', { count: 'exact', head: true }),
    supabase().from('Tecnico').select('id', { count: 'exact', head: true }),
    supabase().from('Visita').select('id', { count: 'exact', head: true }),
    supabase().from('Camion').select('id', { count: 'exact', head: true }),
    supabase().from('Conductor').select('id', { count: 'exact', head: true }),
  ]);

  [clientes, cotizaciones, equipos, tecnicos, visitas].forEach(assertSupabaseResult);

  return {
    clientes: clientes.count || 0,
    cotizaciones: cotizaciones.count || 0,
    equipos: equipos.count || 0,
    tecnicos: tecnicos.count || 0,
    visitas: visitas.count || 0,
    camiones: camiones.error ? 0 : camiones.count || 0,
    conductores: conductores.error ? 0 : conductores.count || 0,
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
          imagenR2Key: equipo.imagenR2Key,
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
          imagenR2Key: equipo.imagenR2Key,
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
