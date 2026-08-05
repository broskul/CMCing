-- =========================================================
-- CMCing CMMS produccion - idempotencia del Send Email Hook
-- Dependencia: 20260804091000_identity_auth_rbac.sql
--
-- Esta tabla nunca guarda destinatario en claro, OTP, token, asunto ni HTML.
-- recipientHash debe ser SHA-256 calculado por la Edge Function.
-- =========================================================

begin;

create table if not exists public."AuthEmailDelivery" (
  "id" bigserial primary key,
  "webhookId" text not null unique,
  "recipientHash" text not null,
  "tipo" text not null,
  "estado" text not null default 'PENDING'
    check ("estado" in ('PENDING', 'CLAIMED', 'ACCEPTED', 'ERROR')),
  "attempts" integer not null default 0 check ("attempts" >= 0),
  "claimToken" uuid,
  "claimedAt" timestamptz,
  "leaseExpiresAt" timestamptz,
  "completedAt" timestamptz,
  "lastErrorCode" text,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now(),
  constraint "AuthEmailDelivery_webhook_id_check"
    check (char_length(btrim("webhookId")) between 8 and 200),
  constraint "AuthEmailDelivery_recipient_hash_check"
    check ("recipientHash" ~ '^[0-9a-f]{64}$'),
  constraint "AuthEmailDelivery_tipo_check"
    check (char_length(btrim("tipo")) between 1 and 80),
  constraint "AuthEmailDelivery_error_code_check"
    check ("lastErrorCode" is null or char_length("lastErrorCode") <= 120),
  constraint "AuthEmailDelivery_state_times_check" check (
    ("estado" = 'PENDING' and "claimToken" is null and "claimedAt" is null and "completedAt" is null)
    or ("estado" = 'CLAIMED' and "claimToken" is not null and "claimedAt" is not null and "leaseExpiresAt" is not null and "completedAt" is null)
    or ("estado" in ('ACCEPTED', 'ERROR') and "claimToken" is not null and "completedAt" is not null)
  )
);

-- Hace la migracion segura frente a una ejecucion parcial de un borrador
-- anterior del hook, donde aun no existian lease ni fencing token.
alter table public."AuthEmailDelivery"
  add column if not exists "claimToken" uuid,
  add column if not exists "leaseExpiresAt" timestamptz;

alter table public."AuthEmailDelivery"
  drop constraint if exists "AuthEmailDelivery_state_times_check";

-- Si existieran receipts del borrador sin token, se les asigna uno solo para
-- preservar su evidencia. Los CLAIMED quedan con lease vencido y por tanto
-- recuperables; nunca se reenvia automaticamente un ACCEPTED.
update public."AuthEmailDelivery"
set
  "claimToken" = case
    when "estado" in ('CLAIMED', 'ACCEPTED', 'ERROR')
      then coalesce("claimToken", gen_random_uuid())
    else null
  end,
  "claimedAt" = case
    when "estado" = 'PENDING' then null
    when "estado" = 'CLAIMED' then coalesce("claimedAt", "updatedAt", "createdAt", now())
    else "claimedAt"
  end,
  "leaseExpiresAt" = case
    when "estado" = 'CLAIMED' then coalesce("leaseExpiresAt", now() - interval '1 second')
    else null
  end,
  "completedAt" = case
    when "estado" in ('ACCEPTED', 'ERROR')
      then coalesce("completedAt", "updatedAt", "createdAt", now())
    else null
  end;

alter table public."AuthEmailDelivery"
  add constraint "AuthEmailDelivery_state_times_check" check (
    ("estado" = 'PENDING' and "claimToken" is null and "claimedAt" is null and "completedAt" is null)
    or ("estado" = 'CLAIMED' and "claimToken" is not null and "claimedAt" is not null and "leaseExpiresAt" is not null and "completedAt" is null)
    or ("estado" in ('ACCEPTED', 'ERROR') and "claimToken" is not null and "completedAt" is not null)
  );

create index if not exists "AuthEmailDelivery_status_lease_idx"
  on public."AuthEmailDelivery"("estado", "leaseExpiresAt");
create index if not exists "AuthEmailDelivery_created_idx"
  on public."AuthEmailDelivery"("createdAt" desc);

drop trigger if exists trg_auth_email_delivery_updated_at on public."AuthEmailDelivery";
create trigger trg_auth_email_delivery_updated_at
before update on public."AuthEmailDelivery"
for each row execute function public.set_updated_at();

alter table public."AuthEmailDelivery" enable row level security;
alter table public."AuthEmailDelivery" force row level security;

drop policy if exists cmc_auth_email_superadmin_read on public."AuthEmailDelivery";
create policy cmc_auth_email_superadmin_read
on public."AuthEmailDelivery"
for select
to authenticated
using (public.cmc_has_any_role(array['SUPERADMIN']));

revoke all on table public."AuthEmailDelivery" from public, anon, authenticated;
grant select on table public."AuthEmailDelivery" to authenticated;
grant all on table public."AuthEmailDelivery" to service_role;
grant usage, select on sequence public."AuthEmailDelivery_id_seq" to service_role;

-- Claim atomico con lease de cinco minutos y fencing token. Devuelve UUID si
-- adquirio el claim o NULL si otro worker/receipt aceptado ya lo posee. El UUID
-- debe conservarse y enviarse a complete_auth_email_delivery.
-- DROP explicito porque PostgreSQL no permite cambiar con CREATE OR REPLACE el
-- retorno boolean de un borrador anterior a UUID.
drop function if exists public.complete_auth_email_delivery(text, text, text);
drop function if exists public.complete_auth_email_delivery(text, uuid, text, text);
drop function if exists public.claim_auth_email_delivery(text, text, text);

create or replace function public.claim_auth_email_delivery(
  p_webhook_id text,
  p_recipient_hash text,
  p_tipo text
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $function$
declare
  v_claim_token uuid;
  v_existing public."AuthEmailDelivery"%rowtype;
begin
  if auth.role() <> 'service_role' then
    raise exception 'RPC reservado al Send Email Hook con service_role.' using errcode = '42501';
  end if;
  if char_length(btrim(coalesce(p_webhook_id, ''))) not between 8 and 200
     or lower(coalesce(p_recipient_hash, '')) !~ '^[0-9a-f]{64}$'
     or char_length(btrim(coalesce(p_tipo, ''))) not between 1 and 80 then
    raise exception 'Parametros de delivery invalidos.' using errcode = '22023';
  end if;

  insert into public."AuthEmailDelivery" (
    "webhookId", "recipientHash", "tipo", "estado", "attempts", "claimToken",
    "claimedAt", "leaseExpiresAt"
  )
  values (
    btrim(p_webhook_id), lower(p_recipient_hash), btrim(p_tipo), 'CLAIMED', 1, gen_random_uuid(),
    now(), now() + interval '5 minutes'
  )
  on conflict ("webhookId") do update
  set
    "estado" = 'CLAIMED',
    "attempts" = public."AuthEmailDelivery"."attempts" + 1,
    "claimToken" = gen_random_uuid(),
    "claimedAt" = now(),
    "leaseExpiresAt" = now() + interval '5 minutes',
    "completedAt" = null,
    "lastErrorCode" = null,
    "updatedAt" = now()
  where public."AuthEmailDelivery"."recipientHash" = excluded."recipientHash"
    and public."AuthEmailDelivery"."tipo" = excluded."tipo"
    and (
      public."AuthEmailDelivery"."estado" in ('PENDING', 'ERROR')
      or (
        public."AuthEmailDelivery"."estado" = 'CLAIMED'
        and public."AuthEmailDelivery"."leaseExpiresAt" <= now()
      )
    )
  returning "claimToken" into v_claim_token;

  if v_claim_token is not null then
    return v_claim_token;
  end if;

  select * into v_existing
  from public."AuthEmailDelivery"
  where "webhookId" = btrim(p_webhook_id);

  if found and (
    v_existing."recipientHash" <> lower(p_recipient_hash)
    or v_existing."tipo" <> btrim(p_tipo)
  ) then
    raise exception 'webhookId ya existe con otro recipientHash o tipo.' using errcode = '23505';
  end if;

  return null;
end;
$function$;

create or replace function public.complete_auth_email_delivery(
  p_webhook_id text,
  p_claim_token uuid,
  p_estado text,
  p_error_code text default null
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $function$
begin
  if auth.role() <> 'service_role' then
    raise exception 'RPC reservado al Send Email Hook con service_role.' using errcode = '42501';
  end if;
  if p_estado not in ('ACCEPTED', 'ERROR') then
    raise exception 'El estado final debe ser ACCEPTED o ERROR.' using errcode = '22023';
  end if;
  if p_claim_token is null then
    raise exception 'claim_token es obligatorio.' using errcode = '22023';
  end if;
  if p_error_code is not null and char_length(p_error_code) > 120 then
    raise exception 'error_code excede 120 caracteres.' using errcode = '22023';
  end if;

  update public."AuthEmailDelivery"
  set
    "estado" = p_estado,
    "completedAt" = now(),
    "leaseExpiresAt" = null,
    "lastErrorCode" = case when p_estado = 'ERROR' then nullif(btrim(p_error_code), '') else null end,
    "updatedAt" = now()
  where "webhookId" = btrim(p_webhook_id)
    and "estado" = 'CLAIMED'
    and "claimToken" = p_claim_token
    and "leaseExpiresAt" > now();

  return found;
end;
$function$;

revoke execute on function public.claim_auth_email_delivery(text, text, text)
  from public, anon, authenticated;
revoke execute on function public.complete_auth_email_delivery(text, uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.claim_auth_email_delivery(text, text, text)
  to service_role;
grant execute on function public.complete_auth_email_delivery(text, uuid, text, text)
  to service_role;

comment on table public."AuthEmailDelivery" is
  'Idempotencia minima de Auth Send Email Hook; prohibido guardar email plano, OTP, token o HTML.';

commit;
