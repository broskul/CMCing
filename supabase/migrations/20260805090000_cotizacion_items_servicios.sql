-- Cotizaciones: jerarquía inmutable de ítem de equipo -> servicios del catálogo.
-- El ítem conserva un snapshot del equipo y cada servicio conserva su nombre al cotizar.

begin;

create table if not exists public."CotizacionItemServicio" (
  "id" serial primary key,
  "cotizacionItemId" integer not null references public."CotizacionItem"("id") on delete cascade,
  "servicioId" integer not null references public."Servicio"("id") on delete restrict,
  "nombre" text not null,
  "descripcionDetalle" text,
  "cantidad" numeric(12,2) not null default 1 check ("cantidad" > 0),
  "precioUnitario" numeric(14,2) not null default 0 check ("precioUnitario" >= 0),
  "descuentoTipo" text not null default 'porcentaje' check ("descuentoTipo" in ('porcentaje', 'monto')),
  "descuentoValor" numeric(14,2) not null default 0 check ("descuentoValor" >= 0),
  "descuentoPct" numeric(5,2) not null default 0 check ("descuentoPct" between 0 and 100),
  "lineaTotal" numeric(14,2) not null default 0,
  "orden" integer not null default 1 check ("orden" > 0),
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now(),
  unique ("cotizacionItemId", "orden")
);

create index if not exists "CotizacionItemServicio_cotizacionItemId_idx"
  on public."CotizacionItemServicio" ("cotizacionItemId");
create index if not exists "CotizacionItemServicio_servicioId_idx"
  on public."CotizacionItemServicio" ("servicioId");

create or replace function public.fn_calcular_linea_cotizacion_item_servicio()
returns trigger
language plpgsql
as $$
declare
  v_bruto numeric(14,2);
  v_descuento numeric(14,2);
begin
  new."cantidad" := greatest(coalesce(new."cantidad", 0), 0);
  new."precioUnitario" := greatest(coalesce(new."precioUnitario", 0), 0);
  new."descuentoTipo" := case when new."descuentoTipo" = 'monto' then 'monto' else 'porcentaje' end;
  new."descuentoValor" := greatest(coalesce(new."descuentoValor", new."descuentoPct", 0), 0);
  v_bruto := round((new."cantidad" * new."precioUnitario")::numeric, 2);

  if new."descuentoTipo" = 'monto' then
    v_descuento := least(v_bruto, new."descuentoValor");
    new."descuentoPct" := case when v_bruto = 0 then 0 else round((v_descuento * 100 / v_bruto)::numeric, 2) end;
  else
    new."descuentoValor" := least(new."descuentoValor", 100);
    new."descuentoPct" := new."descuentoValor";
    v_descuento := round((v_bruto * new."descuentoValor" / 100)::numeric, 2);
  end if;

  new."lineaTotal" := greatest(round((v_bruto - v_descuento)::numeric, 2), 0);
  return new;
end;
$$;

drop trigger if exists trg_calcular_linea_cotizacion_item_servicio on public."CotizacionItemServicio";
create trigger trg_calcular_linea_cotizacion_item_servicio
before insert or update of "nombre", "descripcionDetalle", "cantidad", "precioUnitario", "descuentoPct", "descuentoTipo", "descuentoValor"
on public."CotizacionItemServicio"
for each row execute function public.fn_calcular_linea_cotizacion_item_servicio();

drop trigger if exists trg_cotizacion_item_servicio_updated_at on public."CotizacionItemServicio";
create trigger trg_cotizacion_item_servicio_updated_at
before update on public."CotizacionItemServicio"
for each row execute function public.set_updated_at();

create or replace function public.fn_recalcular_total_cotizacion_item(p_cotizacion_item_id integer)
returns void
language plpgsql
as $$
declare
  v_total numeric(14,2);
begin
  select coalesce(sum(cis."lineaTotal"), 0)
  into v_total
  from public."CotizacionItemServicio" cis
  where cis."cotizacionItemId" = p_cotizacion_item_id;

  update public."CotizacionItem"
  set "lineaTotal" = v_total
  where "id" = p_cotizacion_item_id;
end;
$$;

create or replace function public.fn_recalcular_total_cotizacion_item_servicio_trg()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' then
    perform public.fn_recalcular_total_cotizacion_item(old."cotizacionItemId");
    return old;
  end if;

  perform public.fn_recalcular_total_cotizacion_item(new."cotizacionItemId");
  return new;
end;
$$;

drop trigger if exists trg_recalcular_total_cotizacion_item_servicio on public."CotizacionItemServicio";
create trigger trg_recalcular_total_cotizacion_item_servicio
after insert or update or delete on public."CotizacionItemServicio"
for each row execute function public.fn_recalcular_total_cotizacion_item_servicio_trg();

-- Preserva la trazabilidad de las cotizaciones existentes que ya tenían un servicio asociado.
insert into public."CotizacionItemServicio" (
  "cotizacionItemId", "servicioId", "nombre", "descripcionDetalle", "cantidad", "precioUnitario",
  "descuentoTipo", "descuentoValor", "descuentoPct", "orden"
)
select
  ci."id",
  ci."servicioId",
  coalesce(nullif(btrim(s."descripcion"), ''), ci."nombre"),
  nullif(btrim(ci."descripcion"), ''),
  ci."cantidad",
  ci."precioUnitario",
  coalesce(ci."descuentoTipo", 'porcentaje'),
  coalesce(ci."descuentoValor", ci."descuentoPct", 0),
  coalesce(ci."descuentoPct", 0),
  1
from public."CotizacionItem" ci
join public."Servicio" s on s."id" = ci."servicioId"
where not exists (
  select 1
  from public."CotizacionItemServicio" cis
  where cis."cotizacionItemId" = ci."id"
);

alter table public."CotizacionItemServicio" enable row level security;
alter table public."CotizacionItemServicio" force row level security;
drop policy if exists cmc_cotizacionitemservicio_read on public."CotizacionItemServicio";
create policy cmc_cotizacionitemservicio_read
on public."CotizacionItemServicio" for select to authenticated
using (public.cmc_has_any_role(array['SUPERADMIN', 'ADMIN', 'OPERACIONES', 'LECTURA']));
drop policy if exists cmc_cotizacionitemservicio_insert on public."CotizacionItemServicio";
create policy cmc_cotizacionitemservicio_insert
on public."CotizacionItemServicio" for insert to authenticated
with check (public.cmc_has_any_role(array['SUPERADMIN', 'ADMIN', 'OPERACIONES']));
drop policy if exists cmc_cotizacionitemservicio_update on public."CotizacionItemServicio";
create policy cmc_cotizacionitemservicio_update
on public."CotizacionItemServicio" for update to authenticated
using (public.cmc_has_any_role(array['SUPERADMIN', 'ADMIN', 'OPERACIONES']))
with check (public.cmc_has_any_role(array['SUPERADMIN', 'ADMIN', 'OPERACIONES']));

revoke all on table public."CotizacionItemServicio" from public, anon, authenticated;
grant select, insert, update on table public."CotizacionItemServicio" to authenticated;
grant all on table public."CotizacionItemServicio" to service_role;
grant usage on sequence public."CotizacionItemServicio_id_seq" to authenticated;
grant all on sequence public."CotizacionItemServicio_id_seq" to service_role;

commit;
