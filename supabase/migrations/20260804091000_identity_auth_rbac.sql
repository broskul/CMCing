-- =========================================================
-- CMCing CMMS produccion - identidad Supabase y RBAC (paso 2/2)
-- Dependencia: 20260804090000_identity_role_enum.sql
--
-- Principios:
--   * auth.users es la identidad canonica; public."Usuario" es el perfil CMMS.
--   * no se crean contrasenas locales para SSO.
--   * el alta se limita en Before User Created Hook por email/dominio/proveedor.
--   * las funciones de autorizacion resuelven al actor exclusivamente con
--     auth.uid(); ningun RPC confia en un usuario recibido desde el cliente.
-- =========================================================

begin;

create extension if not exists pgcrypto with schema extensions;

-- El passwordHash legacy queda temporalmente disponible para una transicion
-- controlada, pero deja de ser obligatorio. Las cuentas nuevas usan Supabase.
alter table public."Usuario"
  alter column "passwordHash" drop not null;

alter table public."Usuario"
  add column if not exists "authUserId" uuid,
  add column if not exists "provider" text,
  add column if not exists "emailVerifiedAt" timestamptz,
  add column if not exists "rowRevision" bigint not null default 1;

do $migration$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public."Usuario"'::regclass
      and conname = 'Usuario_authUserId_fkey'
  ) then
    alter table public."Usuario"
      add constraint "Usuario_authUserId_fkey"
      foreign key ("authUserId") references auth.users(id) on delete set null;
  end if;
end;
$migration$;

-- El email se normaliza antes de imponer unicidad case-insensitive. Si el
-- esquema legacy contiene duplicados reales, se aborta con una causa clara.
do $migration$
begin
  if exists (
    select lower(btrim("email"))
    from public."Usuario"
    group by lower(btrim("email"))
    having count(*) > 1
  ) then
    raise exception 'Usuario contiene emails duplicados al normalizar; resolver antes de habilitar Supabase Auth.';
  end if;
end;
$migration$;

update public."Usuario"
set "email" = lower(btrim("email"))
where "email" is distinct from lower(btrim("email"));

create unique index if not exists "Usuario_authUserId_key"
  on public."Usuario"("authUserId")
  where "authUserId" is not null;

create unique index if not exists "Usuario_email_lower_key"
  on public."Usuario"(lower("email"));

-- Una regla puede autorizar un email exacto o un dominio. Para reglas de
-- dominio se exige el proveedor indicado (azure para @cmcing.cl). Una regla
-- exacta puede usar '*' cuando el proveedor aun no exista en auth.users al
-- momento del hook, por ejemplo el bootstrap externo del superadmin.
create table if not exists public."AuthAccessRule" (
  "id" bigserial primary key,
  "scopeType" text not null check ("scopeType" in ('EMAIL', 'DOMAIN')),
  "scopeValue" text not null,
  "provider" text not null default 'azure',
  "defaultRole" public."RolUsuario" not null default 'OPERACIONES',
  "active" boolean not null default true,
  "description" text,
  "createdByUsuarioId" integer references public."Usuario"("id") on delete set null,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now(),
  constraint "AuthAccessRule_scope_value_check"
    check ("scopeValue" = lower(btrim("scopeValue")) and btrim("scopeValue") <> ''),
  constraint "AuthAccessRule_provider_check"
    check ("provider" = lower(btrim("provider")) and btrim("provider") <> '')
);

create unique index if not exists "AuthAccessRule_scope_provider_key"
  on public."AuthAccessRule"("scopeType", "scopeValue", "provider");

drop trigger if exists trg_auth_access_rule_updated_at on public."AuthAccessRule";
create trigger trg_auth_access_rule_updated_at
before update on public."AuthAccessRule"
for each row execute function public.set_updated_at();

-- Bootstrap sin contrasenas. El authUserId se vincula automaticamente cuando
-- cada persona complete su primer acceso permitido por Supabase Auth.
insert into public."Usuario" (
  "nombre", "email", "passwordHash", "rol", "activo", "provider"
)
values
  ('Cristian Manzor', 'cmanzor@cmcing.cl', null, 'SUPERADMIN', true, 'azure'),
  ('Carlos', 'carlos@prof3sional.com', null, 'SUPERADMIN', true, 'email')
on conflict ("email") do update
set
  "rol" = 'SUPERADMIN',
  "activo" = true,
  "provider" = coalesce(public."Usuario"."provider", excluded."provider"),
  "updatedAt" = now();

insert into public."AuthAccessRule" (
  "scopeType", "scopeValue", "provider", "defaultRole", "description"
)
values
  ('DOMAIN', 'cmcing.cl', 'azure', 'OPERACIONES', 'SSO corporativo Microsoft 365 de CMC'),
  ('EMAIL', 'cmanzor@cmcing.cl', 'azure', 'SUPERADMIN', 'Superadmin base CMC'),
  ('EMAIL', 'carlos@prof3sional.com', 'email', 'SUPERADMIN', 'Superadmin base externo por Supabase Email Auth')
on conflict ("scopeType", "scopeValue", "provider") do update
set
  "defaultRole" = excluded."defaultRole",
  "active" = true,
  "description" = excluded."description",
  "updatedAt" = now();

-- Devuelve la regla mas especifica aplicable. EMAIL tiene precedencia sobre
-- DOMAIN y una coincidencia exacta de proveedor sobre '*'.
create or replace function public.cmc_auth_rule_for(
  p_email text,
  p_provider text
)
returns public."AuthAccessRule"
language sql
stable
security definer
set search_path = pg_catalog, public
as $function$
  select r
  from public."AuthAccessRule" r
  where r."active"
    and (
      (r."scopeType" = 'EMAIL' and r."scopeValue" = lower(btrim(p_email)))
      or
      (r."scopeType" = 'DOMAIN'
        and r."scopeValue" = split_part(lower(btrim(p_email)), '@', 2))
    )
    and r."provider" in (lower(coalesce(nullif(btrim(p_provider), ''), 'unknown')), '*')
  order by
    case r."scopeType" when 'EMAIL' then 0 else 1 end,
    case when r."provider" = lower(coalesce(nullif(btrim(p_provider), ''), 'unknown')) then 0 else 1 end,
    r."id"
  limit 1;
$function$;

-- Supabase Before User Created Hook. Configurar esta funcion desde
-- Authentication > Hooks una vez aplicada la migracion.
create or replace function public.cmc_before_user_created_hook(event jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $function$
declare
  v_email text := lower(btrim(event -> 'user' ->> 'email'));
  v_provider text := lower(coalesce(
    nullif(event -> 'user' -> 'app_metadata' ->> 'provider', ''),
    nullif(event -> 'user' -> 'app_metadata' ->> 'providers', ''),
    'unknown'
  ));
  v_rule public."AuthAccessRule"%rowtype;
begin
  -- providers puede llegar como arreglo serializado; el proveedor principal
  -- es preferido. Esta normalizacion cubre el evento actual y mantiene un
  -- rechazo seguro ante formatos futuros desconocidos.
  if v_provider like '[%azure%]' then
    v_provider := 'azure';
  elsif v_provider like '[%email%]' then
    v_provider := 'email';
  end if;

  if v_email is null or v_email = '' or position('@' in v_email) <= 1 then
    return jsonb_build_object(
      'error', jsonb_build_object(
        'http_code', 400,
        'message', 'Se requiere un correo corporativo valido.'
      )
    );
  end if;

  select * into v_rule
  from public.cmc_auth_rule_for(v_email, v_provider);

  if not found then
    return jsonb_build_object(
      'error', jsonb_build_object(
        'http_code', 403,
        'message', 'La cuenta o el proveedor de identidad no estan autorizados para CMCing.'
      )
    );
  end if;

  return '{}'::jsonb;
end;
$function$;

-- Sincroniza auth.users -> Usuario. El rol se obtiene solo de la regla del
-- servidor; nunca de user_metadata controlable por el cliente.
create or replace function public.cmc_sync_auth_user_profile()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  v_email text := lower(btrim(new.email));
  v_provider text := lower(coalesce(
    nullif(new.raw_app_meta_data ->> 'provider', ''),
    case when jsonb_typeof(new.raw_app_meta_data -> 'providers') = 'array'
      then new.raw_app_meta_data -> 'providers' ->> 0
      else null
    end,
    'unknown'
  ));
  v_rule public."AuthAccessRule"%rowtype;
  v_name text;
begin
  if v_email is null or v_email = '' then
    raise exception 'auth.users sin email no puede vincularse a Usuario.' using errcode = '23514';
  end if;

  select * into v_rule
  from public.cmc_auth_rule_for(v_email, v_provider);

  if not found then
    raise exception 'Cuenta o proveedor no autorizado para CMCing.' using errcode = '42501';
  end if;

  v_name := coalesce(
    nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''),
    nullif(btrim(new.raw_user_meta_data ->> 'name'), ''),
    split_part(v_email, '@', 1)
  );

  if exists (
    select 1
    from public."Usuario" u
    where lower(u."email") = v_email
      and u."authUserId" is not null
      and u."authUserId" <> new.id
  ) then
    raise exception 'El email ya esta vinculado a otra identidad Supabase.' using errcode = '23505';
  end if;

  insert into public."Usuario" (
    "nombre", "email", "passwordHash", "rol", "activo", "authUserId",
    "provider", "emailVerifiedAt", "lastLoginAt"
  )
  values (
    v_name,
    v_email,
    null,
    v_rule."defaultRole",
    true,
    new.id,
    v_provider,
    new.email_confirmed_at,
    new.last_sign_in_at
  )
  on conflict ("email") do update
  set
    "authUserId" = excluded."authUserId",
    "provider" = excluded."provider",
    "emailVerifiedAt" = coalesce(excluded."emailVerifiedAt", public."Usuario"."emailVerifiedAt"),
    "lastLoginAt" = coalesce(excluded."lastLoginAt", public."Usuario"."lastLoginAt"),
    "nombre" = case
      when btrim(public."Usuario"."nombre") = '' then excluded."nombre"
      else public."Usuario"."nombre"
    end,
    -- El hook asigna rol/activo solo en INSERT. En logins posteriores se
    -- preservan promociones, cambios de rol y suspensiones administrativas.
    "rol" = public."Usuario"."rol",
    "activo" = public."Usuario"."activo",
    "updatedAt" = now();

  return new;
end;
$function$;

drop trigger if exists on_auth_user_sync_cmcing on auth.users;
create trigger on_auth_user_sync_cmcing
after insert or update of email, raw_app_meta_data, raw_user_meta_data,
  email_confirmed_at, last_sign_in_at
on auth.users
for each row execute function public.cmc_sync_auth_user_profile();

-- Helpers pequenos y estables para RLS/RPC. Todos resuelven al actor desde el
-- JWT verificado por Supabase.
create or replace function public.cmc_current_usuario_id()
returns integer
language sql
stable
security definer
set search_path = pg_catalog, public, auth
as $function$
  select u."id"
  from public."Usuario" u
  where u."authUserId" = auth.uid()
    and u."activo"
  limit 1;
$function$;

create or replace function public.cmc_current_tecnico_id()
returns integer
language sql
stable
security definer
set search_path = pg_catalog, public, auth
as $function$
  select u."tecnicoId"
  from public."Usuario" u
  where u."authUserId" = auth.uid()
    and u."activo"
  limit 1;
$function$;

create or replace function public.cmc_current_role()
returns text
language sql
stable
security definer
set search_path = pg_catalog, public, auth
as $function$
  select u."rol"::text
  from public."Usuario" u
  where u."authUserId" = auth.uid()
    and u."activo"
  limit 1;
$function$;

create or replace function public.cmc_is_active_user()
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, auth
as $function$
  select exists (
    select 1
    from public."Usuario" u
    where u."authUserId" = auth.uid()
      and u."activo"
  );
$function$;

create or replace function public.cmc_has_any_role(p_roles text[])
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, auth
as $function$
  select exists (
    select 1
    from public."Usuario" u
    where u."authUserId" = auth.uid()
      and u."activo"
      and u."rol"::text = any(p_roles)
  );
$function$;

-- El Before User Created Hook se ejecuta como supabase_auth_admin.
grant usage on schema public to supabase_auth_admin;
grant execute on function public.cmc_before_user_created_hook(jsonb) to supabase_auth_admin;

-- Privilegios minimos y explicitos. La tabla de reglas nunca es visible para
-- anon ni para usuarios normales; el hook la lee como SECURITY DEFINER.
revoke all on table public."AuthAccessRule" from anon, authenticated;
revoke execute on function public.cmc_auth_rule_for(text, text) from public, anon, authenticated;
revoke execute on function public.cmc_before_user_created_hook(jsonb) from public, anon, authenticated;
revoke execute on function public.cmc_sync_auth_user_profile() from public, anon, authenticated;

revoke execute on function public.cmc_current_usuario_id() from public, anon;
revoke execute on function public.cmc_current_tecnico_id() from public, anon;
revoke execute on function public.cmc_current_role() from public, anon;
revoke execute on function public.cmc_is_active_user() from public, anon;
revoke execute on function public.cmc_has_any_role(text[]) from public, anon;

grant execute on function public.cmc_current_usuario_id() to authenticated;
grant execute on function public.cmc_current_tecnico_id() to authenticated;
grant execute on function public.cmc_current_role() to authenticated;
grant execute on function public.cmc_is_active_user() to authenticated;
grant execute on function public.cmc_has_any_role(text[]) to authenticated;

comment on function public.cmc_before_user_created_hook(jsonb) is
  'Supabase Before User Created Hook: allowlist por email/dominio y proveedor.';

comment on column public."Usuario"."authUserId" is
  'Vinculo canonico al subject auth.users; los RPC obtienen al actor mediante auth.uid().';

commit;
