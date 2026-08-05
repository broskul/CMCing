import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '../../../lib/supabase-auth-server';
import {
  assertTechnicianAppRole,
  classifyTechnicianApiError,
  getTechnicianSessionUser,
  requireSupabaseData,
} from '../../../lib/technician-api';

export const dynamic = 'force-dynamic';

const ACTIVITY_FIELDS = [
  'id', 'ordenTrabajoId', 'actividadId', 'tecnicoId', 'titulo', 'descripcionBreve',
  'notasTecnico', 'estado', 'fechaProgramada', 'fechaInicio', 'fechaCierre',
  'bloqueada', 'bloqueadaAt', 'rowRevision', 'updatedAt',
].join(',');

function ids(rows, field = 'id') {
  return [...new Set(rows.map((row) => Number(row[field])).filter(Number.isInteger))];
}

function mapById(rows) {
  return new Map(rows.map((row) => [Number(row.id), row]));
}

async function authenticatedContext() {
  const supabase = await createSupabaseServerClient();
  const authResult = await supabase.auth.getUser();
  if (authResult.error || !authResult.data.user) {
    const error = new Error('No autenticado.');
    error.status = 401;
    error.code = 'AUTH_REQUIRED';
    throw error;
  }
  const user = await getTechnicianSessionUser(supabase, authResult.data.user);
  const role = assertTechnicianAppRole(user);
  return { supabase, user, role };
}

export async function GET() {
  try {
    const { supabase, user, role } = await authenticatedContext();
    let activitiesQuery = supabase
      .from('OrdenTrabajoActividad')
      .select(ACTIVITY_FIELDS, { count: 'exact' })
      .order('estado', { ascending: true })
      .order('fechaProgramada', { ascending: true, nullsFirst: false })
      .limit(250);
    if (role === 'TECNICO') activitiesQuery = activitiesQuery.eq('tecnicoId', Number(user.tecnicoId));

    const activitiesResult = await activitiesQuery;
    const activityRows = requireSupabaseData(activitiesResult, 'No se pudieron leer las actividades asignadas');
    const activityIds = ids(activityRows);
    const workOrderIds = ids(activityRows, 'ordenTrabajoId');
    const technicianIds = ids(activityRows, 'tecnicoId');

    const [orders, assignments, attachments, technicians] = await Promise.all([
      workOrderIds.length
        ? supabase.from('OrdenTrabajo').select('id,codigo,titulo,descripcion,clienteId,equipoId,prioridad,criticidad,estado,fechaApertura,fechaProgramada,fechaCierre,rowRevision,updatedAt').in('id', workOrderIds)
        : Promise.resolve({ data: [], error: null }),
      activityIds.length
        ? supabase.from('ActividadMatrizAsignada').select('id,ordenTrabajoActividadId,matrizId,origen,obligatoria,estado,completedAt,rowRevision,matrizFamiliaId,matrizVersion,matrizCategoria,matrizNombreSnapshot,definitionSnapshot,definitionHashSha256,updatedAt').in('ordenTrabajoActividadId', activityIds).order('id')
        : Promise.resolve({ data: [], error: null }),
      activityIds.length
        ? supabase.from('ArchivoAdjunto').select('id,ordenTrabajoActividadId,tipo,nombreOriginal,mimeType,sizeBytes,r2Bucket,r2Key,checksumSha256,metadata,rowRevision,createdAt,updatedAt').in('ordenTrabajoActividadId', activityIds).order('createdAt')
        : Promise.resolve({ data: [], error: null }),
      technicianIds.length
        ? supabase.from('Tecnico').select('id,nombre,email,telefono,especialidad').in('id', technicianIds)
        : Promise.resolve({ data: [], error: null }),
    ]);
    const orderRows = requireSupabaseData(orders, 'No se pudieron leer las OT');
    const assignmentRows = requireSupabaseData(assignments, 'No se pudieron leer las matrices asignadas');
    const attachmentRows = requireSupabaseData(attachments, 'No se pudieron leer las evidencias');
    const technicianRows = requireSupabaseData(technicians, 'No se pudieron leer los técnicos');

    const clientIds = ids(orderRows, 'clienteId');
    const assignmentIds = ids(assignmentRows);
    const [clients, orderEquipment, answers] = await Promise.all([
      clientIds.length
        ? supabase.from('Cliente').select('id,nombre,rut,email,telefono,direccion').in('id', clientIds)
        : Promise.resolve({ data: [], error: null }),
      workOrderIds.length
        ? supabase.from('OrdenTrabajoEquipo').select('id,ordenTrabajoId,equipoId,principal,origen').in('ordenTrabajoId', workOrderIds)
        : Promise.resolve({ data: [], error: null }),
      assignmentIds.length
        ? supabase.from('ActividadMatrizRespuesta').select('id,actividadMatrizAsignadaId,matrizItemId,valorNumero,valorBooleano,valorTexto,valorOpciones,respondidoAt,rowRevision,updatedAt').in('actividadMatrizAsignadaId', assignmentIds)
        : Promise.resolve({ data: [], error: null }),
    ]);
    const clientRows = requireSupabaseData(clients, 'No se pudieron leer los clientes');
    const orderEquipmentRows = requireSupabaseData(orderEquipment, 'No se pudieron leer los equipos de las OT');
    const answerRows = requireSupabaseData(answers, 'No se pudieron leer las respuestas de matrices');

    const equipmentIds = [...new Set([
      ...ids(orderRows, 'equipoId'),
      ...ids(orderEquipmentRows, 'equipoId'),
    ])];
    const equipmentResult = equipmentIds.length
      ? await supabase.from('Equipo').select('id,clienteId,codigoInterno,nombre,modelo,partNumber,ean,serial,fabricante,ubicacion,estadoOperativo,imagenUrl,imagenR2Key').in('id', equipmentIds)
      : { data: [], error: null };
    const equipmentRows = requireSupabaseData(equipmentResult, 'No se pudieron leer los equipos');

    const ordersById = mapById(orderRows);
    const clientsById = mapById(clientRows);
    const equipmentById = mapById(equipmentRows);
    const techniciansById = mapById(technicianRows);
    const assignmentsByActivity = new Map();
    for (const assignment of assignmentRows) {
      const key = Number(assignment.ordenTrabajoActividadId);
      const list = assignmentsByActivity.get(key) || [];
      list.push({
        ...assignment,
        items: Array.isArray(assignment.definitionSnapshot?.items) ? assignment.definitionSnapshot.items : [],
        respuestas: answerRows.filter((answer) => Number(answer.actividadMatrizAsignadaId) === Number(assignment.id)),
      });
      assignmentsByActivity.set(key, list);
    }

    const equipmentByOrder = new Map();
    for (const relation of orderEquipmentRows) {
      const key = Number(relation.ordenTrabajoId);
      const list = equipmentByOrder.get(key) || [];
      const equipment = equipmentById.get(Number(relation.equipoId));
      if (equipment) list.push({ ...equipment, principal: Boolean(relation.principal) });
      equipmentByOrder.set(key, list);
    }

    const activities = activityRows.map((activity) => {
      const order = ordersById.get(Number(activity.ordenTrabajoId));
      const relatedEquipment = equipmentByOrder.get(Number(activity.ordenTrabajoId)) || [];
      const legacyEquipment = order?.equipoId ? equipmentById.get(Number(order.equipoId)) : null;
      const equipos = relatedEquipment.length
        ? relatedEquipment
        : legacyEquipment ? [{ ...legacyEquipment, principal: true }] : [];
      return {
        ...activity,
        tecnico: techniciansById.get(Number(activity.tecnicoId)) || null,
        ordenTrabajo: order ? { ...order, cliente: clientsById.get(Number(order.clienteId)) || null, equipos } : null,
        matrices: assignmentsByActivity.get(Number(activity.id)) || [],
        adjuntos: attachmentRows.filter((attachment) => Number(attachment.ordenTrabajoActividadId) === Number(activity.id)),
      };
    });

    return NextResponse.json({
      schema: 'cmcing.technician-bootstrap',
      version: 1,
      generatedAt: new Date().toISOString(),
      user,
      activities,
      totalVisible: activitiesResult.count ?? activities.length,
      truncated: Number(activitiesResult.count || 0) > activities.length,
    }, { headers: { 'Cache-Control': 'no-store, max-age=0' } });
  } catch (error) {
    const classified = classifyTechnicianApiError(error);
    return NextResponse.json({
      error: classified.message,
      code: classified.code,
      retryable: classified.retryable,
    }, { status: classified.status, headers: { 'Cache-Control': 'no-store' } });
  }
}
