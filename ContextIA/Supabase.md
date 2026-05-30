# ContextIA - Supabase

## Estado vigente

Ultima actualizacion: 2026-05-29.
El runtime de la app opera directo contra Supabase usando `@supabase/supabase-js`. La capa en memoria fue retirada del runtime y `app/lib/demo-store.js` fue eliminado.

## Objetivo del modulo

Mantener Supabase/Postgres como fuente de verdad de maestros, visitas, cotizaciones, auth directa, cola offline, firmas y adjuntos R2.

## Fuentes de verdad y sistemas externos

- Cliente Supabase server-side:
  - `app/lib/supabase-server.js`
- Repositorio de datos runtime:
  - `app/lib/supabase-store.js`
- Esquema Prisma de referencia:
  - `prisma/schema.prisma`
- Migraciones Supabase:
  - `supabase/migrations/20260529131254_cmms_mvp.sql`
  - `supabase/migrations/20260529144500_offline_auth_r2.sql`

## Modelo vigente considerado

- `Usuario`: login directo con password hash y roles.
- `Cliente`, `Equipo`, `Servicio`, `Tecnico`, `Vendedor`, `Visita`: maestros y operacion.
- `Equipo.sku`, `serial`, `nombre`: busqueda principal.
- `EquipoHojaVida`: trazabilidad de vida del equipo.
- `Cotizacion` y `CotizacionItem`: cotizador simple con PDF/mail.
- `Actividad` y `VisitaActividad`: actividades por visita.
- `ArchivoAdjunto`: evidencias, firma y selfie guardadas en R2.
- `ColaSincronizacion`: idempotencia y trazabilidad de cargas offline.

## Flujo funcional real hoy

- Todas las APIs de negocio importan `app/lib/supabase-store.js`.
- `supabase-store` conserva la forma de respuesta esperada por la UI y resuelve relaciones en servidor.
- `supabase-store` tolera migraciones parciales para QA: tablas opcionales ausentes devuelven arreglos vacios y columnas nuevas faltantes se omiten al escribir.
- Si RLS bloquea `VisitaEquipo`, la visita queda asociada por la columna legacy `Visita.equipoId`.
- CRUD de maestros escribe en tablas reales de Supabase.
- Cotizaciones escriben cabecera en `Cotizacion` e items en `CotizacionItem`.
- Visitas con multiples equipos escriben `Visita` y sincronizan `VisitaEquipo`.
- La app tecnica mantiene cola local IndexedDB y al volver conexion llama `/api/tecnico/sync`.
- `/api/tecnico/sync` crea `ColaSincronizacion`, sube adjuntos a R2, crea `ArchivoAdjunto`, actualiza firma del tecnico y marca la visita sincronizada.

## Configuracion vigente

- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY` recomendado para APIs server.
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` se usa como fallback server-side cuando no existe service role y las politicas/tablas lo permiten.

La URL local quedo apuntando a `https://akmcfooalqgzeeiaoihu.supabase.co`. En esta etapa QA el proyecto tiene anon key real y tablas accesibles; si se activa RLS, hay que configurar politicas o agregar service role.

## Decisiones tecnicas vigentes

- El servidor prefiere service role para evitar depender de politicas RLS durante esta etapa productiva inicial.
- Si no hay service role, usa anon key como fallback para permitir QA con tablas abiertas.
- Si ambas llaves faltan o parecen placeholder, la app falla con error explicito.
- La compatibilidad con migraciones parciales es temporal para QA; el objetivo productivo sigue siendo ejecutar todas las migraciones.
- Offline se modela con cola local en cliente + `ColaSincronizacion` server-side.
- El payload offline y `ColaSincronizacion` usan `clientMutationId`; la tabla `Visita` del proyecto actual usa la columna `clienteMutationId`. `supabase-store` acepta ambos nombres y normaliza la respuesta con alias `clientMutationId` para la app tecnica.
- Adjuntos no se guardan en Postgres: solo metadata, bucket, key, URL y checksum.
- `sku` no es unico porque puede representar familia/producto; `serial` y `codigoInterno` mantienen unicidad.

## Riesgos y bugs conocidos

- Las pruebas E2E dependen de que anon tenga permisos o de configurar service role real.
- La DB actual ya expone `Usuario`, `ArchivoAdjunto`, `ColaSincronizacion` y columnas nuevas de tecnicos para login/offline.
- QA 2026-05-29 con anon key: permite crear `Cliente`, `Vendedor`, `Tecnico`, `Servicio`, `Equipo` y `Visita`; bloquea por RLS inserts en `Actividad`, `Cotizacion`, `VisitaEquipo` y trigger de `EquipoHojaVida` al completar visitas.
- QA 2026-05-29 con service role: ya permite crear `Actividad`, `Visita` completada, `VisitaEquipo` y hoja de vida; `CotizacionItem.lineaTotal` se omite en insert porque la DB lo calcula como columna generada.
- QA 2026-05-29 con service role completo: creo cliente, vendedor, tecnico Cristian Manzor, servicio, actividad, equipo, visita completada y cotizacion `COT-2026-000003`; genero PDFs y envio correos.
- QA 2026-05-29 offline/R2: creo datos frescos, cotizacion `COT-FIX-20260530000428`, visita `6`, subio 4 adjuntos a R2 (`evidencia_foto`, `evidencia_pdf`, `firma_tecnico`, `selfie_firma`), actualizo firma completa de Cristian Manzor y valido reintento idempotente con respuesta `duplicate`.
- Login real ya funciona despues de ejecutar la migracion auth/offline y configurar `SUPABASE_SERVICE_ROLE_KEY`.
- Si R2 no esta configurado, la sincronizacion tecnica falla y el item queda en cola local. Si `R2_PUBLIC_BASE_URL` no esta configurado, los adjuntos se guardan con URL `r2://...` y no renderizan como imagen publica en informes HTML/PDF.
- Si RLS se activa mas adelante, hay que reemplazar service role por politicas por rol o endpoints segmentados.

## Pendientes reales y proximos pasos

- Ejecutar migraciones en Supabase del proyecto productivo/staging.
- Mantener al menos un usuario admin activo en `Usuario`.
- Definir permisos por rol en endpoints CRUD.
- Definir politicas de retencion de adjuntos R2.
