const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Iniciando seed de datos...');

  // Limpiar datos existentes (opcional, comentar si no deseas borrar)
  // await prisma.visita.deleteMany({});
  // await prisma.tecnico.deleteMany({});
  // await prisma.vendedor.deleteMany({});
  // await prisma.servicio.deleteMany({});
  // await prisma.equipo.deleteMany({});
  // await prisma.cliente.deleteMany({});

  // Crear 2 Clientes
  console.log('📋 Creando clientes...');
  const cliente1 = await prisma.cliente.create({
    data: {
      nombre: 'Hospital Central',
      email: 'contacto@hospitalcentral.cl',
      telefono: '+56 9 1234 5678',
      direccion: 'Av. Principal 100, Santiago',
    },
  });

  const cliente2 = await prisma.cliente.create({
    data: {
      nombre: 'Clínica del Sur',
      email: 'info@clinicadelsur.cl',
      telefono: '+56 9 8765 4321',
      direccion: 'Calle Salud 200, Valparaíso',
    },
  });

  // Crear 2 Servicios
  console.log('🔧 Creando servicios...');
  const servicio1 = await prisma.servicio.create({
    data: {
      descripcion: 'Mantenimiento preventivo',
      precio: 150000,
    },
  });

  const servicio2 = await prisma.servicio.create({
    data: {
      descripcion: 'Reparación de equipos',
      precio: 250000,
    },
  });

  // Crear 2 Vendedores
  console.log('👔 Creando vendedores...');
  const vendedor1 = await prisma.vendedor.create({
    data: {
      nombre: 'Carlos García',
      email: 'carlos@cmcing.cl',
      telefono: '+56 9 1111 1111',
    },
  });

  const vendedor2 = await prisma.vendedor.create({
    data: {
      nombre: 'María López',
      email: 'maria@cmcing.cl',
      telefono: '+56 9 2222 2222',
    },
  });

  // Crear 2 Técnicos
  console.log('🛠️ Creando técnicos...');
  const tecnico1 = await prisma.tecnico.create({
    data: {
      nombre: 'Juan Pérez',
      especialidad: 'Equipos de diagnóstico',
      email: 'juan@cmcing.cl',
      telefono: '+56 9 3333 3333',
    },
  });

  const tecnico2 = await prisma.tecnico.create({
    data: {
      nombre: 'Ana Martínez',
      especialidad: 'Equipos de laboratorio',
      email: 'ana@cmcing.cl',
      telefono: '+56 9 4444 4444',
    },
  });

  // Crear 2 Equipos (asociados a clientes)
  console.log('⚙️ Creando equipos...');
  const equipo1 = await prisma.equipo.create({
    data: {
      nombre: 'Resonancia Magnética',
      modelo: 'SIEMENS MAGNETOM',
      serial: 'RM-2024-001',
      clienteId: cliente1.id,
    },
  });

  const equipo2 = await prisma.equipo.create({
    data: {
      nombre: 'Ecógrafo Ultrasónico',
      modelo: 'GE LOGIQ E10',
      serial: 'ECO-2024-002',
      clienteId: cliente2.id,
    },
  });

  // Crear 2 Visitas
  console.log('📅 Creando visitas...');
  const visita1 = await prisma.visita.create({
    data: {
      clienteId: cliente1.id,
      equipoId: equipo1.id,
      tecnicoId: tecnico1.id,
      vendedorId: vendedor1.id,
      servicioId: servicio1.id,
      fecha: new Date('2025-03-15T09:00:00'),
      descripcion: 'Mantenimiento preventivo regular del equipo de RM',
      estado: 'completada',
    },
  });

  const visita2 = await prisma.visita.create({
    data: {
      clienteId: cliente2.id,
      equipoId: equipo2.id,
      tecnicoId: tecnico2.id,
      vendedorId: vendedor2.id,
      servicioId: servicio2.id,
      fecha: new Date('2025-03-18T14:30:00'),
      descripcion: 'Reparación del cabezal del ecógrafo',
      estado: 'en_progreso',
    },
  });

  console.log('✅ Seed completado exitosamente!');
  console.log('\n📊 Datos creados:');
  console.log(`   - Clientes: ${cliente1.nombre}, ${cliente2.nombre}`);
  console.log(`   - Servicios: ${servicio1.descripcion}, ${servicio2.descripcion}`);
  console.log(`   - Vendedores: ${vendedor1.nombre}, ${vendedor2.nombre}`);
  console.log(`   - Técnicos: ${tecnico1.nombre}, ${tecnico2.nombre}`);
  console.log(`   - Equipos: ${equipo1.nombre}, ${equipo2.nombre}`);
  console.log(`   - Visitas: ${visita1.id}, ${visita2.id}`);
}

main()
  .catch((e) => {
    console.error('❌ Error durante el seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
