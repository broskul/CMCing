# ContextIA - Microsoft

Última actualización: 2026-08-04.

## Dos integraciones separadas

CMCing usa Microsoft para identidad y para correo, con aplicaciones y responsabilidades distintas:

- **Microsoft Entra ID / Auth CMC:** proveedor Azure de Supabase para SSO de cuentas `@cmcing.cl`.
- **Microsoft Graph / Mailing CMC:** credenciales app-only para enviar correos corporativos desde el mailbox autorizado.

No reutilizar ni mezclar client IDs, secretos o permisos entre ambas integraciones.

## SSO con Microsoft

1. `/api/auth/microsoft` inicia OAuth PKCE mediante Supabase Auth.
2. Microsoft vuelve al callback de Supabase y luego a `/auth/callback` de CMCing.
3. El hook `Before User Created` aplica la allowlist de `AuthAccessRule` antes de crear una identidad.
4. `Usuario.authUserId` vincula la identidad y PostgreSQL resuelve rol/estado.

Estado verificado: la redirect URI de Entra, el proveedor Azure, los redirects Supabase y el hook de creación están configurados/activos. Falta una prueba humana E2E con `cmanzor@cmcing.cl`, incluido cualquier MFA o consentimiento exigido por el tenant.

## Correo con Graph

Las rutas existentes de informes/cotizaciones y la nueva Edge Function de Auth obtienen token con `client_credentials` y llaman a `users/{sender}/sendMail`.

Variables server-side:

- `MSGRAPH_TENANT_ID`
- `MSGRAPH_CLIENT_ID`
- `MSGRAPH_CLIENT_SECRET`
- `MSGRAPH_SENDER`

La aplicación Graph necesita `Mail.Send` de aplicación con consentimiento administrativo. No registrar tokens, cuerpos de Auth, OTP, hashes ni HTML sensible.

## Send Email Hook de Supabase Auth

- `supabase/functions/send-auth-email/index.ts` valida la firma Standard Webhooks antes de procesar el evento.
- `claim_auth_email_delivery` reserva el evento con un token de claim; `complete_auth_email_delivery` sólo permite completarlo con ese token para evitar carreras y duplicados.
- El HTML usa branding CMC y restringe los orígenes de enlaces mediante `AUTH_ALLOWED_ORIGINS`.
- La migración, el ledger, la Edge Function desplegada, los secretos Graph/hook y la conexión HTTPS del Send Email Hook están activos en Supabase.
- La invitación real de Carlos devolvió `200`; Graph aceptó el mensaje con `202` y el ledger registró `invite`, `ACCEPTED`, `attempts = 1`, sin error.

El hook ya está habilitado. La función se despliega con `--no-verify-jwt` únicamente porque la autenticidad se verifica mediante Standard Webhooks; cualquier redespliegue debe conservar esa validación y sus secretos server-side. `202 Accepted` valida la recepción de la solicitud por Graph, no la entrega al buzón ni la aceptación de la invitación.

## Archivos clave

- `app/api/auth/microsoft/route.js` y `app/auth/callback/route.js`: SSO.
- `app/lib/reporting.js`: helpers de correo/informes heredados.
- `app/api/informes/email/route.js` y `app/api/cotizaciones/[id]/email/route.js`: correos operativos.
- `supabase/functions/send-auth-email/`: correo de autenticación.
- `supabase/migrations/20260804092000_auth_email_delivery.sql`: ledger y fencing.

## Pendientes

- Validar SSO real, rol resultante, logout y rechazo de una identidad no autorizada.
- Confirmar que Carlos recibe y acepta la invitación, y validar su primer login; el hook/ledger ya están verificados hasta la aceptación de Graph.
- Persistir bitácora de correos operativos cuando el documento emitido requiera trazabilidad completa.
