# ContextIA - Demo

## Estado vigente

Ultima actualizacion: 2026-05-29.
El modo demo fue retirado del runtime. La aplicacion queda en modo produccion, con APIs conectadas directo a Supabase.

## Objetivo del modulo

Registrar la decision de no volver a depender de datos en memoria para flujos operativos o comerciales.

## Fuentes de verdad y sistemas externos

- Datos runtime:
  - `app/lib/supabase-store.js`
  - Supabase/Postgres
- Shell y navegacion:
  - `app/components/AppShell.js`
  - `app/components/AppSidebar.js`
  - `app/layout.js`
- Offline local:
  - `app/lib/offline-queue.js`
  - `public/sw.js`
- R2:
  - `app/lib/r2.js`
  - `app/api/tecnico/sync/route.js`

## Flujo funcional real

- Login protege paginas y APIs usando usuarios `Usuario` en Supabase.
- Sidebar izquierda organiza los modulos comerciales, operativos, personas e informes.
- CRUD maestro sigue disponible en `/admin?modulo=...`, con persistencia real.
- Cotizaciones permiten crear, exportar PDF y enviar por MS Graph.
- Equipos permite buscar por SKU, serial, nombre y revisar hoja de vida.
- Calendario lista visitas agrupadas por dia.
- App tecnica `/tecnico` guarda servicios en IndexedDB si no hay senal.
- Al volver la conexion, la cola intenta sincronizar contra `/api/tecnico/sync`.
- `/api/tecnico/sync` recibe `clientMutationId`, lo persiste en `Visita.clienteMutationId` para idempotencia, sube firma/selfie/evidencias a R2 y elimina duplicados al reintentar.
- En mobile y tablet, la navegacion cambia a topbar con drawer lateral.

## Decisiones tecnicas vigentes

- No se muestra contexto tecnico en la UI; esta informacion queda en `ContextIA`.
- `app/lib/demo-store.js` fue eliminado.
- La app tecnica captura adjuntos, firma dibujada, texto de firma y selfie frontal al firmar.
- QA 2026-05-29 valido la app tecnica con Cristian Manzor: firma completa, selfie frontal simulada, foto/PDF de evidencia, cola servidor `SINCRONIZADO` y segundo envio respondio `duplicate`.
- Service worker cachea recursos GET visitados para mejorar uso offline despues de la primera carga, pero los assets `/_next/` y las APIs `/api/*` se resuelven network-first para evitar CSS/JS o datos obsoletos despues de cambios de UI/backend.
- `app/offline-register.js` fuerza `registration.update()` y recarga al cambiar el controller para activar rapido nuevas versiones de cache.
- Breakpoints vigentes: sidebar fijo en escritorio, drawer off-canvas bajo 900px, tablas de maestros convertidas a fichas bajo 760px, paddings reducidos bajo 720px/520px y tablas secundarias con scroll horizontal controlado.

## Riesgos y bugs conocidos

- IndexedDB local depende del dispositivo/navegador del tecnico.
- La sincronizacion real requiere variables R2 completas.
- Sin `R2_PUBLIC_BASE_URL`, los adjuntos quedan correctamente subidos pero con URL interna `r2://...`; para ver firma/selfie en informes se necesita URL publica o endpoint firmado.
- Sin llaves reales de Supabase no se puede iniciar sesion ni probar CRUD.

## Pendientes reales y proximos pasos

- Agregar indicador de conflictos si un maestro cambia mientras hay trabajos offline.
- Agregar pruebas E2E de la app tecnica en modo offline/online.
