-- Identidad operativa de equipos, propiedad inmutable e imágenes privadas.
-- La OT conserva la criticidad; el equipo no la define.

begin;

-- CMCing se representa por un único Cliente técnico, excluido de los catálogos
-- comerciales. Conservamos clienteId no nulo en Equipo sin inventar un dueño
-- alternativo ni dejar activos sin responsable.
alter table public."Cliente"
  add column if not exists "esEmpresaCMCing" boolean not null default false;

create unique index if not exists "Cliente_one_empresa_cmcing_key"
  on public."Cliente" ("esEmpresaCMCing")
  where "esEmpresaCMCing";

with candidato as (
  select "id"
  from public."Cliente"
  where lower(btrim("nombre")) = 'cmcing'
  order by "id"
  limit 1
)
update public."Cliente"
set "esEmpresaCMCing" = true
where "id" = (select "id" from candidato)
  and not exists (
    select 1 from public."Cliente" where "esEmpresaCMCing"
  );

insert into public."Cliente" ("nombre", "email", "esEmpresaCMCing")
select 'CMCing', 'equipos-propios@cmcing.local', true
where not exists (
  select 1 from public."Cliente" where "esEmpresaCMCing"
);

-- SKU pasa a llamarse Part Number. Se conserva todo dato existente durante el
-- renombre y se retiran los índices con el nombre legado.
do $migration$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'Equipo' and column_name = 'sku'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'Equipo' and column_name = 'partNumber'
  ) then
    alter table public."Equipo" rename column "sku" to "partNumber";
  elsif exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'Equipo' and column_name = 'sku'
  ) then
    update public."Equipo"
    set "partNumber" = coalesce(nullif(btrim("partNumber"), ''), nullif(btrim("sku"), ''))
    where "partNumber" is null or btrim("partNumber") = '';
    alter table public."Equipo" drop column "sku";
  end if;
end;
$migration$;

alter table public."Equipo"
  add column if not exists "partNumber" text,
  add column if not exists "ean" text,
  add column if not exists "imagenR2Bucket" text,
  add column if not exists "imagenR2Key" text,
  add column if not exists "imagenMimeType" text,
  add column if not exists "imagenSizeBytes" integer,
  add column if not exists "imagenChecksumSha256" text;

alter table public."Equipo"
  alter column "modelo" drop not null,
  alter column "serial" drop not null;

alter table public."Equipo"
  drop constraint if exists "Equipo_ean_format_check";

alter table public."Equipo"
  add constraint "Equipo_ean_format_check"
  check ("ean" is null or "ean" ~ '^[0-9]{8}([0-9]{5}|[0-9]{6})?$');

drop index if exists public."Equipo_sku_idx";
drop index if exists public."Equipo_sku_trgm_idx";
create index if not exists "Equipo_partNumber_idx" on public."Equipo" ("partNumber");
create index if not exists "Equipo_partNumber_trgm_idx" on public."Equipo" using gin ("partNumber" gin_trgm_ops);
create index if not exists "Equipo_ean_idx" on public."Equipo" ("ean") where "ean" is not null;
create unique index if not exists "Equipo_ean_key" on public."Equipo" ("ean") where "ean" is not null;
create unique index if not exists "Equipo_imagenR2Key_key" on public."Equipo" ("imagenR2Key") where "imagenR2Key" is not null;

-- El código se genera en PostgreSQL, de forma segura ante inserciones
-- concurrentes, y queda inmutable junto con el propietario.
create sequence if not exists public."Equipo_codigoInterno_seq" as bigint;

select setval(
  'public."Equipo_codigoInterno_seq"',
  coalesce((
    select max((substring("codigoInterno" from '^CMC-([0-9]+)$'))::bigint)
    from public."Equipo"
  ), 0) + 1,
  false
);

update public."Equipo"
set "codigoInterno" = 'CMC-' || lpad(nextval('public."Equipo_codigoInterno_seq"')::text, 5, '0')
where "codigoInterno" is null or btrim("codigoInterno") = '';

create or replace function public.cmc_guard_equipo_identity()
returns trigger
language plpgsql
as $function$
begin
  if tg_op = 'INSERT' then
    new."codigoInterno" := 'CMC-' || lpad(nextval('public."Equipo_codigoInterno_seq"')::text, 5, '0');
  else
    if new."clienteId" is distinct from old."clienteId" then
      raise exception 'El cliente propietario del equipo no se puede modificar.' using errcode = '23514';
    end if;
    new."codigoInterno" := old."codigoInterno";
  end if;
  return new;
end;
$function$;

drop trigger if exists trg_equipo_identity_guard on public."Equipo";
create trigger trg_equipo_identity_guard
before insert or update on public."Equipo"
for each row execute function public.cmc_guard_equipo_identity();

-- La criticidad es situacional: vive en la OT y se mantiene sincronizada con
-- prioridad para no quebrar los clientes móviles que aún leen esa columna.
alter table public."OrdenTrabajo"
  add column if not exists "criticidad" text;

update public."OrdenTrabajo"
set "criticidad" = coalesce("criticidad", "prioridad", 'media')
where "criticidad" is null;

alter table public."OrdenTrabajo"
  alter column "criticidad" set default 'media',
  alter column "criticidad" set not null,
  drop constraint if exists "OrdenTrabajo_criticidad_check";

alter table public."OrdenTrabajo"
  add constraint "OrdenTrabajo_criticidad_check"
  check ("criticidad" in ('baja', 'media', 'alta', 'critica'));

create index if not exists "OrdenTrabajo_criticidad_idx" on public."OrdenTrabajo" ("criticidad");

create or replace function public.cmc_sync_ot_criticidad()
returns trigger
language plpgsql
as $function$
begin
  if tg_op = 'INSERT' then
    new."criticidad" := lower(coalesce(nullif(btrim(new."criticidad"), ''), new."prioridad", 'media'));
    new."prioridad" := new."criticidad";
  elsif new."criticidad" is distinct from old."criticidad" then
    new."criticidad" := lower(coalesce(nullif(btrim(new."criticidad"), ''), new."prioridad", 'media'));
    new."prioridad" := new."criticidad";
  elsif new."prioridad" is distinct from old."prioridad" then
    new."criticidad" := lower(coalesce(nullif(btrim(new."prioridad"), ''), 'media'));
    new."prioridad" := new."criticidad";
  end if;
  return new;
end;
$function$;

drop trigger if exists trg_orden_trabajo_criticidad_sync on public."OrdenTrabajo";
create trigger trg_orden_trabajo_criticidad_sync
before insert or update on public."OrdenTrabajo"
for each row execute function public.cmc_sync_ot_criticidad();

-- La vista deja de presentar criticidad de equipo y expone sus identificadores
-- canónicos para trazabilidad de hoja de vida.
drop view if exists public."vw_HojaVidaEquipo";
alter table public."Equipo" drop column if exists "criticidad";

create view public."vw_HojaVidaEquipo"
with (security_invoker = true)
as
select
  e."id" as "equipoId",
  e."codigoInterno",
  e."nombre",
  e."modelo",
  e."partNumber",
  e."ean",
  e."serial",
  e."estadoOperativo",
  c."nombre" as "cliente",
  e."ubicacion",
  e."proximaMantencion",
  hv."id" as "eventoId",
  hv."fechaEvento",
  hv."tipoEvento",
  hv."titulo",
  hv."detalle",
  hv."costo",
  hv."visitaId"
from public."Equipo" e
join public."Cliente" c on c."id" = e."clienteId"
left join public."EquipoHojaVida" hv on hv."equipoId" = e."id";

commit;
