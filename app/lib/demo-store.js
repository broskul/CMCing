const DEMO_KEY = '__cmcing_demo_store__';

const ESTADOS = ['pendiente', 'en_progreso', 'completada', 'cancelada'];

function nowIso() {
  return new Date().toISOString();
}

function buildInitialData() {
  const createdAt = nowIso();

  const clientes = [
    {
      id: 1,
      nombre: 'Hospital Central Metropolitano',
      email: 'biomedica@hospitalcentral.cl',
      telefono: '+56 2 2330 4500',
      direccion: 'Av. Salud 1500, Santiago',
      createdAt,
      updatedAt: createdAt,
    },
    {
      id: 2,
      nombre: 'Clínica del Sur',
      email: 'soporte@clinicadelsur.cl',
      telefono: '+56 41 221 9930',
      direccion: 'Camino Médico 442, Concepción',
      createdAt,
      updatedAt: createdAt,
    },
    {
      id: 3,
      nombre: 'Laboratorio Diagnóstico Andes',
      email: 'compras@labandes.cl',
      telefono: '+56 2 2740 1180',
      direccion: 'Los Robles 901, Providencia',
      createdAt,
      updatedAt: createdAt,
    },
  ];

  const equipos = [
    {
      id: 1,
      nombre: 'Termociclador',
      modelo: 'EQ-BM 68',
      serial: 'TC-BM68-2026-019',
      clienteId: 1,
      imagenUrl: '/productos/termociclador-eq-bm-68-ref.png',
      createdAt,
      updatedAt: createdAt,
    },
    {
      id: 2,
      nombre: 'Gabinete A2',
      modelo: 'EQ-MO-86',
      serial: 'GB-A2-2026-114',
      clienteId: 2,
      imagenUrl: '/productos/gabinete-a2-eq-mo-86-ref.jpg',
      createdAt,
      updatedAt: createdAt,
    },
    {
      id: 3,
      nombre: 'Termociclador',
      modelo: 'EQ-BM 68',
      serial: 'TC-BM68-2026-031',
      clienteId: 3,
      imagenUrl: '/productos/termociclador-eq-bm-68-ref.png',
      createdAt,
      updatedAt: createdAt,
    },
  ];

  const servicios = [
    { id: 1, descripcion: 'Mantenimiento preventivo', precio: 285000, createdAt, updatedAt: createdAt },
    { id: 2, descripcion: 'Calibración y validación', precio: 340000, createdAt, updatedAt: createdAt },
    { id: 3, descripcion: 'Diagnóstico y reparación', precio: 420000, createdAt, updatedAt: createdAt },
  ];

  const vendedores = [
    { id: 1, nombre: 'Carlos Mena', email: 'carlos.mena@cmcing.cl', telefono: '+56 9 7777 1201', createdAt, updatedAt: createdAt },
    { id: 2, nombre: 'María Soto', email: 'maria.soto@cmcing.cl', telefono: '+56 9 7777 1202', createdAt, updatedAt: createdAt },
  ];

  const tecnicos = [
    { id: 1, nombre: 'Ana Rojas', especialidad: 'Biología molecular', email: 'ana.rojas@cmcing.cl', telefono: '+56 9 6666 3301', createdAt, updatedAt: createdAt },
    { id: 2, nombre: 'Juan Pérez', especialidad: 'Metrología', email: 'juan.perez@cmcing.cl', telefono: '+56 9 6666 3302', createdAt, updatedAt: createdAt },
  ];

  const now = new Date();
  const visitas = [
    {
      id: 1,
      clienteId: 1,
      equipoId: 1,
      equipoIds: [1],
      tecnicoId: 1,
      vendedorId: 1,
      servicioId: 1,
      fecha: new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7, 10, 0).toISOString(),
      descripcion: 'Revisión general y limpieza de módulos térmicos.',
      estado: 'completada',
      createdAt,
      updatedAt: createdAt,
    },
    {
      id: 2,
      clienteId: 2,
      equipoId: 2,
      equipoIds: [2],
      tecnicoId: 2,
      vendedorId: 2,
      servicioId: 2,
      fecha: new Date(now.getFullYear(), now.getMonth(), now.getDate() - 3, 14, 30).toISOString(),
      descripcion: 'Ajuste de sensores y emisión de certificado de calibración.',
      estado: 'en_progreso',
      createdAt,
      updatedAt: createdAt,
    },
    {
      id: 3,
      clienteId: 3,
      equipoId: 3,
      equipoIds: [3],
      tecnicoId: 1,
      vendedorId: 1,
      servicioId: 3,
      fecha: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 9, 0).toISOString(),
      descripcion: 'Diagnóstico por alarma de temperatura y revisión de placa.',
      estado: 'pendiente',
      createdAt,
      updatedAt: createdAt,
    },
  ];

  return {
    clientes,
    equipos,
    servicios,
    vendedores,
    tecnicos,
    visitas,
    nextIds: {
      clientes: clientes.length + 1,
      equipos: equipos.length + 1,
      servicios: servicios.length + 1,
      vendedores: vendedores.length + 1,
      tecnicos: tecnicos.length + 1,
      visitas: visitas.length + 1,
    },
  };
}

function getStore() {
  if (!globalThis[DEMO_KEY]) {
    globalThis[DEMO_KEY] = buildInitialData();
  }
  return globalThis[DEMO_KEY];
}

function clone(value) {
  return structuredClone(value);
}

function collectionOf(entity) {
  const store = getStore();
  if (!store[entity]) throw new Error(`Colección no soportada: ${entity}`);
  return store[entity];
}

function findById(entity, id) {
  return collectionOf(entity).find((item) => item.id === Number(id)) || null;
}

function getVisitaEquipoIds(visita) {
  if (Array.isArray(visita.equipoIds) && visita.equipoIds.length > 0) {
    return visita.equipoIds.map((id) => Number(id)).filter((id) => Number.isInteger(id));
  }

  if (visita.equipoId) {
    return [Number(visita.equipoId)];
  }

  return [];
}

function visitaHasEquipo(visita, equipoId) {
  return getVisitaEquipoIds(visita).includes(Number(equipoId));
}

function ensureEstado(estado) {
  if (!estado) return 'pendiente';
  if (!ESTADOS.includes(estado)) {
    throw new Error(`Estado inválido. Usa: ${ESTADOS.join(', ')}`);
  }
  return estado;
}

function normalizePayload(entity, payload, { creating }) {
  const normalized = { ...payload };

  ['clienteId', 'equipoId', 'tecnicoId', 'vendedorId', 'servicioId'].forEach((field) => {
    if (field in normalized) {
      normalized[field] = normalized[field] === null || normalized[field] === '' || typeof normalized[field] === 'undefined'
        ? null
        : Number(normalized[field]);
    }
  });

  if ('equipoIds' in normalized) {
    if (Array.isArray(normalized.equipoIds)) {
      normalized.equipoIds = normalized.equipoIds
        .map((id) => Number(id))
        .filter((id) => Number.isInteger(id));
    } else {
      normalized.equipoIds = [];
    }
  }

  if ('precio' in normalized && normalized.precio !== null && normalized.precio !== '') {
    normalized.precio = Number(normalized.precio);
  }

  if ('fecha' in normalized && normalized.fecha) {
    normalized.fecha = new Date(normalized.fecha).toISOString();
  }

  if (entity === 'visitas') {
    if (creating || 'estado' in payload) {
      normalized.estado = ensureEstado(normalized.estado);
    }

    const includesEquipoIds = 'equipoIds' in payload;
    const includesEquipoId = 'equipoId' in payload;

    if (creating || includesEquipoIds || includesEquipoId) {
      const visitEquipoIds = Array.isArray(normalized.equipoIds) && normalized.equipoIds.length > 0
        ? normalized.equipoIds
        : normalized.equipoId
          ? [Number(normalized.equipoId)]
          : [];

      normalized.equipoIds = [...new Set(visitEquipoIds)];
      normalized.equipoId = normalized.equipoIds[0] || null;
    }
  }

  if (creating) {
    normalized.createdAt = nowIso();
  }

  normalized.updatedAt = nowIso();
  return normalized;
}

function createEntity(entity, payload) {
  const store = getStore();
  const normalized = normalizePayload(entity, payload, { creating: true });
  const item = { ...normalized, id: store.nextIds[entity] };
  store.nextIds[entity] += 1;
  collectionOf(entity).push(item);
  return clone(item);
}

function updateEntity(entity, id, payload) {
  const items = collectionOf(entity);
  const index = items.findIndex((item) => item.id === Number(id));
  if (index === -1) return null;
  const normalized = normalizePayload(entity, payload, { creating: false });
  items[index] = { ...items[index], ...normalized, id: Number(id) };
  return clone(items[index]);
}

function deleteEntity(entity, id) {
  const items = collectionOf(entity);
  const index = items.findIndex((item) => item.id === Number(id));
  if (index === -1) return false;
  items.splice(index, 1);
  return true;
}

function formatVisitaRelations(visita) {
  const cliente = findById('clientes', visita.clienteId);
  const equipoIds = getVisitaEquipoIds(visita);
  const equipos = equipoIds
    .map((equipoId) => findById('equipos', equipoId))
    .filter(Boolean)
    .map((equipo) => ({
      id: equipo.id,
      nombre: equipo.nombre,
      serial: equipo.serial,
      modelo: equipo.modelo,
      imagenUrl: equipo.imagenUrl,
    }));
  const equipo = equipos[0] || null;
  const tecnico = findById('tecnicos', visita.tecnicoId);
  const vendedor = visita.vendedorId ? findById('vendedores', visita.vendedorId) : null;
  const servicio = findById('servicios', visita.servicioId);

  return {
    ...visita,
    equipoIds: equipos.map((item) => item.id),
    equipoId: equipo?.id || null,
    cliente: cliente ? { id: cliente.id, nombre: cliente.nombre } : null,
    equipo,
    equipos,
    tecnico: tecnico ? { id: tecnico.id, nombre: tecnico.nombre } : null,
    vendedor: vendedor ? { id: vendedor.id, nombre: vendedor.nombre } : null,
    servicio: servicio ? { id: servicio.id, descripcion: servicio.descripcion, precio: servicio.precio || 0 } : null,
  };
}

function listClientes() {
  const store = getStore();
  return store.clientes.map((cliente) => ({
    ...clone(cliente),
    equipos: store.equipos
      .filter((equipo) => equipo.clienteId === cliente.id)
      .map((equipo) => ({ id: equipo.id, nombre: equipo.nombre, modelo: equipo.modelo, serial: equipo.serial, imagenUrl: equipo.imagenUrl })),
    visitas: store.visitas
      .filter((visita) => visita.clienteId === cliente.id)
      .map((visita) => ({ id: visita.id, fecha: visita.fecha, descripcion: visita.descripcion, estado: visita.estado })),
  }));
}

function getCliente(id) {
  return listClientes().find((cliente) => cliente.id === Number(id)) || null;
}

function listEquipos() {
  const store = getStore();
  return store.equipos.map((equipo) => ({
    ...clone(equipo),
    cliente: (() => {
      const cliente = findById('clientes', equipo.clienteId);
      return cliente ? { id: cliente.id, nombre: cliente.nombre } : null;
    })(),
    visitas: store.visitas
      .filter((visita) => visitaHasEquipo(visita, equipo.id))
      .map((visita) => ({ id: visita.id, fecha: visita.fecha, descripcion: visita.descripcion, estado: visita.estado })),
  }));
}

function getEquipo(id) {
  return listEquipos().find((equipo) => equipo.id === Number(id)) || null;
}

function listServicios() {
  const store = getStore();
  return store.servicios.map((servicio) => ({
    ...clone(servicio),
    visitas: store.visitas
      .filter((visita) => visita.servicioId === servicio.id)
      .map((visita) => ({ id: visita.id, fecha: visita.fecha, descripcion: visita.descripcion, estado: visita.estado })),
  }));
}

function getServicio(id) {
  return listServicios().find((servicio) => servicio.id === Number(id)) || null;
}

function listVendedores() {
  const store = getStore();
  return store.vendedores.map((vendedor) => ({
    ...clone(vendedor),
    visitas: store.visitas
      .filter((visita) => visita.vendedorId === vendedor.id)
      .map((visita) => ({ id: visita.id, fecha: visita.fecha, descripcion: visita.descripcion, estado: visita.estado })),
  }));
}

function getVendedor(id) {
  return listVendedores().find((vendedor) => vendedor.id === Number(id)) || null;
}

function listTecnicos() {
  const store = getStore();
  return store.tecnicos.map((tecnico) => ({
    ...clone(tecnico),
    visitas: store.visitas
      .filter((visita) => visita.tecnicoId === tecnico.id)
      .map((visita) => ({ id: visita.id, fecha: visita.fecha, descripcion: visita.descripcion, estado: visita.estado })),
  }));
}

function getTecnico(id) {
  return listTecnicos().find((tecnico) => tecnico.id === Number(id)) || null;
}

function listVisitas() {
  const store = getStore();
  return store.visitas.map((visita) => formatVisitaRelations(clone(visita)));
}

function getVisita(id) {
  const visita = findById('visitas', id);
  return visita ? formatVisitaRelations(clone(visita)) : null;
}

function getDashboardStats() {
  const store = getStore();
  return {
    clientes: store.clientes.length,
    equipos: store.equipos.length,
    visitas: store.visitas.length,
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

function getInformeVisitas(filters = {}) {
  const { desde, hasta, estado, clienteId } = filters;
  let visitas = listVisitas();

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
    .reduce((acc, visita) => {
      if (!acc.some((producto) => producto.id === visita.id)) {
        acc.push({
          id: visita.id,
          nombre: visita.nombre,
          modelo: visita.modelo,
          serial: visita.serial,
          imagenUrl: visita.imagenUrl,
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

function getInformeFacturacion(filters = {}) {
  const { desde, hasta } = filters;
  const visitasFiltradas = applyDateRange(listVisitas(), desde, hasta);

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
    .reduce((acc, visita) => {
      if (!acc.some((producto) => producto.id === visita.id)) {
        acc.push({
          id: visita.id,
          nombre: visita.nombre,
          modelo: visita.modelo,
          serial: visita.serial,
          imagenUrl: visita.imagenUrl,
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

export {
  createEntity,
  deleteEntity,
  getCliente,
  getDashboardStats,
  getEquipo,
  getInformeFacturacion,
  getInformeVisitas,
  getServicio,
  getTecnico,
  getVendedor,
  getVisita,
  listClientes,
  listEquipos,
  listServicios,
  listTecnicos,
  listVendedores,
  listVisitas,
  updateEntity,
};
