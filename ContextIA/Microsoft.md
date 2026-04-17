# ContextIA - Microsoft

## Estado vigente

Ultima actualizacion: 2026-04-17.
Integracion de correo por Microsoft Graph activa a nivel de codigo y pendiente de credenciales completas en `.env.local`.

## Objetivo del modulo

Enviar informes CMC en formato HTML con branding y PDF adjunto, a destinatarios internos y cliente final.

## Fuentes de verdad y sistemas externos

- Endpoint Graph OAuth token:
  - `https://login.microsoftonline.com/{tenant}/oauth2/v2.0/token`
- Endpoint Graph envio correo:
  - `https://graph.microsoft.com/v1.0/users/{sender}/sendMail`
- Implementacion local:
  - `app/lib/reporting.js`
  - `app/api/informes/email/route.js`

## Configuracion vigente

Variables requeridas:

- `MSGRAPH_TENANT_ID`
- `MSGRAPH_CLIENT_ID`
- `MSGRAPH_CLIENT_SECRET`
- `MSGRAPH_SENDER`

Actualmente cargadas en `.env.local`:

- `MSGRAPH_TENANT_ID`: seteado
- `MSGRAPH_CLIENT_ID`: seteado
- `MSGRAPH_CLIENT_SECRET`: pendiente
- `MSGRAPH_SENDER`: pendiente

## Flujo funcional real

1. Backend solicita token con `client_credentials`.
2. Backend arma mensaje HTML con:
- logo inline (`cid:cmcing-logo`)
- tabla/resumen
- tarjetas con imagenes de producto
3. Backend adjunta PDF generado del informe.
4. Backend llama `sendMail` y devuelve resultado al front.

## Decisiones tecnicas vigentes

- Uso de permisos de aplicacion (app-only), no delegated flow.
- Mismo endpoint de envio para ambos informes (`visitas` y `facturacion`).
- Branding unificado (logo + estilo HTML) para todos los correos.

## Riesgos y bugs conocidos

- Si faltan permisos `Mail.Send` de aplicacion o consentimiento admin, fallara el envio.
- Si `MSGRAPH_SENDER` no corresponde a mailbox valida/autorizada, Graph responde error.
- Algunos clientes de correo pueden bloquear imagenes inline por politicas del destinatario.

## Workarounds actuales

- El endpoint retorna mensaje de error textual de Graph para diagnostico rapido.
- Se puede probar primero con destinatarios internos.

## Pendientes reales y proximos pasos

- Completar `MSGRAPH_CLIENT_SECRET` y `MSGRAPH_SENDER`.
- Probar envio E2E con cuenta interna de validacion.
- Definir trazabilidad minima de envio (log de exito/fallo).

## Notas para presentacion y onboarding

- El sistema ya esta preparado para "correo corporativo con adjunto" sin usar SMTP manual.
- La seguridad queda centralizada en Entra ID + Graph API.
