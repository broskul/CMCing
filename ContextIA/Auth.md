# ContextIA - Identidad y autorización

Última actualización: 2026-08-05.

## Fuente de verdad

Supabase Auth administra la identidad y `Usuario` administra autorización, rol y estado activo. `auth.users.id` se vincula de forma única con `Usuario.authUserId`; el runtime no confía en roles guardados en `user_metadata` ni en valores enviados por el cliente.

Se retiró del flujo vigente la cookie HMAC `cmcing_session`, el login por hash local y los usuarios demo. `passwordHash` sólo se conserva nullable por compatibilidad histórica y no debe recibir contraseñas nuevas.

## Política de acceso

- El dominio `@cmcing.cl` ingresa con Microsoft Entra ID mediante el proveedor Azure de Supabase.
- `cmanzor@cmcing.cl` es el superadmin corporativo previsto por Azure.
- `carlos@prof3sional.com` es el único superadmin externo permitido por email de Supabase; esto no autoriza todo el dominio `prof3sional.com`.
- Cualquier identidad Supabase ya existente que pertenezca al dominio o excepción autorizados puede solicitar una contraseña desde el login. El acceso efectivo sigue requiriendo un perfil `Usuario` CMCing activo. Para cuentas corporativas, Supabase enlaza el método email/password a la misma identidad Azure; Microsoft 365 sigue disponible como alternativa de ingreso.
- `AuthAccessRule` conserva las reglas del servidor. Una regla EMAIL exacta prevalece sobre una regla DOMAIN.
- El hook `public.cmc_before_user_created_hook` rechaza proveedor o identidad no permitidos y asigna el rol inicial desde la base de datos.

## Estado externo verificado

- Proveedor Azure de Supabase: activo.
- Redirect de Entra ID a Supabase: configurado.
- URL de sitio y redirects productivos/locales de Supabase: configurados.
- Hook `Before User Created` conectado a `public.cmc_before_user_created_hook`: activo.
- Login publicado en `https://cm-cing.vercel.app/login`: verificado sin errores de consola; el botón Microsoft llega al tenant/client ID correctos y conserva el callback productivo por Supabase.
- Carlos ya existe como usuario invitado: su perfil `Usuario` es `SUPERADMIN`, usa provider `email` y quedó `authLinked = true`; la cuenta aún no está confirmada.
- La activación/login de Carlos depende de que acepte la invitación. El primer ingreso Azure de `cmanzor@cmcing.cl` y la prueba de una cuenta rechazada siguen pendientes.

## Flujo de runtime

1. `/login` inicia Microsoft SSO o el acceso por email/contraseña. Los campos obligatorios se señalan con asterisco rojo; el resto se interpreta como opcional.
2. `/api/auth/microsoft` inicia OAuth PKCE y `/auth/callback` intercambia el código por una sesión Supabase.
3. Los enlaces de correo llegan a `/auth/confirm`; una acción humana ejecuta `verifyOtp` para evitar que un escáner consuma el enlace automáticamente.
4. La recuperación solicita `POST /api/auth/password-reset`, que responde de forma no enumerativa para todas las identidades Supabase existentes dentro del dominio o excepción autorizados. Tras confirmar un enlace `recovery`, `/auth/update-password` exige una contraseña de al menos 12 caracteres con minúscula, mayúscula, número y símbolo; valida el perfil `Usuario` activo, actualiza mediante la sesión de recuperación, enlaza el método email/password si la identidad venía de Azure y cierra la sesión de recuperación.
5. `proxy.js` refresca la sesión, resuelve `Usuario` y aplica las fronteras globales de ruta.
6. Cada API sensible vuelve a validar sesión y rol. En actividades, también valida que un técnico sólo opere sobre asignaciones propias.
7. PostgreSQL refuerza la misma frontera mediante RLS y helpers `cmc_can_access_*`.

## Roles

- `SUPERADMIN`: control total, reglas de acceso y desbloqueo.
- `ADMIN`: administración y desbloqueo auditado.
- `OPERACIONES`: maestros, OT y asignaciones; no desbloquea actividades cerradas.
- `TECNICO`: su jornada, actividades asignadas, notas, matrices, imágenes y cierre.
- `LECTURA`: consulta sin mutaciones.

## Superadmin externo

`npm run create:user` sirve únicamente para aprovisionar o rotar `carlos@prof3sional.com` mediante Supabase Admin Auth. Exige una llave privada del servidor y una contraseña de al menos 12 caracteres, vincula `Usuario.authUserId` y no almacena hash local ni rol en metadata. No se usa para cuentas `@cmcing.cl`.

## Correo de autenticación

La Edge Function `supabase/functions/send-auth-email` implementa un Send Email Hook con validación Standard Webhooks y envío por Microsoft Graph. Incluye plantillas CMC para recuperación y aviso de cambio de contraseña. El secreto remoto `AUTH_ALLOWED_ORIGINS` permite únicamente producción y `http://localhost:3022`; la función fue desplegada con esa frontera el 2026-08-05. En la invitación real de Carlos, Supabase respondió `200`, Graph aceptó el envío con `202` y `AuthEmailDelivery` registró tipo `invite`, estado `ACCEPTED`, `attempts = 1` y ningún error. Esta evidencia valida el pipeline hasta la aceptación de Graph, no la entrega final al buzón ni la confirmación: Carlos todavía debe aceptar el enlace e iniciar sesión.

## Archivos clave

- `app/lib/supabase-auth-server.js`: cliente SSR asociado a la cookie del usuario.
- `app/lib/auth.js`: resolución y vinculación del perfil.
- `app/api/auth/password-reset/route.js`: solicitud de recuperación no enumerativa para identidades Supabase existentes dentro del alcance CMCing.
- `app/api/auth/password/route.js` y `app/auth/update-password/page.js`: actualización validada mediante sesión de recuperación, sin persistir contraseñas.
- `app/lib/request-auth.js`: guardas de APIs.
- `app/lib/activity-access.js`: propiedad de actividad y autorización por rol.
- `proxy.js`: sesión y fronteras globales.
- `supabase/migrations/20260804091000_identity_auth_rbac.sql`: allowlist, hooks y helpers.
- `supabase/migrations/20260804104000_rls_views_security.sql`: políticas RLS finales.
- `scripts/create-user.mjs`: bootstrap restringido del superadmin externo.

## Redirects locales

La configuración versionada y el panel de Supabase permiten `http://localhost:3022/auth/callback` y `http://localhost:3022/auth/confirm`. Producción conserva el origen `https://cm-cing.vercel.app`; cualquier cambio del panel de Supabase debe añadir redirects, nunca sustituir el origen productivo por el local.

## Límite de validación

La configuración de proveedor, hook, correo hasta aceptación de Graph, rutas públicas y redirección SSO están verificadas. Falta QA E2E con usuarios reales: aceptación/login de Carlos, primer ingreso de `cmanzor@cmcing.cl`, MFA/consentimiento si Entra lo exige y rechazo de una identidad no permitida. No documentar la autenticación como completamente validada hasta cerrar esos recorridos.
