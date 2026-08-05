import fs from 'fs/promises';
import path from 'path';
import { buildActivityCompliancePdf } from '../app/lib/compliance-reporting.js';

const activity = {
  titulo: 'Evaluación funcional de monitor multiparámetro',
  descripcionBreve: 'Recepción, inspección visual y verificación funcional del equipo en laboratorio CMC.',
  notasTecnico: 'El equipo se recibe con carcasa íntegra. Se ejecutan pruebas de encendido, alarmas y lectura de parámetros. Los resultados quedan registrados en las matrices adjuntas.',
  fechaProgramada: '2026-07-15T13:30:00-04:00',
  fechaCierre: '2026-07-15T16:10:00-04:00',
  tipoActividad: { nombre: 'Recepción en laboratorio CMC' },
  tecnico: { nombre: 'Técnico CMC' },
  ordenTrabajo: {
    codigo: 'OT-2026-000001',
    cliente: { nombre: 'Clínica de ejemplo' },
    equipo: { nombre: 'Monitor multiparámetro', serial: 'QA-MP-001' },
  },
  matrices: [
    {
      matriz: {
        nombre: 'Evaluación de recepción',
        categoria: 'evaluacion',
        descripcion: 'Controles obligatorios antes de aceptar el equipo en laboratorio.',
      },
      items: [
        { titulo: 'Estado exterior del equipo', tipoRespuesta: 'dicotomica', respuesta: { valorBooleano: true } },
        { titulo: 'Tensión de alimentación medida', tipoRespuesta: 'numero', medicion: { simbolo: 'V' }, respuesta: { valorNumero: 220.4 } },
        { titulo: 'Accesorios recibidos', tipoRespuesta: 'seleccion_multiple', respuesta: { valorOpciones: ['Cable de poder', 'Sensor SpO2', 'Manguera PNI'] } },
        { titulo: 'Observaciones de recepción', tipoRespuesta: 'texto', respuesta: { valorTexto: 'Sin golpes visibles. Etiqueta patrimonial legible.' } },
      ],
    },
    {
      matriz: {
        nombre: 'Resultado de evaluación funcional',
        categoria: 'informe_resultado',
        descripcion: 'Resumen técnico que forma parte del informe de entrega.',
      },
      items: [
        { titulo: 'Prueba de encendido', tipoRespuesta: 'dicotomica', respuesta: { valorBooleano: true } },
        { titulo: 'Resultado general', tipoRespuesta: 'texto', respuesta: { valorTexto: 'Equipo operativo para continuar con mantenimiento preventivo y pruebas de seguridad eléctrica.' } },
      ],
    },
  ],
};

const bytes = await buildActivityCompliancePdf(activity);
const outputDir = path.join(process.cwd(), 'output', 'pdf');
await fs.mkdir(outputDir, { recursive: true });
const outputPath = path.join(outputDir, 'matriz-cumplimiento-estandar.pdf');
await fs.writeFile(outputPath, bytes);
console.log(outputPath);
