# CMCing CMMS

Aplicacion web para operar un CMMS de servicios tecnicos: clientes, contactos, direcciones, equipos por numero de serie, empleados, mantenciones, incidentes, visitas, informes y adjuntos fotograficos.

## Stack

- Next.js 16
- React 19
- Prisma ORM
- Supabase Postgres
- Cloudflare R2 para imagenes de visitas
- Microsoft Graph para envio de informes por correo

## Puesta en marcha

1. Completa `.env.local`.
2. Ejecuta `npm install`.
3. Aplica el SQL de `schema.sql` en Supabase o usa Prisma Migrate.
4. Genera Prisma Client con `npx prisma generate`.
5. Opcional: carga datos de prueba con `npm run seed`.
6. Ejecuta `npm run dev`.

## Modulos

- `/` dashboard CMMS
- `/admin` backoffice de clientes, equipos, empleados, servicios, mantenciones, incidentes y visitas
- `/nueva-visita` creacion de visita con imagenes hacia R2
- `/informes/visitas` informe operativo y PDF tecnico
- `/informes/facturacion` informe de servicios/facturacion
