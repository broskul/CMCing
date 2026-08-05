import { createClient } from 'npm:@supabase/supabase-js@2';
import { Webhook } from 'https://esm.sh/standardwebhooks@1.0.0';

type EmailActionType =
  | 'signup'
  | 'invite'
  | 'magiclink'
  | 'recovery'
  | 'email_change'
  | 'reauthentication'
  | 'password_changed_notification'
  | 'email_changed_notification'
  | 'phone_changed_notification'
  | 'identity_linked_notification'
  | 'identity_unlinked_notification'
  | 'mfa_factor_enrolled_notification'
  | 'mfa_factor_unenrolled_notification';

interface HookPayload {
  user: { email?: string; new_email?: string };
  email_data: {
    token?: string;
    token_new?: string;
    token_hash?: string;
    token_hash_new?: string;
    redirect_to?: string;
    site_url?: string;
    email_action_type: EmailActionType;
  };
}

const JSON_HEADERS = { 'Content-Type': 'application/json' };
const MAX_GRAPH_TIMEOUT_MS = 2400;

function requiredEnv(name: string) {
  const value = String(Deno.env.get(name) || '').trim();
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

function escapeHtml(value: unknown) {
  return String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function allowedOrigins() {
  return new Set(String(Deno.env.get('AUTH_ALLOWED_ORIGINS') || 'https://cm-cing.vercel.app,http://localhost:3022')
    .split(',').map((value) => value.trim()).filter(Boolean));
}

function safeOrigin(value: string | undefined, fallback: string) {
  try {
    const url = new URL(value || fallback);
    if (!allowedOrigins().has(url.origin)) return fallback;
    return url.origin;
  } catch {
    return fallback;
  }
}

function safeNextPath(value: string | undefined, fallback = '/') {
  try {
    const url = new URL(value || 'https://cmcing.invalid/');
    if (!allowedOrigins().has(url.origin)) return fallback;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}

function actionCopy(type: EmailActionType) {
  const content: Record<EmailActionType, { subject: string; eyebrow: string; title: string; body: string; action?: string }> = {
    signup: { subject: 'Confirma tu acceso a CMCing 360', eyebrow: 'Activación de cuenta', title: 'Confirma que este correo es tuyo', body: 'Tu acceso al CMMS de CMC fue solicitado. Confirma la dirección para continuar.', action: 'Confirmar acceso' },
    invite: { subject: 'Te invitaron a CMCing 360', eyebrow: 'Invitación', title: 'Tu espacio de trabajo está listo', body: 'Un administrador de CMC habilitó tu acceso. Revisa y acepta la invitación para comenzar.', action: 'Aceptar invitación' },
    magiclink: { subject: 'Código de acceso a CMCing 360', eyebrow: 'Acceso seguro', title: 'Usa este código para ingresar', body: 'Ingresa el código en la pantalla de CMCing. No lo compartas con nadie.' },
    recovery: { subject: 'Recupera tu acceso a CMCing 360', eyebrow: 'Recuperación', title: 'Crea una nueva contraseña', body: 'Solicitaste recuperar tu cuenta. Continúa sólo si reconoces esta solicitud.', action: 'Continuar recuperación' },
    email_change: { subject: 'Confirma el cambio de correo en CMCing 360', eyebrow: 'Seguridad de cuenta', title: 'Confirma el nuevo correo', body: 'Estamos verificando un cambio de correo para tu cuenta.', action: 'Confirmar cambio' },
    reauthentication: { subject: 'Código de reautenticación CMCing 360', eyebrow: 'Verificación', title: 'Confirma que eres tú', body: 'Usa este código para completar la operación sensible. No lo compartas.' },
    password_changed_notification: { subject: 'Tu contraseña de CMCing 360 cambió', eyebrow: 'Aviso de seguridad', title: 'Contraseña actualizada', body: 'La contraseña de tu cuenta fue modificada. Si no fuiste tú, contacta inmediatamente a un administrador.' },
    email_changed_notification: { subject: 'Tu correo de CMCing 360 cambió', eyebrow: 'Aviso de seguridad', title: 'Correo actualizado', body: 'La dirección de correo de tu cuenta fue modificada. Si no fuiste tú, contacta inmediatamente a un administrador.' },
    phone_changed_notification: { subject: 'Tu teléfono de CMCing 360 cambió', eyebrow: 'Aviso de seguridad', title: 'Teléfono actualizado', body: 'El teléfono asociado a tu cuenta fue modificado.' },
    identity_linked_notification: { subject: 'Nuevo método de acceso en CMCing 360', eyebrow: 'Aviso de seguridad', title: 'Identidad vinculada', body: 'Se agregó un nuevo método de acceso a tu cuenta.' },
    identity_unlinked_notification: { subject: 'Método de acceso eliminado en CMCing 360', eyebrow: 'Aviso de seguridad', title: 'Identidad desvinculada', body: 'Se eliminó un método de acceso de tu cuenta.' },
    mfa_factor_enrolled_notification: { subject: 'Nuevo factor de seguridad en CMCing 360', eyebrow: 'Aviso de seguridad', title: 'Factor agregado', body: 'Se agregó un factor de autenticación a tu cuenta.' },
    mfa_factor_unenrolled_notification: { subject: 'Factor de seguridad eliminado en CMCing 360', eyebrow: 'Aviso de seguridad', title: 'Factor eliminado', body: 'Se eliminó un factor de autenticación de tu cuenta.' },
  };
  return content[type] || content.magiclink;
}

function buildEmail(payload: HookPayload, delivery: { token?: string; tokenHash?: string }) {
  const data = payload.email_data;
  const copy = actionCopy(data.email_action_type);
  const defaultOrigin = safeOrigin(data.site_url, 'https://cm-cing.vercel.app');
  const destinationOrigin = safeOrigin(data.redirect_to, defaultOrigin);
  const params = new URLSearchParams({
    type: data.email_action_type,
    next: safeNextPath(data.redirect_to),
  });

  const tokenHash = delivery.tokenHash;
  if (tokenHash) params.set('token_hash', tokenHash);
  const confirmationUrl = `${destinationOrigin}/auth/confirm?${params}`;
  const otp = delivery.token;

  const actionBlock = copy.action && tokenHash
    ? `<a href="${escapeHtml(confirmationUrl)}" style="display:inline-block;margin-top:24px;border-radius:10px;background:#0f2237;padding:13px 20px;color:#fff;text-decoration:none;font-weight:700">${escapeHtml(copy.action)}</a>`
    : otp
      ? `<div style="margin-top:24px;border:1px solid #cbd5e1;border-radius:12px;background:#f8fafc;padding:18px;text-align:center;font-size:28px;font-weight:700;letter-spacing:8px;color:#0f2237">${escapeHtml(otp)}</div>`
      : '';

  const html = `<!doctype html><html lang="es"><body style="margin:0;background:#eef2f6;font-family:Arial,sans-serif;color:#0f172a"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:28px 12px"><tr><td align="center"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;overflow:hidden;border:1px solid #dce3ea;border-radius:18px;background:#fff"><tr><td style="height:7px;background:linear-gradient(90deg,#006cae,#19a974,#f39c4a)"></td></tr><tr><td style="padding:34px"><div style="font-size:13px;font-weight:800;letter-spacing:2px;color:#006cae">CMC · SERVICIO TÉCNICO 360</div><p style="margin:28px 0 0;font-size:12px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:#64748b">${escapeHtml(copy.eyebrow)}</p><h1 style="margin:8px 0 0;font-size:27px;line-height:1.2;color:#0f2237">${escapeHtml(copy.title)}</h1><p style="margin:16px 0 0;font-size:15px;line-height:1.7;color:#475569">${escapeHtml(copy.body)}</p>${actionBlock}<p style="margin:28px 0 0;font-size:12px;line-height:1.6;color:#64748b">Si no solicitaste esta acción, ignora este mensaje y avisa a un administrador de CMC.</p></td></tr><tr><td style="border-top:1px solid #e8edf2;padding:18px 34px;font-size:11px;line-height:1.5;color:#8490a0">Mensaje automático de CMCing 360. Nunca te pediremos compartir códigos o credenciales.</td></tr></table></td></tr></table></body></html>`;
  const text = `${copy.title}\n\n${copy.body}${otp ? `\n\nCódigo: ${otp}` : ''}${copy.action && tokenHash ? `\n\nAbre CMCing para continuar: ${confirmationUrl}` : ''}\n\nSi no solicitaste esta acción, ignora el mensaje.`;
  return { subject: copy.subject, html, text };
}

async function sha256(value: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function claimDelivery(webhookId: string, recipient: string, type: string) {
  const supabase = createClient(requiredEnv('SUPABASE_URL'), requiredEnv('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false } });
  const { data, error } = await supabase.rpc('claim_auth_email_delivery', {
    p_webhook_id: webhookId,
    p_recipient_hash: await sha256(recipient.toLowerCase()),
    p_tipo: type,
  });
  if (error) throw new Error('Email delivery receipt unavailable');
  return { claimed: Boolean(data), claimToken: data as string | null, supabase };
}

async function graphToken() {
  const tenantId = requiredEnv('MSGRAPH_TENANT_ID');
  const body = new URLSearchParams({
    client_id: requiredEnv('MSGRAPH_CLIENT_ID'),
    client_secret: requiredEnv('MSGRAPH_CLIENT_SECRET'),
    scope: 'https://graph.microsoft.com/.default',
    grant_type: 'client_credentials',
  });
  const response = await fetch(`https://login.microsoftonline.com/${encodeURIComponent(tenantId)}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
    signal: AbortSignal.timeout(MAX_GRAPH_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`Graph token failed (${response.status})`);
  const data = await response.json();
  if (!data.access_token) throw new Error('Graph token missing');
  return data.access_token as string;
}

Deno.serve(async (request) => {
  if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  const webhookId = String(request.headers.get('webhook-id') || '').trim();
  try {
    if (!webhookId) throw new Error('Missing webhook id');
    const rawBody = await request.text();
    const secret = requiredEnv('SEND_EMAIL_HOOK_SECRET').replace(/^v1,whsec_/, '');
    const payload = new Webhook(secret).verify(rawBody, {
      'webhook-id': webhookId,
      'webhook-timestamp': String(request.headers.get('webhook-timestamp') || ''),
      'webhook-signature': String(request.headers.get('webhook-signature') || ''),
    }) as HookPayload;
    const emailData = payload.email_data;
    const currentEmail = String(payload.user?.email || '').trim().toLowerCase();
    const newEmail = String(payload.user?.new_email || '').trim().toLowerCase();
    const deliveries = emailData.email_action_type === 'email_change'
      ? (emailData.token_hash_new && newEmail
        ? [
          { id: `${webhookId}:current`, recipient: currentEmail, token: emailData.token, tokenHash: emailData.token_hash_new },
          { id: `${webhookId}:new`, recipient: newEmail, token: emailData.token_new, tokenHash: emailData.token_hash },
        ]
        : [{ id: `${webhookId}:new`, recipient: newEmail || currentEmail, token: emailData.token_new || emailData.token, tokenHash: emailData.token_hash }])
      : [{ id: webhookId, recipient: currentEmail, token: emailData.token, tokenHash: emailData.token_hash }];
    if (deliveries.some((delivery) => !delivery.recipient || !delivery.recipient.includes('@'))) throw new Error('Invalid recipient');

    const claims = await Promise.all(deliveries.map(async (delivery) => ({
      delivery,
      ...(await claimDelivery(delivery.id, delivery.recipient, emailData.email_action_type)),
    })));
    const pending = claims.filter((claim) => claim.claimed);
    if (!pending.length) return new Response('{}', { status: 200, headers: JSON_HEADERS });

    const token = await graphToken();
    const sender = requiredEnv('MSGRAPH_SENDER');
    const results = await Promise.all(pending.map(async ({ delivery, claimToken, supabase }) => {
      const email = buildEmail(payload, delivery);
      const response = await fetch(`https://graph.microsoft.com/v1.0/users/${encodeURIComponent(sender)}/sendMail`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: {
            subject: email.subject,
            body: { contentType: 'HTML', content: email.html },
            toRecipients: [{ emailAddress: { address: delivery.recipient } }],
            internetMessageHeaders: [{ name: 'X-CMCing-Webhook-ID', value: delivery.id }],
          },
          saveToSentItems: true,
        }),
        signal: AbortSignal.timeout(MAX_GRAPH_TIMEOUT_MS),
      });
      if (response.status !== 202) {
        await supabase.rpc('complete_auth_email_delivery', {
          p_webhook_id: delivery.id,
          p_claim_token: claimToken,
          p_estado: 'ERROR',
          p_error_code: `graph_${response.status}`,
        });
        throw new Error(`Graph sendMail failed (${response.status})`);
      }
      // Después de un 202 no se provoca reintento por un fallo aislado de auditoría, evitando duplicados.
      await supabase.rpc('complete_auth_email_delivery', {
        p_webhook_id: delivery.id,
        p_claim_token: claimToken,
        p_estado: 'ACCEPTED',
        p_error_code: null,
      });
      return true;
    }));
    if (!results.every(Boolean)) throw new Error('Incomplete email delivery');
    return new Response('{}', { status: 200, headers: JSON_HEADERS });
  } catch (error) {
    console.error('send-auth-email failed', { webhookId, message: error instanceof Error ? error.message : 'unknown' });
    return new Response(JSON.stringify({ error: { http_code: 503, message: 'Email delivery temporarily unavailable' } }), { status: 503, headers: JSON_HEADERS });
  }
});
