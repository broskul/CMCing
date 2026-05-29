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
- CRUD de maestros escribe en tablas reales de Supabase.
- Cotizaciones escriben cabecera en `Cotizacion` e items en `CotizacionItem`.
- Visitas con multiples equipos escriben `Visita` y sincronizan `VisitaEquipo`.
- La app tecnica mantiene cola local IndexedDB y al volver conexion llama `/api/tecnico/sync`.
- `/api/tecnico/sync` crea `ColaSincronizacion`, sube adjuntos a R2, crea `ArchivoAdjunto`, actualiza firma del tecnico y marca la visita sincronizada.

## Configuracion vigente

- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` opcional para cliente futuro, no reemplaza service role en APIs server.

La URL local quedo apuntando a `https://akmcfooalqgzeeiaoihu.supabase.co`. Las llaves locales actuales deben reemplazarse por llaves reales del mismo proyecto antes de login, CRUD o bootstrap de usuarios.

## Decisiones tecnicas vigentes

- El servidor usa service role para evitar depender de politicas RLS durante esta etapa productiva inicial.
- Si la service role esta ausente o parece placeholder, la app falla con error explicito.
- Offline se modela con cola local en cliente + `ColaSincronizacion` server-side.
- `clientMutationId` es unico para evitar duplicar visitas al reintentar.
- Adjuntos no se guardan en Postgres: solo metadata, bucket, key, URL y checksum.
- `sku` no es unico porque puede representar familia/producto; `serial` y `codigoInterno` mantienen unicidad.

## Riesgos y bugs conocidos

- Las pruebas E2E contra Supabase quedan bloqueadas hasta configurar service role real y ejecutar migraciones.
- Si R2 no esta configurado, la sincronizacion tecnica falla y el item queda en cola local.
- Si RLS se activa mas adelante, hay que reemplazar service role por politicas por rol o endpoints segmentados.

## Pendientes reales y proximos pasos

- Ejecutar migraciones en Supabase del proyecto productivo/staging.
- Cargar al menos un usuario admin con `npm run create:user`.
- Definir permisos por rol en endpoints CRUD.
- Definir politicas de retencion de adjuntos R2.
