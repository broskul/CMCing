import { prisma } from './prisma';

const VISITA_ESTADOS = ['pendiente', 'programada', 'en_progreso', 'completada', 'cancelada'];

const emptyToNull = (value) => (value === '' || typeof value === 'undefined' ? null : value);

const compact = (value) => Object.fromEntries(
  Object.entries(value).filter(([, item]) => typeof item !== 'undefined')
);

const asArray = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) return value.filter(Boolean);
  return [value].filter(Boolean);
};

const asDate = (value) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const firstByRole = (links = [], role) => links.find((item) => {
  if (item.rol === role) return true;
  return item.empleado?.roles?.includes(role);
});

const empleadoSelect = {
  id: true,
  nombre: true,
  email: true,
  telefono: true,
  cargo: true,
  especialidad: true,
  roles: true,
  estado: true,
  supervisorId: true,
};

const equipoSelect = {
  id: true,
  clienteId: true,
  nombre: true,
  marca: true,
  modelo: true,
  nroSerie: true,
  codigoInterno: true,
  ubicacion: true,
  estado: true,
  criticidad: true,
  imagenUrl: true,
  garantiaHasta: true,
};

const clienteLiteSelect = {
  id: true,
  nombre: true,
  rut: true,
  email: true,
  telefono: true,
};

function formatEmpleado(empleado) {
  if (!empleado) return null;
  return {
    ...empleado,
    esTecnico: empleado.roles?.includes('tecnico') || false,
    esComercial: empleado.roles?.includes('comercial') || false,
    esJefatura: empleado.roles?.includes('jefatura') || false,
  };
}

function formatEquipo(equipo) {
  if (!equipo) return null;
  return {
    ...equipo,
    serial: equipo.nroSerie,
    cliente: equipo.cliente || null,
    visitas: equipo.visitas?.map((link) => ({
      id: link.visita.id,
      fecha: link.visita.fecha,
      descripcion: link.visita.descripcion,
      estado: link.visita.estado,
    })) || [],
  };
}

function formatMantencion(mantencion) {
  if (!mantencion) return null;
  const equipos = mantencion.equipos?.map((link) => formatEquipo(link.equipo)).filter(Boolean) || [];

  return {
    ...mantencion,
    equipoIds: equipos.map((equipo) => equipo.id),
    equipoId: equipos[0]?.id || null,
    equipos,
    servicio: mantencion.servicio || null,
    comercial: formatEmpleado(mantencion.comercial),
    jefatura: formatEmpleado(mantencion.jefatura),
    visitas: mantencion.visitas || [],
  };
}

function formatIncidente(incidente) {
  if (!incidente) return null;
  return {
    ...incidente,
    equipo: formatEquipo(incidente.equipo),
    asignadoA: formatEmpleado(incidente.asignadoA),
  };
}

function formatVisita(visita) {
  if (!visita) return null;

  const equipos = visita.equipos?.map((link) => formatEquipo(link.equipo)).filter(Boolean) || [];
  const empleados = visita.empleados?.map((link) => ({
    ...link,
    empleado: formatEmpleado(link.empleado),
  })) || [];
  const tecnicoLink = firstByRole(empleados, 'tecnico') || empleados[0] || null;
  const vendedorLink = firstByRole(empleados, 'comercial') || null;

  return {
    ...visita,
    equipos,
    equipo: equipos[0] || null,
    equipoIds: equipos.map((equipo) => equipo.id),
    equipoId: equipos[0]?.id || null,
    tecnico: tecnicoLink?.empleado || null,
    tecnicoId: tecnicoLink?.empleado?.id || null,
    vendedor: vendedorLink?.empleado || null,
    vendedorId: vendedorLink?.empleado?.id || null,
    servicio: visita.servicio || visita.mantencion?.servicio || null,
    mantencion: formatMantencion(visita.mantencion),
    incidente: formatIncidente(visita.incidente),
    imagenes: visita.imagenes || [],
  };
}

const visitaInclude = {
  cliente: { select: clienteLiteSelect },
  servicio: true,
  mantencion: {
    include: {
      servicio: true,
      comercial: { select: empleadoSelect },
      jefatura: { select: empleadoSelect },
      equipos: { include: { equipo: { select: equipoSelect } } },
      visitas: { select: { id: true, fecha: true, estado: true, descripcion: true } },
    },
  },
  incidente: {
    include: {
      equipo: { select: equipoSelect },
      asignadoA: { select: empleadoSelect },
    },
  },
  equipos: { include: { equipo: { select: equipoSelect } } },
  empleados: { include: { empleado: { select: empleadoSelect } } },
  imagenes: true,
};

const mantencionInclude = {
  cliente: { select: clienteLiteSelect },
  servicio: true,
  comercial: { select: empleadoSelect },
  jefatura: { select: empleadoSelect },
  equipos: { include: { equipo: { select: equipoSelect } } },
  visitas: { select: { id: true, fecha: true, estado: true, descripcion: true } },
};

const incidenteInclude = {
  cliente: { select: clienteLiteSelect },
  equipo: { select: equipoSelect },
  contacto: true,
  asignadoA: { select: empleadoSelect },
  mantenciones: { select: { id: true, folio: true, titulo: true, estado: true } },
  visitas: { select: { id: true, fecha: true, estado: true, descripcion: true } },
};

function normalizeClientePayload(payload) {
  return compact({
    codigo: emptyToNull(payload.codigo),
    nombre: payload.nombre,
    razonSocial: emptyToNull(payload.razonSocial),
    rut: emptyToNull(payload.rut),
    giro: emptyToNull(payload.giro),
    email: emptyToNull(payload.email),
    telefono: emptyToNull(payload.telefono),
    sitioWeb: emptyToNull(payload.sitioWeb),
    estado: payload.estado || undefined,
    notas: emptyToNull(payload.notas),
  });
}

function normalizeEquipoPayload(payload) {
  return compact({
    clienteId: payload.clienteId,
    modeloId: emptyToNull(payload.modeloId),
    nombre: payload.nombre,
    marca: emptyToNull(payload.marca),
    modelo: emptyToNull(payload.modelo),
    nroSerie: payload.nroSerie || payload.serial,
    codigoInterno: emptyToNull(payload.codigoInterno),
    ubicacion: emptyToNull(payload.ubicacion),
    fechaInstalacion: asDate(payload.fechaInstalacion),
    garantiaHasta: asDate(payload.garantiaHasta),
    estado: payload.estado || undefined,
    criticidad: payload.criticidad || undefined,
    imagenUrl: emptyToNull(payload.imagenUrl),
    notas: emptyToNull(payload.notas),
  });
}

function normalizeServicioPayload(payload) {
  return compact({
    codigo: emptyToNull(payload.codigo),
    descripcion: payload.descripcion,
    tipo: payload.tipo || undefined,
    precio: payload.precio === '' || payload.precio === null ? null : Number(payload.precio),
    moneda: payload.moneda || undefined,
    activo: typeof payload.activo === 'boolean' ? payload.activo : undefined,
  });
}

function normalizeEmpleadoPayload(payload, defaultRoles = []) {
  const roles = payload.roles?.length ? payload.roles : defaultRoles;

  return compact({
    nombre: payload.nombre,
    email: payload.email,
    telefono: emptyToNull(payload.telefono),
    cargo: emptyToNull(payload.cargo),
    especialidad: emptyToNull(payload.especialidad),
    roles,
    estado: payload.estado || undefined,
    supervisorId: emptyToNull(payload.supervisorId),
  });
}

function normalizeMantencionPayload(payload) {
  return compact({
    folio: emptyToNull(payload.folio),
    clienteId: payload.clienteId,
    planId: emptyToNull(payload.planId),
    incidenteId: emptyToNull(payload.incidenteId),
    servicioId: emptyToNull(payload.servicioId),
    comercialId: emptyToNull(payload.comercialId),
    jefaturaId: emptyToNull(payload.jefaturaId),
    tipo: payload.tipo || undefined,
    origen: payload.origen || undefined,
    cobertura: payload.cobertura || undefined,
    estado: payload.estado || undefined,
    prioridad: payload.prioridad || undefined,
    titulo: payload.titulo,
    descripcion: emptyToNull(payload.descripcion),
    diagnostico: emptyToNull(payload.diagnostico),
    resolucion: emptyToNull(payload.resolucion),
    fechaProgramada: asDate(payload.fechaProgramada),
    fechaCompromiso: asDate(payload.fechaCompromiso),
    fechaCierre: asDate(payload.fechaCierre),
    montoEstimado: payload.montoEstimado === '' || payload.montoEstimado === null ? null : Number(payload.montoEstimado),
  });
}

function normalizeIncidentePayload(payload) {
  return compact({
    clienteId: payload.clienteId,
    equipoId: emptyToNull(payload.equipoId),
    contactoId: emptyToNull(payload.contactoId),
    asignadoAId: emptyToNull(payload.asignadoAId),
    titulo: payload.titulo,
    descripcion: emptyToNull(payload.descripcion),
    severidad: payload.severidad || undefined,
    estado: payload.estado || undefined,
    fechaReporte: asDate(payload.fechaReporte),
    fechaCierre: asDate(payload.fechaCierre),
    causaRaiz: emptyToNull(payload.causaRaiz),
    solucion: emptyToNull(payload.solucion),
  });
}

function normalizeVisitaPayload(payload) {
  const estado = payload.estado || 'pendiente';
  if (!VISITA_ESTADOS.includes(estado)) {
    throw new Error(`Estado invalido. Usa: ${VISITA_ESTADOS.join(', ')}`);
  }

  return compact({
    clienteId: payload.clienteId,
    mantencionId: emptyToNull(payload.mantencionId),
    incidenteId: emptyToNull(payload.incidenteId),
    servicioId: emptyToNull(payload.servicioId),
    fecha: asDate(payload.fecha) || new Date(),
    fechaFin: asDate(payload.fechaFin),
    estado,
    descripcion: emptyToNull(payload.descripcion),
    resultado: emptyToNull(payload.resultado),
    recomendaciones: emptyToNull(payload.recomendaciones),
    firmaClienteNombre: emptyToNull(payload.firmaClienteNombre),
  });
}

async function syncMantencionEquipos(tx, mantencionId, equipoIds = []) {
  if (!equipoIds.length) return;

  await tx.mantencionEquipo.deleteMany({ where: { mantencionId } });
  await tx.mantencionEquipo.createMany({
    data: equipoIds.map((equipoId, index) => ({
      mantencionId,
      equipoId,
      principal: index === 0,
    })),
    skipDuplicates: true,
  });
}

async function syncVisitaEquipos(tx, visitaId, equipoIds = []) {
  if (!equipoIds.length) return;

  await tx.visitaEquipo.deleteMany({ where: { visitaId } });
  await tx.visitaEquipo.createMany({
    data: equipoIds.map((equipoId, index) => ({
      visitaId,
      equipoId,
      principal: index === 0,
    })),
    skipDuplicates: true,
  });
}

async function syncVisitaEmpleados(tx, visitaId, payload) {
  const empleadoLinks = [];

  if (payload.tecnicoId) {
    empleadoLinks.push({ empleadoId: payload.tecnicoId, rol: 'tecnico', principal: true });
  }

  if (payload.vendedorId) {
    empleadoLinks.push({ empleadoId: payload.vendedorId, rol: 'comercial', principal: false });
  }

  for (const empleadoId of asArray(payload.empleadoIds)) {
    if (!empleadoLinks.some((item) => item.empleadoId === empleadoId)) {
      empleadoLinks.push({ empleadoId, rol: null, principal: false });
    }
  }

  if (!empleadoLinks.length) return;

  await tx.visitaEmpleado.deleteMany({ where: { visitaId } });
  await tx.visitaEmpleado.createMany({
    data: empleadoLinks.map((item) => ({ visitaId, ...item })),
    skipDuplicates: true,
  });
}

async function listClientes() {
  const clientes = await prisma.cliente.findMany({
    orderBy: { nombre: 'asc' },
    include: {
      contactos: { orderBy: [{ principal: 'desc' }, { nombre: 'asc' }] },
      direcciones: { orderBy: [{ principal: 'desc' }, { createdAt: 'asc' }] },
      equipos: { select: equipoSelect, orderBy: { nombre: 'asc' } },
      visitas: { select: { id: true, fecha: true, descripcion: true, estado: true }, orderBy: { fecha: 'desc' } },
    },
  });

  return clientes.map((cliente) => ({
    ...cliente,
    direccion: cliente.direcciones[0]?.direccion || '',
    equipos: cliente.equipos.map(formatEquipo),
  }));
}

async function getCliente(id) {
  const cliente = await prisma.cliente.findUnique({
    where: { id },
    include: {
      contactos: true,
      direcciones: true,
      equipos: { select: equipoSelect },
      visitas: { select: { id: true, fecha: true, descripcion: true, estado: true } },
    },
  });
  return cliente ? { ...cliente, direccion: cliente.direcciones[0]?.direccion || '', equipos: cliente.equipos.map(formatEquipo) } : null;
}

async function createCliente(payload) {
  const cliente = await prisma.cliente.create({
    data: {
      ...normalizeClientePayload(payload),
      contactos: payload.contactoNombre ? {
        create: [{
          nombre: payload.contactoNombre,
          email: emptyToNull(payload.contactoEmail),
          telefono: emptyToNull(payload.contactoTelefono),
          rol: 'principal',
          principal: true,
        }],
      } : undefined,
      direcciones: payload.direccion ? {
        create: [{ direccion: payload.direccion, tipo: 'servicio', principal: true }],
      } : undefined,
    },
  });
  return getCliente(cliente.id);
}

async function updateCliente(id, payload) {
  await prisma.cliente.update({ where: { id }, data: normalizeClientePayload(payload) });

  if ('direccion' in payload) {
    const existing = await prisma.clienteDireccion.findFirst({
      where: { clienteId: id, principal: true },
      orderBy: { createdAt: 'asc' },
    });

    if (existing) {
      await prisma.clienteDireccion.update({
        where: { id: existing.id },
        data: { direccion: payload.direccion || existing.direccion },
      });
    } else if (payload.direccion) {
      await prisma.clienteDireccion.create({
        data: { clienteId: id, direccion: payload.direccion, tipo: 'servicio', principal: true },
      });
    }
  }

  return getCliente(id);
}

async function deleteCliente(id) {
  await prisma.cliente.delete({ where: { id } });
  return true;
}

async function listEquipos() {
  const equipos = await prisma.equipo.findMany({
    orderBy: { nombre: 'asc' },
    include: {
      cliente: { select: clienteLiteSelect },
      visitas: { include: { visita: { select: { id: true, fecha: true, descripcion: true, estado: true } } } },
    },
  });
  return equipos.map(formatEquipo);
}

async function getEquipo(id) {
  const equipo = await prisma.equipo.findUnique({
    where: { id },
    include: {
      cliente: { select: clienteLiteSelect },
      visitas: { include: { visita: { select: { id: true, fecha: true, descripcion: true, estado: true } } } },
    },
  });
  return formatEquipo(equipo);
}

async function createEquipo(payload) {
  const equipo = await prisma.$transaction(async (tx) => {
    const created = await tx.equipo.create({ data: normalizeEquipoPayload(payload) });
    await tx.equipoAsignacion.create({
      data: {
        equipoId: created.id,
        clienteId: created.clienteId,
        motivo: 'Alta inicial',
      },
    });
    return created;
  });
  return getEquipo(equipo.id);
}

async function updateEquipo(id, payload) {
  await prisma.equipo.update({ where: { id }, data: normalizeEquipoPayload(payload) });
  return getEquipo(id);
}

async function deleteEquipo(id) {
  await prisma.equipo.delete({ where: { id } });
  return true;
}

async function listServicios() {
  return prisma.servicio.findMany({ orderBy: { descripcion: 'asc' } });
}

async function getServicio(id) {
  return prisma.servicio.findUnique({ where: { id } });
}

async function createServicio(payload) {
  return prisma.servicio.create({ data: normalizeServicioPayload(payload) });
}

async function updateServicio(id, payload) {
  return prisma.servicio.update({ where: { id }, data: normalizeServicioPayload(payload) });
}

async function deleteServicio(id) {
  await prisma.servicio.delete({ where: { id } });
  return true;
}

async function listEmpleados(where = {}) {
  const empleados = await prisma.empleado.findMany({
    where,
    orderBy: { nombre: 'asc' },
    select: {
      ...empleadoSelect,
      visitas: { select: { visita: { select: { id: true, fecha: true, estado: true, descripcion: true } } } },
    },
  });

  return empleados.map((empleado) => ({
    ...formatEmpleado(empleado),
    visitas: empleado.visitas?.map((item) => item.visita) || [],
  }));
}

async function getEmpleado(id) {
  const empleado = await prisma.empleado.findUnique({
    where: { id },
    select: empleadoSelect,
  });
  return formatEmpleado(empleado);
}

async function createEmpleado(payload, defaultRoles = []) {
  const empleado = await prisma.empleado.create({ data: normalizeEmpleadoPayload(payload, defaultRoles) });
  return getEmpleado(empleado.id);
}

async function updateEmpleado(id, payload, defaultRoles = []) {
  await prisma.empleado.update({ where: { id }, data: normalizeEmpleadoPayload(payload, defaultRoles) });
  return getEmpleado(id);
}

async function deleteEmpleado(id) {
  await prisma.empleado.delete({ where: { id } });
  return true;
}

const listTecnicos = () => listEmpleados({ roles: { has: 'tecnico' } });
const getTecnico = getEmpleado;
const createTecnico = (payload) => createEmpleado(payload, ['tecnico']);
const updateTecnico = (id, payload) => updateEmpleado(id, payload, ['tecnico']);
const deleteTecnico = deleteEmpleado;

const listVendedores = () => listEmpleados({ roles: { has: 'comercial' } });
const getVendedor = getEmpleado;
const createVendedor = (payload) => createEmpleado(payload, ['comercial']);
const updateVendedor = (id, payload) => updateEmpleado(id, payload, ['comercial']);
const deleteVendedor = deleteEmpleado;

async function listMantenciones() {
  const mantenciones = await prisma.mantencion.findMany({
    orderBy: [{ fechaProgramada: 'desc' }, { createdAt: 'desc' }],
    include: mantencionInclude,
  });
  return mantenciones.map(formatMantencion);
}

async function getMantencion(id) {
  const mantencion = await prisma.mantencion.findUnique({ where: { id }, include: mantencionInclude });
  return formatMantencion(mantencion);
}

async function createMantencion(payload) {
  const equipoIds = asArray(payload.equipoIds || payload.equipoId);
  const mantencion = await prisma.$transaction(async (tx) => {
    const created = await tx.mantencion.create({ data: normalizeMantencionPayload(payload) });
    await syncMantencionEquipos(tx, created.id, equipoIds);
    return created;
  });
  return getMantencion(mantencion.id);
}

async function updateMantencion(id, payload) {
  const equipoIds = asArray(payload.equipoIds || payload.equipoId);
  await prisma.$transaction(async (tx) => {
    await tx.mantencion.update({ where: { id }, data: normalizeMantencionPayload(payload) });
    if ('equipoIds' in payload || 'equipoId' in payload) {
      await syncMantencionEquipos(tx, id, equipoIds);
    }
  });
  return getMantencion(id);
}

async function deleteMantencion(id) {
  await prisma.mantencion.delete({ where: { id } });
  return true;
}

async function listIncidentes() {
  const incidentes = await prisma.incidente.findMany({
    orderBy: [{ fechaReporte: 'desc' }],
    include: incidenteInclude,
  });
  return incidentes.map(formatIncidente);
}

async function getIncidente(id) {
  const incidente = await prisma.incidente.findUnique({ where: { id }, include: incidenteInclude });
  return formatIncidente(incidente);
}

async function createIncidente(payload) {
  const incidente = await prisma.incidente.create({ data: normalizeIncidentePayload(payload) });
  return getIncidente(incidente.id);
}

async function updateIncidente(id, payload) {
  await prisma.incidente.update({ where: { id }, data: normalizeIncidentePayload(payload) });
  return getIncidente(id);
}

async function deleteIncidente(id) {
  await prisma.incidente.delete({ where: { id } });
  return true;
}

async function listVisitas() {
  const visitas = await prisma.visita.findMany({
    orderBy: { fecha: 'desc' },
    include: visitaInclude,
  });
  return visitas.map(formatVisita);
}

async function getVisita(id) {
  const visita = await prisma.visita.findUnique({ where: { id }, include: visitaInclude });
  return formatVisita(visita);
}

async function createVisita(payload) {
  const equipoIds = asArray(payload.equipoIds || payload.equipoId);
  const visita = await prisma.$transaction(async (tx) => {
    const created = await tx.visita.create({ data: normalizeVisitaPayload(payload) });
    await syncVisitaEquipos(tx, created.id, equipoIds);
    await syncVisitaEmpleados(tx, created.id, payload);
    return created;
  });
  return getVisita(visita.id);
}

async function updateVisita(id, payload) {
  const equipoIds = asArray(payload.equipoIds || payload.equipoId);
  await prisma.$transaction(async (tx) => {
    await tx.visita.update({ where: { id }, data: normalizeVisitaPayload(payload) });
    if ('equipoIds' in payload || 'equipoId' in payload) {
      await syncVisitaEquipos(tx, id, equipoIds);
    }
    if ('empleadoIds' in payload || 'tecnicoId' in payload || 'vendedorId' in payload) {
      await syncVisitaEmpleados(tx, id, payload);
    }
  });
  return getVisita(id);
}

async function deleteVisita(id) {
  await prisma.visita.delete({ where: { id } });
  return true;
}

async function addVisitaImagen(payload) {
  const imagen = await prisma.visitaImagen.create({
    data: {
      visitaId: payload.visitaId,
      equipoId: emptyToNull(payload.equipoId),
      tipo: payload.tipo || 'evidencia',
      bucket: payload.bucket,
      objectKey: payload.objectKey,
      url: emptyToNull(payload.url),
      mimeType: emptyToNull(payload.mimeType),
      fileName: emptyToNull(payload.fileName),
      sizeBytes: payload.sizeBytes ? Number(payload.sizeBytes) : null,
      caption: emptyToNull(payload.caption),
    },
  });
  return imagen;
}

async function getDashboardStats() {
  const [
    clientes,
    equipos,
    visitas,
    mantencionesAbiertas,
    incidentesAbiertos,
    empleados,
  ] = await Promise.all([
    prisma.cliente.count(),
    prisma.equipo.count(),
    prisma.visita.count(),
    prisma.mantencion.count({ where: { estado: { in: ['programada', 'asignada', 'en_progreso'] } } }),
    prisma.incidente.count({ where: { estado: { in: ['abierto', 'en_revision'] } } }),
    prisma.empleado.count({ where: { estado: 'activo' } }),
  ]);

  return { clientes, equipos, visitas, mantencionesAbiertas, incidentesAbiertos, empleados };
}

function applyDateRange(visitas, desde, hasta) {
  return visitas.filter((visita) => {
    const fecha = new Date(visita.fecha);

    if (desde && fecha < new Date(desde)) return false;

    if (hasta) {
      const hastaDate = new Date(hasta);
      hastaDate.setHours(23, 59, 59, 999);
      if (fecha > hastaDate) return false;
    }

    return true;
  });
}

async function getInformeVisitas(filters = {}) {
  const { desde, hasta, estado, clienteId } = filters;
  let visitas = await listVisitas();

  if (estado && estado !== 'todos') visitas = visitas.filter((visita) => visita.estado === estado);
  if (clienteId) visitas = visitas.filter((visita) => visita.clienteId === clienteId);

  visitas = applyDateRange(visitas, desde, hasta);

  const productos = visitas
    .flatMap((visita) => visita.equipos || [])
    .reduce((acc, equipo) => {
      if (!acc.some((item) => item.id === equipo.id)) acc.push(equipo);
      return acc;
    }, []);

  return {
    filtros: { desde: desde || '', hasta: hasta || '', estado: estado || 'todos', clienteId: clienteId || '' },
    total: visitas.length,
    visitas,
    productos,
  };
}

async function getInformeFacturacion(filters = {}) {
  const { desde, hasta } = filters;
  const visitasFiltradas = applyDateRange(await listVisitas(), desde, hasta);
  const resumenPorServicio = {};
  const resumenPorCliente = {};
  let totalFacturado = 0;

  visitasFiltradas.forEach((visita) => {
    const servicioNombre = visita.servicio?.descripcion || 'Servicio sin nombre';
    const clienteNombre = visita.cliente?.nombre || 'Cliente sin nombre';
    const monto = visita.servicio?.precio || visita.mantencion?.montoEstimado || 0;
    totalFacturado += monto;

    if (!resumenPorServicio[servicioNombre]) resumenPorServicio[servicioNombre] = { servicio: servicioNombre, cantidad: 0, total: 0 };
    resumenPorServicio[servicioNombre].cantidad += 1;
    resumenPorServicio[servicioNombre].total += monto;

    if (!resumenPorCliente[clienteNombre]) resumenPorCliente[clienteNombre] = { cliente: clienteNombre, cantidad: 0, total: 0 };
    resumenPorCliente[clienteNombre].cantidad += 1;
    resumenPorCliente[clienteNombre].total += monto;
  });

  const productos = visitasFiltradas
    .flatMap((visita) => visita.equipos || [])
    .reduce((acc, equipo) => {
      if (!acc.some((item) => item.id === equipo.id)) acc.push(equipo);
      return acc;
    }, []);

  return {
    filtros: { desde: desde || '', hasta: hasta || '' },
    totalServicios: visitasFiltradas.length,
    totalFacturado,
    porServicio: Object.values(resumenPorServicio).sort((a, b) => b.total - a.total),
    porCliente: Object.values(resumenPorCliente).sort((a, b) => b.total - a.total),
    productos,
  };
}

export {
  addVisitaImagen,
  createCliente,
  createEmpleado,
  createEquipo,
  createIncidente,
  createMantencion,
  createServicio,
  createTecnico,
  createVendedor,
  createVisita,
  deleteCliente,
  deleteEmpleado,
  deleteEquipo,
  deleteIncidente,
  deleteMantencion,
  deleteServicio,
  deleteTecnico,
  deleteVendedor,
  deleteVisita,
  getCliente,
  getDashboardStats,
  getEmpleado,
  getEquipo,
  getIncidente,
  getInformeFacturacion,
  getInformeVisitas,
  getMantencion,
  getServicio,
  getTecnico,
  getVendedor,
  getVisita,
  listClientes,
  listEmpleados,
  listEquipos,
  listIncidentes,
  listMantenciones,
  listServicios,
  listTecnicos,
  listVendedores,
  listVisitas,
  updateCliente,
  updateEmpleado,
  updateEquipo,
  updateIncidente,
  updateMantencion,
  updateServicio,
  updateTecnico,
  updateVendedor,
  updateVisita,
};
