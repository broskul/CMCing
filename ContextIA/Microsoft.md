# ContextIA - Microsoft

## Estado vigente

Ultima actualizacion: 2026-05-29.
Microsoft Graph se usa para enviar informes y cotizaciones con correo HTML y PDF adjunto.

## Objetivo del modulo

Enviar comunicaciones corporativas desde mailbox CMCing usando Graph API app-only.

## Fuentes de verdad y sistemas externos

- OAuth token:
  - `https://login.microsoftonline.com/{tenant}/oauth2/v2.0/token`
- Envio correo:
  - `https://graph.microsoft.com/v1.0/users/{sender}/sendMail`
- Implementacion:
  - `app/lib/reporting.js`
  - `app/api/informes/email/route.js`
  - `app/api/cotizaciones/[id]/email/route.js`

## Variables requeridas

- `MSGRAPH_TENANT_ID`
- `MSGRAPH_CLIENT_ID`
- `MSGRAPH_CLIENT_SECRET`
- `MSGRAPH_SENDER`

Variables R2 relacionadas con adjuntos tecnicos, tambien en `.env.local`:

- `R2_ACCOUNT_ID` o `R2_ENDPOINT`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`
- `R2_BUCKET`
- `R2_PUBLIC_BASE_URL` opcional
- `R2_REGION` opcional

Tambien se aceptan los nombres actuales de Cloudflare:

- `CLOUDFLARE_S3_URL`
- `CLOUDFLARE_R2_ACCESS_KEY_ID`
- `CLOUDFLARE_R2_SECRET_ACCESS_KEY`
- `CLOUDFLARE_R2_BUCKET`

## Flujo funcional real

1. Backend pide token con `client_credentials`.
2. Backend arma HTML con logo inline.
3. Backend genera PDF:
   - informes de visitas/facturacion,
   - cotizaciones.
4. Backend adjunta PDF y llama `sendMail`.

## Decisiones tecnicas vigentes

- No se usa SMTP.
- No se usa Graph para login.
- Correos HTML mantienen branding y adjunto PDF.
- Cotizaciones comparten helpers de reporting.

## Riesgos y bugs conocidos

- QA 2026-05-29 envio informes de visitas y facturacion por Graph a `carlos@prof3sional.com` correctamente.
- Requiere permiso `Mail.Send` de aplicacion y consentimiento admin.
- Algunos clientes pueden bloquear imagenes inline.

## Pendientes reales y proximos pasos

- Probar envio real de cotizacion cuando RLS permita crear `Cotizacion`.
- Persistir bitacora de correos enviados.
