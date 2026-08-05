# ContextIA - Servicio técnico por OT

Última actualización: 2026-08-04.

## Objetivo y fuente de verdad

La operación técnica nueva se organiza en `OrdenTrabajo` y `OrdenTrabajoActividad`. Una OT agrupa cliente y uno o más equipos; puede crearse con cero, una o varias actividades. La evidencia, notas, matrices, estado y documentos pertenecen a la actividad, nunca directamente a la OT.

`Visita` se conserva sólo para historia y compatibilidad. La migración legacy creó OT y relaciones trazables sin borrar la fuente anterior; no se deben implementar flujos nuevos sobre `Visita`.

## Actividades

- Una actividad tiene tipo, técnico asignado, título, descripción breve, notas, prioridad, programación y estado.
- La OT define su criticidad (`baja`, `media`, `alta` o `crítica`); el nivel no forma parte del maestro de equipo.
- El selector de equipo de una OT permite buscar por nombre, código CMC, EAN, Part Number o número de serie, escanear esos códigos mediante cámara y abrir “Ingresar nuevo equipo” sin abandonar la OT. El equipo creado se selecciona automáticamente cuando pertenece al cliente de la OT.
- El formulario de equipo sugiere nombres, fabricantes, modelos y Part Number ya usados, pero permite valores nuevos sin administrar maestros separados. Su propietario obligatorio se fija al crear: cliente de la OT o CMCing en el maestro general.
- Tipos iniciales: visita a terreno, recepción en laboratorio CMC, evaluación en terreno, asistencia remota y entrega de equipo.
- Las fotografías se guardan en R2 bajo `private/ordenes-trabajo/{otId}/actividades/{actividadId}` y su metadata se registra en `ArchivoAdjunto`.
- Cerrar una actividad exige todas las respuestas obligatorias. PostgreSQL fuerza el bloqueo y hace inmutables la actividad y sus notas, matrices, respuestas, imágenes y documentos.
- Sólo `ADMIN` o `SUPERADMIN` pueden desbloquear. El motivo debe tener al menos 10 caracteres y el RPC registra actor, revisiones y auditoría.
- `ActividadAuditoria` es append-only: registra creación, cambios, cierre, desbloqueo, cambios de hijos, conflicto de sincronización y documento emitido.

## Matrices de cumplimiento

- `/matrices` administra matrices `evaluacion` e `informe_resultado`.
- Cada ítem mantiene uno de cuatro tipos inmutables: `numero`, `dicotomica`, `seleccion_multiple` o `texto`.
- Los ítems numéricos pueden referenciar `MedicionCatalogo`; el cuadro combinado permite crear una medición desde el mismo listado.
- `MatrizAlcance` define asignaciones por defecto según tipo de actividad, cliente o equipo. Al crear una OT, el usuario puede conservar o reemplazar la selección heredada.
- Una matriz publicada conserva snapshot y SHA-256, y no admite cambios destructivos. Las modificaciones se realizan creando una nueva versión dentro de la misma familia.
- La asignación a una actividad guarda su propia definición/version/hash para que el formulario y el informe sigan siendo reproducibles aunque exista una versión posterior.
- Los listados seleccionables usan `ComboBox` o `MultiComboBox`, no `<select>` nativos para estos flujos.

## App del técnico offline-first

- `/tecnico` presenta sólo actividades visibles para la sesión y prioriza una jornada móvil de baja distracción.
- `/api/tecnico/bootstrap` consulta `OrdenTrabajoActividad` y sus relaciones con el cliente Supabase del usuario; RLS limita un técnico a sus asignaciones.
- IndexedDB/Dexie guarda el snapshot de jornada, borradores, blobs de fotografías y una outbox separada por usuario.
- `/api/tecnico/sync` valida el payload con Zod y usa RPC atómicos para notas, respuestas y cierre.
- Cada mutación usa `clientMutationId`, hash y `expectedRevision`. Los reintentos son idempotentes y un cambio concurrente retorna `409`, persiste el conflicto y obliga a revisar el snapshot del servidor.
- El service worker conserva un shell estático de `/tecnico`, pero Auth y APIs permanecen network-only. El logout debe limpiar la partición offline del usuario.

En producción se verificó que `sw.js` queda activo bajo HTTPS y que su caché contiene el manifiesto, logo y assets estáticos. También se validó el login sin overflow en 320/375/390/768 y con consola limpia. Sigue pendiente el recorrido de cerrar/reabrir sin red con una sesión técnica real y datos de jornada asignados.

El código y la base están preparados, pero falta QA E2E real cerrando el navegador, perdiendo conexión, reabriendo con sesión válida y sincronizando al recuperar red.

## Notas técnicas con OpenAI

- `/api/ia/notas-tecnico` y `app/lib/openai-notes.js` preparan la mejora de redacción mediante Responses API.
- La solicitud usa contexto mínimo de la actividad y prohíbe inventar diagnósticos, repuestos, mediciones o trabajos.
- La sugerencia nunca se persiste automáticamente: el técnico debe revisarla y guardarla.
- El modelo por defecto es `gpt-5-mini` y puede cambiarse con `OPENAI_NOTES_MODEL`.
- `OPENAI_API_KEY` permanece sin configurar porque el usuario ingresará la credencial después. La función debe mostrarse como no disponible y no intentar llamadas mientras falte la variable.
- Las variables OpenAI son exclusivamente server-side; nunca usar prefijo `NEXT_PUBLIC_`.

## R2 privado

- PostgreSQL conserva bucket, key, MIME, tamaño, checksum y metadata; no el binario.
- La carga valida rol/propiedad, tamaño, MIME y firma mágica antes de persistir metadata.
- `/api/r2/private` entrega objetos únicamente a una sesión autorizada y soporta streaming/range sin crear URL pública.
- Si falla el registro SQL después de subir, el flujo debe limpiar el objeto huérfano.
- La implementación está endurecida, pero falta probar en el entorno publicado carga, lectura no autorizada, range y limpieza ante error.

## Informe por actividad

`GET /api/ot-actividades/{id}/pdf` genera un A4 con identidad CMC, OT, actividad, cliente, equipo, técnico, notas, matrices y respuestas. Las imágenes privadas autorizadas se incorporan como anexo. La muestra estándar se generó y renderizó sin recortes, solapamientos ni errores visuales. `ActividadDocumento` permite persistir el artefacto, snapshot y hash, pero la emisión autenticada/versionada de punta a punta y la plantilla formal aún requieren aprobación de CMC.

## Archivos clave

- `app/lib/service-work-store.js`: dominio OT/matrices.
- `app/lib/compliance-reporting.js`: PDF de actividad.
- `app/lib/openai-notes.js`: integración OpenAI diferida.
- `app/lib/offline/`: base local, codecs y outbox.
- `app/api/tecnico/bootstrap/route.js`: jornada autorizada.
- `app/api/tecnico/sync/route.js`: mutaciones offline.
- `app/ordenes-trabajo/`, `app/actividades/`, `app/matrices/` y `app/tecnico/`: superficies de UI.
- `supabase/migrations/20260715160000_ordenes_trabajo_matrices_cumplimiento.sql` y migraciones `20260804*`: esquema, auditoría, versiones, RPC y RLS.

## Estado y próximos controles

Las 11 migraciones productivas están aplicadas, el OpenAPI remoto confirmó 42 tablas y `https://cm-cing.vercel.app/api/health?deep=1` respondió `200` con `database: ok`. Producción, responsive público, SSO hasta Microsoft, headers, manifiesto y registro del service worker están verificados. Faltan: ciclo OT real completo, permisos negativos entre técnicos, conflicto offline con sesión auténtica, bloqueo/desbloqueo auditado, carga/lectura R2 privada y aprobación formal del PDF.
