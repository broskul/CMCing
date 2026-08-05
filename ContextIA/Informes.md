# ContextIA - Informes

Última actualización: 2026-08-04.

## Fuente de verdad

Para trabajo técnico nuevo, el informe pertenece a `OrdenTrabajoActividad`. No se adjuntan fotografías, respuestas ni resultados directamente a la OT. `Visita` y los informes históricos se conservan por compatibilidad, pero no son el modelo canónico del CMMS.

## Informe de actividad

`GET /api/ot-actividades/{id}/pdf` genera con `pdf-lib` un PDF A4 que incorpora:

- identificación de OT y actividad;
- cliente, equipos y técnico;
- título, descripción y notas técnicas;
- matrices asignadas y respuestas de sus cuatro tipos;
- anexos fotográficos privados autorizados.

La implementación usa `app/lib/compliance-reporting.js` y datos del servidor; no depende del HTML visible ni de una URL R2 pública.

## Matrices de informe/resultado

- `MatrizCumplimiento.categoria = informe_resultado` separa la captura destinada al documento de la evaluación operativa.
- Una asignación guarda versión, definición, nombre, categoría y hash como snapshot; un informe antiguo no debe cambiar cuando se publique una matriz nueva.
- Una matriz publicada es inmutable. La evolución se realiza mediante otra versión de la misma familia.
- `ActividadDocumento` modela el artefacto emitido, hash, snapshot y revisión de actividad para futura verificación/reemisión.

La base soporta esta trazabilidad, pero la API actual aún debe cerrar la persistencia del documento emitido en `ActividadDocumento` y R2 como flujo E2E.

## Informes heredados y cotizaciones

- `/informes/visitas` y `/informes/facturacion` siguen disponibles para información histórica basada en `Visita`.
- `/cotizaciones` mantiene PDF y envío por Microsoft Graph; el documento comercial ahora detalla nombre, código opcional, descripción y descuentos por ítem/globales. La especificación de su flujo vive en `ContextIA/Cotizaciones.md`.
- El correo operativo existente no reemplaza el Send Email Hook de Supabase Auth; son flujos distintos.
- Cualquier desarrollo nuevo de servicio técnico debe leer OT/actividad y no ampliar el JSON histórico de `Visita.notasTecnicas`.

## Seguridad y reproducibilidad

- Sólo una sesión autorizada para la actividad puede generar el PDF o leer sus anexos.
- Los binarios privados se leen mediante el backend y nunca se exponen como URL pública.
- El documento final debe conservar snapshot de datos, matriz y respuestas, hash SHA-256, versión de plantilla, actor y fecha de emisión.
- Un documento emitido no debe sobrescribirse; una corrección produce una nueva versión/artefacto auditado.

## Estado de validación

Existe una QA local previa de `scripts/qa-service-work-pdf.mjs` que comprobó un A4 con las cuatro clases de respuesta sin cortes visibles. Esa evidencia no valida todavía datos remotos, autorización, anexos R2, paginación con casos largos, persistencia de `ActividadDocumento` ni el estándar visual final de CMC.

## Pendientes

- Obtener y aprobar una plantilla CMC formal para informe de actividad/entrega.
- Persistir cada emisión en `ActividadDocumento` y su binario privado en R2.
- Validar PDFs con matrices largas, varias páginas, imágenes rotadas y datos faltantes.
- Probar generación autorizada/no autorizada en el entorno Vercel publicado.
- Implementar bitácora de envío y reemisión sin mutar artefactos anteriores.
