# CMCing - Gestión de Servicios Médicos

Aplicación web para gestionar visitas y servicios técnicos de equipos médicos para la empresa CMCing.

## Características

- Dashboard con estadísticas
- Backoffice para gestionar clientes, equipos, servicios, vendedores y técnicos
- Página para crear nuevas visitas/servicios
- Diseño moderno con gradientes y transparencias
- API RESTful con Next.js
- Base de datos PostgreSQL con Prisma ORM

## Tecnologías

- Frontend: Next.js 16, React 19, Tailwind CSS
- Backend: Next.js API Routes
- Base de datos: PostgreSQL
- ORM: Prisma

## Instalación

1. Clona el repositorio
2. Instala dependencias: `npm install`
3. Configura la base de datos PostgreSQL y actualiza `DATABASE_URL` en `.env`
4. Ejecuta las migraciones: `npx prisma migrate dev`
5. Genera el cliente Prisma: `npx prisma generate`
6. Ejecuta el servidor de desarrollo: `npm run dev`

## Uso

- Dashboard: http://localhost:3000
- Backoffice: http://localhost:3000/admin
- Nueva Visita: http://localhost:3000/nueva-visita

## Estructura de la Base de Datos

- Clientes
- Equipos (asociados a clientes)
- Servicios
- Vendedores
- Técnicos
- Visitas (relaciona cliente, equipo, técnico, vendedor, servicio)

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
