# ContextIA - Demo

## Estado vigente

Ultima actualizacion: 2026-04-17.
Aplicacion en modo demo, desconectada de base de datos productiva y operando con store en memoria.

## Objetivo del modulo

Permitir demostracion comercial funcional completa (CRUD de maestros, visitas, informes y correo) sin dependencia de Supabase/DB productiva.

## Fuentes de verdad y sistemas externos

- Store en memoria global:
  - `app/lib/demo-store.js`
- Front principal y navegacion:
  - `app/page.js`
  - `app/layout.js`
- Assets demo:
  - `public/brand/logo-cmcing.png`
  - `public/productos/termociclador-eq-bm-68-ref.png`
  - `public/productos/gabinete-a2-eq-mo-86-ref.jpg`

## Flujo funcional real

- CRUD maestros y visitas usa APIs demo (`/api/*`) contra `demo-store`.
- Cambios se reflejan en pantalla inmediatamente.
- Los cambios NO persisten al reiniciar servidor/proceso.
- Dashboard muestra resumen de entidades e imagenes de productos.

## Archivos clave

- `app/lib/demo-store.js`
- `app/api/clientes/*`
- `app/api/equipos/*`
- `app/api/servicios/*`
- `app/api/vendedores/*`
- `app/api/tecnicos/*`
- `app/api/visitas/*`
- `app/api/dashboard/route.js`
- `app/admin/page.js`
- `app/page.js`

## Decisiones tecnicas vigentes

- Se removio acceso runtime a Prisma para operaciones de app.
- Se conserva semilla demo en memoria con relaciones cliente/equipo/visita/servicio.
- Se incluyo campo `imagenUrl` en equipos para informes y correos.
- Nueva Visita soporta seleccion multiple de equipos por visita usando `equipoIds` (manteniendo `equipoId` como compatibilidad para pantallas existentes).

## Riesgos y bugs conocidos

- Reinicio de servidor limpia estado demo.
- Multiples instancias de app no comparten estado.
- No hay auditoria de cambios en modo demo.

## Workarounds actuales

- Re-semilla automatica al levantar la app.
- Datos de ejemplo cubren escenario comercial base.

## Pendientes reales y proximos pasos

- Agregar boton "reset demo" para resembrar sin reiniciar.
- Agregar snapshot opcional en archivo local para demos largas.
- Preparar feature flag para alternar demo vs produccion.

## Notas para presentacion y onboarding

- Aclarar al cliente que es entorno demostrativo sin persistencia.
- Demostrar cadena completa: editar maestro -> crear visita -> emitir informe -> enviar correo.
