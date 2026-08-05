-- Cotizaciones comerciales: ítems identificables y descuentos por porcentaje o monto fijo.
-- Los campos porcentuales históricos se conservan por compatibilidad con cotizaciones previas.

begin;

alter table public."Cotizacion"
  add column if not exists "descuentoGlobalTipo" text not null default 'porcentaje',
  add column if not exists "descuentoGlobalValor" numeric(14,2) not null default 0;

alter table public."Cotizacion"
  drop constraint if exists "Cotizacion_descuentoGlobalTipo_check";

alter table public."Cotizacion"
  add constraint "Cotizacion_descuentoGlobalTipo_check"
  check ("descuentoGlobalTipo" in ('porcentaje', 'monto'));

update public."Cotizacion"
set "descuentoGlobalValor" = coalesce("descuentoGlobalPct", 0)
where "descuentoGlobalTipo" = 'porcentaje'
  and "descuentoGlobalValor" = 0;

alter table public."CotizacionItem"
  add column if not exists "nombre" text,
  add column if not exists "codigo" text,
  add column if not exists "descuentoTipo" text not null default 'porcentaje',
  add column if not exists "descuentoValor" numeric(14,2) not null default 0;

update public."CotizacionItem"
set
  "nombre" = coalesce(nullif(btrim("descripcion"), ''), 'Ítem sin nombre'),
  "descuentoValor" = coalesce("descuentoPct", 0)
where "nombre" is null
   or "descuentoValor" = 0;

alter table public."CotizacionItem"
  alter column "nombre" set not null;

alter table public."CotizacionItem"
  drop constraint if exists "CotizacionItem_descuentoTipo_check";

alter table public."CotizacionItem"
  add constraint "CotizacionItem_descuentoTipo_check"
  check ("descuentoTipo" in ('porcentaje', 'monto'));

-- La columna heredada era generada únicamente con porcentaje. Se reemplaza por
-- un valor calculado por trigger para soportar ambos tipos de descuento.
alter table public."CotizacionItem"
  drop column if exists "lineaTotal";

alter table public."CotizacionItem"
  add column "lineaTotal" numeric(14,2) not null default 0;

create or replace function public.fn_calcular_linea_cotizacion_item()
returns trigger
language plpgsql
as $$
declare
  v_bruto numeric(14,2);
  v_descuento numeric(14,2);
  v_valor numeric(14,2);
begin
  new."nombre" := coalesce(nullif(btrim(new."nombre"), ''), nullif(btrim(new."descripcion"), ''), 'Ítem sin nombre');
  new."descripcion" := coalesce(new."descripcion", '');
  new."cantidad" := greatest(coalesce(new."cantidad", 0), 0);
  new."precioUnitario" := greatest(coalesce(new."precioUnitario", 0), 0);
  new."descuentoTipo" := case when new."descuentoTipo" = 'monto' then 'monto' else 'porcentaje' end;
  v_bruto := round((new."cantidad" * new."precioUnitario")::numeric, 2);

  if new."descuentoTipo" = 'monto' then
    new."descuentoValor" := greatest(coalesce(new."descuentoValor", 0), 0);
    v_descuento := least(v_bruto, new."descuentoValor");
    new."descuentoPct" := case when v_bruto = 0 then 0 else round((v_descuento * 100 / v_bruto)::numeric, 2) end;
  else
    v_valor := greatest(coalesce(nullif(new."descuentoValor", 0), new."descuentoPct", 0), 0);
    new."descuentoValor" := least(v_valor, 100);
    new."descuentoPct" := new."descuentoValor";
    v_descuento := round((v_bruto * new."descuentoValor" / 100)::numeric, 2);
  end if;

  new."lineaTotal" := greatest(round((v_bruto - v_descuento)::numeric, 2), 0);
  return new;
end;
$$;

drop trigger if exists trg_calcular_linea_cotizacion_item on public."CotizacionItem";
create trigger trg_calcular_linea_cotizacion_item
before insert or update of "nombre", "descripcion", "cantidad", "precioUnitario", "descuentoPct", "descuentoTipo", "descuentoValor"
on public."CotizacionItem"
for each row execute function public.fn_calcular_linea_cotizacion_item();

create or replace function public.fn_recalcular_totales_cotizacion(p_cotizacion_id integer)
returns void
language plpgsql
as $$
declare
  v_subtotal numeric(14,2);
  v_descuento_tipo text;
  v_descuento_valor numeric(14,2);
  v_descuento_pct numeric(5,2);
  v_impuesto_pct numeric(5,2);
  v_descuento_monto numeric(14,2);
  v_base numeric(14,2);
  v_impuesto_monto numeric(14,2);
  v_total numeric(14,2);
begin
  select coalesce(sum(ci."lineaTotal"), 0)
  into v_subtotal
  from public."CotizacionItem" ci
  where ci."cotizacionId" = p_cotizacion_id;

  select c."descuentoGlobalTipo", c."descuentoGlobalValor", c."descuentoGlobalPct", c."impuestoPct"
  into v_descuento_tipo, v_descuento_valor, v_descuento_pct, v_impuesto_pct
  from public."Cotizacion" c
  where c."id" = p_cotizacion_id;

  if v_descuento_tipo = 'monto' then
    v_descuento_monto := least(v_subtotal, greatest(coalesce(v_descuento_valor, 0), 0));
  else
    v_descuento_valor := least(greatest(coalesce(nullif(v_descuento_valor, 0), v_descuento_pct, 0), 0), 100);
    v_descuento_monto := round((v_subtotal * v_descuento_valor / 100.0)::numeric, 2);
  end if;

  v_base := greatest(v_subtotal - v_descuento_monto, 0);
  v_impuesto_monto := round((v_base * greatest(coalesce(v_impuesto_pct, 0), 0) / 100.0)::numeric, 2);
  v_total := v_base + v_impuesto_monto;

  update public."Cotizacion"
  set
    "descuentoGlobalValor" = coalesce(v_descuento_valor, 0),
    "descuentoGlobalPct" = case when v_descuento_tipo = 'porcentaje' then coalesce(v_descuento_valor, 0) else case when v_subtotal = 0 then 0 else round((v_descuento_monto * 100 / v_subtotal)::numeric, 2) end end,
    "subtotal" = v_subtotal,
    "descuentoMonto" = v_descuento_monto,
    "impuestoMonto" = v_impuesto_monto,
    "total" = v_total
  where "id" = p_cotizacion_id;
end;
$$;

create or replace function public.fn_recalcular_totales_cotizacion_encabezado_trg()
returns trigger
language plpgsql
as $$
begin
  if pg_trigger_depth() > 1 then
    return new;
  end if;

  perform public.fn_recalcular_totales_cotizacion(new."id");
  return new;
end;
$$;

drop trigger if exists trg_recalc_totales_cotizacion_descuento on public."Cotizacion";
create trigger trg_recalc_totales_cotizacion_descuento
after update of "descuentoGlobalTipo", "descuentoGlobalValor", "descuentoGlobalPct", "impuestoPct"
on public."Cotizacion"
for each row execute function public.fn_recalcular_totales_cotizacion_encabezado_trg();

-- Recalcula tanto las líneas heredadas como los encabezados existentes.
update public."CotizacionItem"
set "cantidad" = "cantidad";

do $$
declare
  v_cotizacion record;
begin
  for v_cotizacion in select "id" from public."Cotizacion" loop
    perform public.fn_recalcular_totales_cotizacion(v_cotizacion."id");
  end loop;
end;
$$;

commit;
