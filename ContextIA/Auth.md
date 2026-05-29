# ContextIA - Auth

## Estado vigente

Ultima actualizacion: 2026-05-29.
La autenticacion directa usa usuarios reales en Supabase. Ya no existen credenciales locales ni usuarios bootstrap embebidos en runtime. Login real validado contra `Usuario`.

## Objetivo del modulo

Permitir acceso controlado con usuario y contrasena sin depender de Microsoft/Entra para login de la aplicacion. Microsoft Graph queda solo para envio de correos.

## Fuentes de verdad y sistemas externos

- Runtime actual:
  - `app/lib/auth.js`
  - `app/api/auth/login/route.js`
  - `app/api/auth/logout/route.js`
  - `app/api/auth/session/route.js`
  - `middleware.js`
- Supabase:
  - tabla `Usuario`
  - tabla `Tecnico` para vinculo opcional `Usuario.tecnicoId`
- Bootstrap operativo:
  - `scripts/create-user.mjs`

## Flujo funcional real

1. Usuario ingresa en `/login` con email y contrasena.
2. Backend busca el email en `Usuario` usando Supabase server-side.
3. Backend valida `passwordHash` con formato `scrypt:salt:hash`.
4. Se crea cookie HTTP-only `cmcing_session`.
5. La cookie contiene una sesion stateless firmada con HMAC y expiracion de 12 horas.
6. `middleware.js` exige cookie firmada y vigente para paginas y APIs internas.
7. Sidebar permite cerrar sesion con `POST /api/auth/logout`.

## Configuracion vigente

Variables requeridas:

- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY` o `NEXT_PUBLIC_SUPABASE_ANON_KEY` con permisos suficientes.

Variable recomendada:

- `APP_SESSION_SECRET`

Si `APP_SESSION_SECRET` no existe, la firma de sesion usa `SUPABASE_SERVICE_ROLE_KEY`, `MSGRAPH_CLIENT_SECRET` o la llave anon como respaldo.

Para crear o actualizar un usuario real:

```bash
npm run create:user -- --email correo@dominio.cl --password "clave-segura" --name "Nombre Usuario" --role ADMIN
```

Para una cuenta tecnica asociada:

```bash
npm run create:user -- --email tecnico@dominio.cl --password "clave-segura" --name "Nombre Tecnico" --role TECNICO --tecnico-id 1
```

## Decisiones tecnicas vigentes

- Auth directa por usuario/contrasena, no SSO.
- Passwords se comparan con hash `scrypt` y `timingSafeEqual`.
- No se aceptan credenciales por defecto en produccion.
- `Usuario.tecnicoId` vincula cuentas tecnicas con el maestro `Tecnico`.
- Logout borra la cookie; las sesiones son stateless y expiran por timestamp interno.

## Riesgos y bugs conocidos

- La autorizacion fina por rol aun no esta implementada; hoy una sesion valida entra a todos los endpoints internos.
- QA 2026-05-29: `Usuario` ya aparece en PostgREST, `npm run create:user` funciona y login real fue validado con cookie HTTP-only.
- Si la llave server configurada no corresponde al proyecto o no tiene permisos sobre `Usuario`, login y bootstrap fallan.
- Falta pantalla administrativa para cambio de contrasena.

## Pendientes reales y proximos pasos

- Agregar cambio de contrasena y administracion de usuarios.
- Definir permisos por rol en cada endpoint CRUD.
- Migrar `middleware.js` a la convencion `proxy` de Next cuando se haga mantencion tecnica.
