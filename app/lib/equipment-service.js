import { getSupabaseAdmin } from './supabase-server';

const EAN_PATTERN = /^(?:\d{8}|\d{13}|\d{14})$/;
const EQUIPMENT_FIELDS = [
  'nombre',
  'fabricante',
  'modelo',
  'partNumber',
  'ean',
  'serial',
  'categoria',
  'ubicacion',
  'estadoOperativo',
  'fechaInstalacion',
  'fechaGarantiaFin',
  'ultimaMantencion',
  'proximaMantencion',
  'observaciones',
];

function domainError(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function safeText(value, maxLength = 500) {
  const valueAsText = String(value ?? '').trim();
  return valueAsText ? valueAsText.slice(0, maxLength) : null;
}

function normalizeEan(value) {
  const raw = safeText(value, 40);
  if (!raw) return null;
  const ean = raw.replace(/[\s-]+/g, '');
  if (!EAN_PATTERN.test(ean)) {
    throw domainError('El EAN debe contener 8, 13 o 14 dígitos.');
  }
  return ean;
}

function numericId(value, label) {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) throw domainError(`${label} inválido.`);
  return id;
}

function normalizeDate(value) {
  const raw = safeText(value, 80);
  if (!raw) return null;
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) throw domainError('Fecha inválida.');
  return date.toISOString();
}

function normalizePayload(payload = {}) {
  const row = {};
  for (const field of EQUIPMENT_FIELDS) {
    if (!(field in payload)) continue;
    if (field === 'ean') row[field] = normalizeEan(payload[field]);
    else if (['fechaInstalacion', 'fechaGarantiaFin', 'ultimaMantencion', 'proximaMantencion'].includes(field)) row[field] = normalizeDate(payload[field]);
    else if (field === 'observaciones') row[field] = safeText(payload[field], 5000);
    else row[field] = safeText(payload[field], 240);
  }

  if ('estadoOperativo' in payload) {
    const state = safeText(payload.estadoOperativo, 40) || 'operativo';
    if (!['operativo', 'mantenimiento', 'fuera_servicio'].includes(state)) {
      throw domainError('Estado operativo inválido.');
    }
    row.estadoOperativo = state;
  }

  return row;
}

async function resolveOwnerClientId(payload) {
  const db = getSupabaseAdmin();
  if (payload.propietarioTipo === 'CMCING') {
    const result = await db
      .from('Cliente')
      .select('id')
      .eq('esEmpresaCMCing', true)
      .maybeSingle();
    if (result.error) throw domainError(`No se pudo resolver CMCing: ${result.error.message}`, 500);
    if (!result.data) throw domainError('Falta aplicar la migración de propiedad de equipos.', 503);
    return Number(result.data.id);
  }

  const clientId = numericId(payload.clienteId, 'Cliente propietario');
  const client = await findClientOwner(clientId);
  if (!client || client.esEmpresaCMCing) throw domainError('Seleccione un cliente válido o CMCing.');
  return clientId;
}

function dbError(error, operation) {
  const message = String(error?.message || 'Error de base de datos.');
  if (error?.code === '23505') return domainError('Ya existe un equipo con ese EAN, serial o código interno.', 409);
  if (error?.code === '23514') return domainError(message, 409);
  return domainError(`${operation}: ${message}`, 500);
}

function isMissingColumn(error, column) {
  const details = [error?.code, error?.message, error?.details, error?.hint]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return (error?.code === '42703' || error?.code === 'PGRST204' || details.includes('column'))
    && details.includes(String(column).toLowerCase());
}

async function findClientOwner(clientId) {
  const db = getSupabaseAdmin();
  let result = await db
    .from('Cliente')
    .select('id,esEmpresaCMCing')
    .eq('id', clientId)
    .maybeSingle();

  if (result.error && isMissingColumn(result.error, 'esEmpresaCMCing')) {
    result = await db
      .from('Cliente')
      .select('id')
      .eq('id', clientId)
      .maybeSingle();
  }

  if (result.error) throw dbError(result.error, 'No se pudo validar el cliente propietario');
  return result.data;
}

export async function listEquipmentOwners() {
  const db = getSupabaseAdmin();
  const clientsResult = await db
    .from('Cliente')
    .select('id,nombre,rut')
    .order('nombre');
  if (clientsResult.error) throw dbError(clientsResult.error, 'No se pudieron leer los propietarios de equipo');

  const clients = clientsResult.data || [];
  const cmcingResult = await db
    .from('Cliente')
    .select('id')
    .eq('esEmpresaCMCing', true)
    .maybeSingle();

  if (cmcingResult.error && !isMissingColumn(cmcingResult.error, 'esEmpresaCMCing')) {
    throw dbError(cmcingResult.error, 'No se pudo identificar a CMCing como propietario');
  }
  const cmcingId = cmcingResult.error ? null : (Number(cmcingResult.data?.id || 0) || null);

  return [
    ...(cmcingId ? [{ id: 'CMCING', nombre: 'CMCing', detalle: 'Equipo propio de CMCing', propietarioTipo: 'CMCING' }] : []),
    ...clients
      .filter((item) => Number(item.id) !== cmcingId)
      .map((item) => ({
        id: String(item.id),
        nombre: item.nombre,
        detalle: item.rut || 'Cliente',
        propietarioTipo: 'CLIENTE',
      })),
  ];
}

export async function createEquipment(payload) {
  const row = normalizePayload(payload);
  if (!row.nombre) throw domainError('El nombre del equipo es obligatorio.');
  const clienteId = await resolveOwnerClientId(payload);
  const result = await getSupabaseAdmin()
    .from('Equipo')
    .insert({ ...row, clienteId })
    .select('*')
    .single();
  if (result.error) throw dbError(result.error, 'No se pudo crear el equipo');
  return result.data;
}

export async function updateEquipment(id, payload) {
  const equipmentId = numericId(id, 'Equipo');
  if ('clienteId' in payload || 'propietarioTipo' in payload) {
    throw domainError('El propietario del equipo no se puede modificar.', 409);
  }
  const row = normalizePayload(payload);
  if ('nombre' in payload && !row.nombre) throw domainError('El nombre del equipo es obligatorio.');
  if (!Object.keys(row).length) throw domainError('No hay cambios para guardar.');
  const result = await getSupabaseAdmin()
    .from('Equipo')
    .update(row)
    .eq('id', equipmentId)
    .select('*')
    .maybeSingle();
  if (result.error) throw dbError(result.error, 'No se pudo actualizar el equipo');
  if (!result.data) throw domainError('Equipo no encontrado.', 404);
  return result.data;
}

export function equipmentId(value) {
  return numericId(value, 'Equipo');
}
