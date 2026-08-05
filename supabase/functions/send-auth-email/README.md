# Send Email Auth Hook · CMCing

Edge Function que reemplaza el SMTP de Supabase Auth y entrega correos CMC mediante Microsoft Graph.

Estado al 2026-08-04: una invitación real devolvió `200`; Microsoft Graph aceptó el envío con `202` y `AuthEmailDelivery` registró tipo `invite`, estado `ACCEPTED`, `attempts = 1`, sin error. El usuario invitado aún no confirmó la cuenta; falta aceptar la invitación y validar el primer login.

Secretos requeridos en Supabase Edge Functions:

- `SEND_EMAIL_HOOK_SECRET`
- `MSGRAPH_TENANT_ID`
- `MSGRAPH_CLIENT_ID`
- `MSGRAPH_CLIENT_SECRET`
- `MSGRAPH_SENDER`
- `AUTH_ALLOWED_ORIGINS`

Supabase inyecta `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY`. No registrar cuerpos, OTP, hashes de token ni HTML.

Desplegar con verificación JWT desactivada únicamente porque la autenticidad se valida con Standard Webhooks:

```powershell
supabase functions deploy send-auth-email --project-ref vgfoubwwxqkrtpymzbat --no-verify-jwt
```

El hook está habilitado. `claim_auth_email_delivery` devuelve un token de claim que debe entregarse a `complete_auth_email_delivery`; no se debe completar un evento por `webhookId` sin ese fencing. `202 Accepted` de Graph no debe documentarse como entrega al buzón ni como usuario confirmado.
