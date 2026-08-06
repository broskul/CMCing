# ContextIA - Supabase

Última actualización: 2026-08-05.

## Objetivo

Supabase/PostgreSQL es la fuente de verdad de identidad, maestros, órdenes de trabajo, actividades, matrices, auditoría, documentos y sincronización. IndexedDB conserva trabajo temporal del técnico, pero nunca reemplaza el estado canónico del servidor.

## Estado remoto verificado

- Proyecto: `vgfoubwwxqkrtpymzbat`.
- El lote productivo de 11 migraciones se aplicó en orden sobre las dos migraciones base existentes.
- El OpenAPI remoto confirmó 42 tablas públicas después de la aplicación.
- El hook `Before User Created` está activo y el proveedor Azure está habilitado.
- La invitación real de Carlos devolvió `200`; Graph aceptó el envío con `202` y `AuthEmailDelivery` quedó `ACCEPTED`, `attempts = 1`, sin error. La cuenta invitada aún no está confirmada.
- El proyecto reporta `ACTIVE_HEALTHY` y la salud profunda del despliegue productivo confirmó `database: ok`. Continúa en plan Free y no hay backups de plataforma configurados; esa ausencia sigue siendo un riesgo operativo.

La confirmación OpenAPI prueba presencia del esquema remoto, no por sí sola cada política, trigger, RPC ni recorrido funcional.

## Modelo canónico

- `Usuario`: vínculo con `auth.users`, rol y habilitación.
- `Cliente`, `ClienteContacto`, `ClienteDireccion`, `Equipo`, `EquipoHojaVida`, `Servicio`, `Tecnico` y `Vendedor`: maestros. Un único `Cliente.esEmpresaCMCing = true` representa los equipos propios de CMCing sin dejar `clienteId` nulo.
- `OrdenTrabajo`, `OrdenTrabajoEquipo` y `OrdenTrabajoActividad`: operación técnica nueva.
- `MatrizCumplimiento`, `MatrizItem`, `MedicionCatalogo`, `MatrizAlcance`, `ActividadMatrizAsignada` y `ActividadMatrizRespuesta`: cumplimiento versionado.
- `ActividadAuditoria`: bitácora append-only de la actividad y sus hijos.
- `ArchivoAdjunto` y `ActividadDocumento`: metadata, snapshots y artefactos; el binario vive privado en R2.
- `SyncMutationReceipt`, `SyncConflict` y `SyncOutbox`: idempotencia, conflictos y eventos de sincronización.
- `AuthAccessRule` y `AuthEmailDelivery`: allowlist de identidad y ledger de correo Auth.

`Visita` y `VisitaActividad` permanecen como modelo histórico. La migración `20260804103000_legacy_visita_to_ot.sql` conserva origen y evidencia mediante relaciones explícitas y `MigracionLegacyVisitaOT`; no deben usarse para crear trabajo técnico nuevo.

## Equipos y criticidad

- `Equipo.codigoInterno` se asigna exclusivamente en PostgreSQL mediante secuencia y trigger como `CMC-00001`, `CMC-00002`, etc.; no llega desde la UI y no cambia después del alta.
- El propietario es obligatorio: un cliente real o el registro técnico `CMCing · Equipo propio`. El trigger rechaza cualquier cambio posterior de `clienteId`.
- La identificación de catálogo usa `nombre`, `fabricante`, `modelo`, `partNumber`, `serial` opcional y `ean` opcional (8, 13 o 14 dígitos). No existen maestros separados de fabricantes, modelos o Part Number: los valores del propio maestro de equipos son el catálogo de sugerencias.
- `criticidad` ya no pertenece a `Equipo`. La columna canónica vive en `OrdenTrabajo`; un trigger la mantiene sincronizada con `prioridad` mientras el cliente técnico móvil conserva esa compatibilidad.
- La migración `20260804114000_equipo_identidad_imagenes_y_criticidad_ot.sql` fue aplicada en producción el 2026-08-05 mediante SQL Editor. Se verificaron por Data API `Equipo.partNumber`, `Equipo.ean`, metadata R2, `Cliente.esEmpresaCMCing` y `OrdenTrabajo.criticidad`.
- El selector de propietario, tanto en Equipos como en el alta contextual desde una OT, obtiene los clientes desde `Cliente`; conserva un fallback visible si el catálogo no responde, sin ocultar clientes existentes.

## Integridad y auditoría

- `rowRevision` entrega concurrencia optimista y aumenta también cuando cambian hijos relevantes.
- Cerrar una actividad fuerza `cerrada` + `bloqueada`; notas, respuestas, matrices, imágenes y documentos quedan inmutables.
- El desbloqueo se realiza sólo por RPC administrativo, exige motivo y registra actor, revisiones y origen.
- `ActividadAuditoria` no permite actualización ni eliminación y sus claves foráneas usan `ON DELETE RESTRICT`.
- Las matrices publicadas conservan snapshot y hash; su definición deja de ser editable y una nueva revisión se crea como otra versión de la familia.
- `ActividadDocumento` conserva el snapshot/hash del informe emitido para futura trazabilidad; la generación y persistencia E2E todavía requieren validación.

## Offline-first y RPC

La app técnica usa IndexedDB/Dexie y una outbox local. `/api/tecnico/bootstrap` obtiene sólo la jornada autorizada y `/api/tecnico/sync` aplica mutaciones mediante la sesión Supabase del usuario.

RPC de dominio utilizados por el flujo offline:

- `cmc_actualizar_notas_actividad`
- `cmc_guardar_respuestas_matriz`
- `cmc_cerrar_actividad`
- `cmc_desbloquear_actividad` para el flujo administrativo correspondiente

Cada mutación usa `clientMutationId`, hash del request y revisión esperada. Reintentar el mismo contenido devuelve el recibo; reutilizar el ID con otro contenido se rechaza. Un conflicto de revisión se persiste en `SyncConflict` junto con payload y snapshot del servidor.

## RLS y acceso

- Las políticas finales viven en `20260804104000_rls_views_security.sql`.
- `SUPERADMIN`, `ADMIN`, `OPERACIONES` y `LECTURA` acceden según su función; `LECTURA` no muta.
- Un `TECNICO` sólo puede leer la OT, cliente, equipo, contactos y actividad relacionados con una asignación propia, y sólo puede mutar por los contratos permitidos.
- Las vistas sensibles usan semántica `security_invoker` cuando corresponde.
- Las APIs de usuario deben usar `createSupabaseServerClient`/sesión y RLS. `app/lib/supabase-server.js` exige una llave privada para tareas elevadas y ya no cae a anon como bypass del servidor.

## Archivos clave

- `app/lib/supabase-auth-server.js`: cliente SSR del usuario.
- `app/lib/supabase-server.js`: cliente elevado explícito.
- `app/lib/service-work-store.js`: persistencia de OT, actividades y matrices.
- `app/api/tecnico/bootstrap/route.js`: snapshot de jornada autorizado.
- `app/api/tecnico/sync/route.js`: mutaciones offline atómicas.
- `supabase/migrations/`: fuente canónica del esquema.
- `scripts/apply-supabase-migration.mjs`: aplica un único archivo versionado por Supabase Management API; exige `SUPABASE_ACCESS_TOKEN` y evita depender del navegador.
- `scripts/verify-equipment-schema.mjs`: valida por Data API los campos canónicos de equipos, propietario y criticidad.
- `prisma/schema.prisma`: referencia secundaria; puede quedar desfasada y requiere introspección antes de usarse como contrato.

## Pendientes reales

- Probar con sesiones reales las políticas de cada rol, incluidos intentos negativos entre técnicos.
- Validar E2E idempotencia, conflicto, cierre, bloqueo y desbloqueo desde dos clientes.
- Definir backups/PITR y un procedimiento de recuperación antes de considerar cerrada la continuidad operacional.
- Completar la aceptación de la invitación y el primer login de Carlos; la aceptación `202` de Graph no acredita confirmación del usuario.
- Regenerar tipos/introspección si el frontend necesita cobertura completa de las 42 tablas.
- Registrar en el vault de CMCing `SUPABASE_ACCESS_TOKEN` con permiso de Management API para ejecutar futuras migraciones mediante `Vault.ps1 Run`. La llave privada de la app mantiene acceso al Data API, pero no reemplaza ese permiso de DDL.
