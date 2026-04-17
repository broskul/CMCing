# ContextIA - Supabase

## Estado vigente

Ultima actualizacion: 2026-04-17.
Integracion de base de datos productiva (Supabase/Postgres via Prisma) desactivada para modo demo.

## Objetivo del modulo

Definir estado de desacople actual y camino de reconexion cuando se pase a produccion.

## Fuentes de verdad y sistemas externos

- Esquema historico con Prisma:
  - `prisma/schema.prisma`
  - `schema.sql`
- Cliente Prisma existente:
  - `app/lib/prisma.js`

Nota: estos archivos existen, pero no son fuente activa en runtime demo.

## Flujo funcional real (hoy)

- Las APIs de negocio ya no consultan Prisma.
- Todas las rutas usan `app/lib/demo-store.js`.
- `DATABASE_URL` no es requisito para operar demo.

## Decisiones tecnicas vigentes

- Prioridad actual: demo estable y rapida para presentacion.
- Persistencia real se posterga para fase produccion.
- No se elimina Prisma del repo todavia, queda como base de reconexion.

## Riesgos y bugs conocidos

- Deriva funcional: demo y futura produccion pueden separarse si no se controla.
- Si alguien asume persistencia real en demo, puede perder cambios al reiniciar.

## Workarounds actuales

- Contexto explicito en UI indicando modo demo en memoria.
- Documentar este estado en ContextIA para evitar confusiones.

## Plan de reconexion (produccion)

1. Definir feature flag de entorno (`APP_MODE=demo|prod`).
2. Reintroducir repositorio DB para APIs (Prisma/Supabase).
3. Validar migraciones y seed de entorno real.
4. Ejecutar smoke tests CRUD + informes + correo sobre datos reales.
5. Mantener fallback demo para presentaciones.

## Pendientes reales y proximos pasos

- Implementar capa repositorio con interfaz comun (demo vs db).
- Agregar tests de paridad entre implementacion demo y prod.
- Depurar dependencias Prisma no usadas cuando cierre migracion.

## Notas para presentacion y onboarding

- Mensaje oficial actual: "Demo desconectada de Supabase por decision temporal".
- Mensaje oficial futuro: "Produccion se reconecta por feature flag, sin rehacer UI".
