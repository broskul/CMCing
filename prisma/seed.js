const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  console.log('Iniciando seed CMMS CMCing...');

  const cliente1 = await prisma.cliente.create({
    data: {
      nombre: 'Hospital Central Metropolitano',
      rut: '76.000.001-1',
      email: 'biomedica@hospitalcentral.cl',
      telefono: '+56 2 2330 4500',
      contactos: {
        create: [{
          nombre: 'Paula Medina',
          cargo: 'Jefa de Ingenieria Clinica',
          rol: 'tecnico',
          email: 'paula.medina@hospitalcentral.cl',
          telefono: '+56 9 7000 1001',
          principal: true,
        }],
      },
      direcciones: {
        create: [{
          tipo: 'servicio',
          direccion: 'Av. Salud 1500',
          comuna: 'Santiago',
          ciudad: 'Santiago',
          region: 'Metropolitana',
          principal: true,
        }],
      },
    },
  });

  const cliente2 = await prisma.cliente.create({
    data: {
      nombre: 'Clinica del Sur',
      rut: '76.000.002-K',
      email: 'soporte@clinicadelsur.cl',
      telefono: '+56 41 221 9930',
      contactos: {
        create: [{
          nombre: 'Rodrigo Vera',
          cargo: 'Encargado de Mantencion',
          rol: 'principal',
          email: 'rodrigo.vera@clinicadelsur.cl',
          telefono: '+56 9 7000 2001',
          principal: true,
        }],
      },
      direcciones: {
        create: [{
          tipo: 'servicio',
          direccion: 'Camino Medico 442',
          comuna: 'Concepcion',
          ciudad: 'Concepcion',
          region: 'Biobio',
          principal: true,
        }],
      },
    },
  });

  const [servicioPreventivo, servicioCorrectivo] = await Promise.all([
    prisma.servicio.create({
      data: {
        codigo: 'PREV',
        descripcion: 'Mantenimiento preventivo',
        tipo: 'preventiva',
        precio: 285000,
      },
    }),
    prisma.servicio.create({
      data: {
        codigo: 'CORR',
        descripcion: 'Diagnostico y reparacion',
        tipo: 'correctiva',
        precio: 420000,
      },
    }),
  ]);

  const jefatura = await prisma.empleado.create({
    data: {
      nombre: 'Laura Pizarro',
      email: 'laura.pizarro@cmcing.cl',
      telefono: '+56 9 6000 1000',
      cargo: 'Jefatura tecnica',
      roles: ['jefatura'],
    },
  });

  const tecnico = await prisma.empleado.create({
    data: {
      nombre: 'Ana Rojas',
      email: 'ana.rojas@cmcing.cl',
      telefono: '+56 9 6000 1001',
      cargo: 'Tecnica especialista',
      especialidad: 'Biologia molecular',
      roles: ['tecnico'],
      supervisorId: jefatura.id,
    },
  });

  const comercial = await prisma.empleado.create({
    data: {
      nombre: 'Carlos Mena',
      email: 'carlos.mena@cmcing.cl',
      telefono: '+56 9 6000 2001',
      cargo: 'Ejecutivo comercial',
      roles: ['comercial'],
    },
  });

  const equipo1 = await prisma.equipo.create({
    data: {
      clienteId: cliente1.id,
      nombre: 'Termociclador',
      marca: 'CMCing',
      modelo: 'EQ-BM 68',
      nroSerie: 'TC-BM68-2026-019',
      ubicacion: 'Laboratorio PCR',
      garantiaHasta: new Date('2027-05-01T00:00:00Z'),
      imagenUrl: '/productos/termociclador-eq-bm-68-ref.png',
      asignaciones: {
        create: [{
          clienteId: cliente1.id,
          motivo: 'Alta inicial',
        }],
      },
    },
  });

  const equipo2 = await prisma.equipo.create({
    data: {
      clienteId: cliente2.id,
      nombre: 'Gabinete A2',
      marca: 'CMCing',
      modelo: 'EQ-MO-86',
      nroSerie: 'GB-A2-2026-114',
      ubicacion: 'Sala de procesamiento',
      imagenUrl: '/productos/gabinete-a2-eq-mo-86-ref.jpg',
      asignaciones: {
        create: [{
          clienteId: cliente2.id,
          motivo: 'Alta inicial',
        }],
      },
    },
  });

  await prisma.planMantencion.create({
    data: {
      equipoId: equipo1.id,
      nombre: 'Preventivo trimestral',
      frecuenciaDias: 90,
      proximaFecha: new Date('2026-06-15T09:00:00Z'),
      cobertura: 'garantia',
    },
  });

  const mantencion = await prisma.mantencion.create({
    data: {
      folio: 'MT-2026-0001',
      clienteId: cliente1.id,
      servicioId: servicioPreventivo.id,
      comercialId: comercial.id,
      jefaturaId: jefatura.id,
      tipo: 'preventiva',
      origen: 'programada',
      cobertura: 'garantia',
      estado: 'programada',
      titulo: 'Preventivo trimestral termociclador',
      fechaProgramada: new Date('2026-06-15T09:00:00Z'),
      equipos: {
        create: [{
          equipoId: equipo1.id,
          principal: true,
          alcance: 'Limpieza, verificacion y pruebas funcionales',
        }],
      },
    },
  });

  const incidente = await prisma.incidente.create({
    data: {
      clienteId: cliente2.id,
      equipoId: equipo2.id,
      asignadoAId: tecnico.id,
      titulo: 'Alarma de flujo irregular',
      descripcion: 'Cliente reporta alarma intermitente durante uso.',
      severidad: 'alta',
      estado: 'abierto',
    },
  });

  await prisma.visita.create({
    data: {
      clienteId: cliente1.id,
      mantencionId: mantencion.id,
      servicioId: servicioPreventivo.id,
      fecha: new Date('2026-06-15T09:00:00Z'),
      estado: 'programada',
      descripcion: 'Visita programada de mantenimiento preventivo.',
      equipos: {
        create: [{ equipoId: equipo1.id, principal: true }],
      },
      empleados: {
        create: [
          { empleadoId: tecnico.id, rol: 'tecnico', principal: true },
          { empleadoId: comercial.id, rol: 'comercial' },
        ],
      },
    },
  });

  await prisma.visita.create({
    data: {
      clienteId: cliente2.id,
      incidenteId: incidente.id,
      servicioId: servicioCorrectivo.id,
      fecha: new Date('2026-05-24T14:30:00Z'),
      estado: 'pendiente',
      descripcion: 'Revision inicial por incidente reportado.',
      equipos: {
        create: [{ equipoId: equipo2.id, principal: true }],
      },
      empleados: {
        create: [{ empleadoId: tecnico.id, rol: 'tecnico', principal: true }],
      },
    },
  });

  console.log('Seed CMMS completado.');
}

main()
  .catch((error) => {
    console.error('Error durante el seed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
