-- =========================================================
-- CMCing CMMS + Cotizador MVP (sobre esquema actual Prisma)
-- Ejecutar en Supabase SQL Editor
-- =========================================================

begin;

-- ---------------------------------------------------------
-- 0) Utilidades comunes
-- ---------------------------------------------------------
create extension if not exists pg_trgm;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new."updatedAt" = now();
  return new;
end;
$$;

-- Aseguramos defaults y triggers updatedAt en tablas existentes
alter table if exists "Cliente" alter column "updatedAt" set default now();
alter table if exists "Equipo" alter column "updatedAt" set default now();
alter table if exists "Servicio" alter column "updatedAt" set default now();
alter table if exists "Vendedor" alter column "updatedAt" set default now();
alter table if exists "Tecnico" alter column "updatedAt" set default now();
alter table if exists "Visita" alter column "updatedAt" set default now();

drop trigger if exists trg_cliente_updated_at on "Cliente";
create trigger trg_cliente_updated_at before update on "Cliente"
for each row execute function public.set_updated_at();

drop trigger if exists trg_equipo_updated_at on "Equipo";
create trigger trg_equipo_updated_at before update on "Equipo"
for each row execute function public.set_updated_at();

drop trigger if exists trg_servicio_updated_at on "Servicio";
create trigger trg_servicio_updated_at before update on "Servicio"
for each row execute function public.set_updated_at();

drop trigger if exists trg_vendedor_updated_at on "Vendedor";
create trigger trg_vendedor_updated_at before update on "Vendedor"
for each row execute function public.set_updated_at();

drop trigger if exists trg_tecnico_updated_at on "Tecnico";
create trigger trg_tecnico_updated_at before update on "Tecnico"
for each row execute function public.set_updated_at();

drop trigger if exists trg_visita_updated_at on "Visita";
create trigger trg_visita_updated_at before update on "Visita"
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------
-- 1) Extensiones CMMS en tablas existentes
-- ---------------------------------------------------------

-- Equipo: hoja de vida y control operacional
alter table "Equipo" add column if not exists "codigoInterno" text;
alter table "Equipo" add column if not exists "categoria" text;
alter table "Equipo" add column if not exists "fabricante" text;
alter table "Equipo" add column if not exists "ubicacion" text;
alter table "Equipo" add column if not exists "fechaInstalacion" date;
alter table "Equipo" add column if not exists "fechaGarantiaFin" date;
alter table "Equipo" add column if not exists "estadoOperativo" text default 'operativo';
alter table "Equipo" add column if not exists "criticidad" text default 'media';
alter table "Equipo" add column if not exists "ultimaMantencion" timestamptz;
alter table "Equipo" add column if not exists "proximaMantencion" timestamptz;
alter table "Equipo" add column if not exists "observaciones" text;

create unique index if not exists "Equipo_codigoInterno_key" on "Equipo"("codigoInterno") where "codigoInterno" is not null;
create index if not exists "Equipo_estadoOperativo_idx" on "Equipo"("estadoOperativo");
create index if not exists "Equipo_proximaMantencion_idx" on "Equipo"("proximaMantencion");

-- Servicio: catalogo operativo
alter table "Servicio" add column if not exists "tipo" text default 'mantenimiento';
alter table "Servicio" add column if not exists "duracionEstimadaMin" integer default 60;
alter table "Servicio" add column if not exists "activo" boolean default true;

-- Visita: calendarizacion + trazabilidad
alter table "Visita" add column if not exists "codigo" text;
alter table "Visita" add column if not exists "fechaProgramada" timestamptz;
alter table "Visita" add column if not exists "fechaFinProgramada" timestamptz;
alter table "Visita" add column if not exists "fechaCierre" timestamptz;
alter table "Visita" add column if not exists "prioridad" text default 'media';
alter table "Visita" add column if not exists "tipoVisita" text default 'mantenimiento_preventivo';
alter table "Visita" add column if not exists "notasTecnicas" text;
alter table "Visita" add column if not exists "duracionMin" integer;
alter table "Visita" add column if not exists "costoManoObra" numeric(14,2) default 0;
alter table "Visita" add column if not exists "costoRepuestos" numeric(14,2) default 0;
alter table "Visita" add column if not exists "calendarEventId" text;

update "Visita"
set "fechaProgramada" = coalesce("fechaProgramada", "fecha"::timestamptz)
where "fechaProgramada" is null;

create unique index if not exists "Visita_codigo_key" on "Visita"("codigo") where "codigo" is not null;
create index if not exists "Visita_fechaProgramada_idx" on "Visita"("fechaProgramada");
create index if not exists "Visita_estado_idx" on "Visita"("estado");
create index if not exists "Visita_prioridad_idx" on "Visita"("prioridad");

create or replace function public.fn_set_visita_codigo()
returns trigger
language plpgsql
as $$
begin
  if new."codigo" is null then
    update "Visita"
    set "codigo" = 'VIS-' || to_char(coalesce(new."fechaProgramada", new."fecha"::timestamptz, now()), 'YYYY') || '-' || lpad(new."id"::text, 6, '0')
    where "id" = new."id"
      and "codigo" is null;
  end if;
  return null;
end;
$$;

drop trigger if exists trg_visita_codigo on "Visita";
create trigger trg_visita_codigo
after insert on "Visita"
for each row execute function public.fn_set_visita_codigo();

-- ---------------------------------------------------------
-- 2) Visitas con multiples equipos
-- ---------------------------------------------------------
create table if not exists "VisitaEquipo" (
  "id" serial primary key,
  "visitaId" integer not null references "Visita"("id") on delete cascade,
  "equipoId" integer not null references "Equipo"("id") on delete cascade,
  "createdAt" timestamptz not null default now(),
  unique ("visitaId", "equipoId")
);

create index if not exists "VisitaEquipo_visitaId_idx" on "VisitaEquipo"("visitaId");
create index if not exists "VisitaEquipo_equipoId_idx" on "VisitaEquipo"("equipoId");

-- Backfill desde columna legacy equipoId
insert into "VisitaEquipo"("visitaId", "equipoId")
select v."id", v."equipoId"
from "Visita" v
where v."equipoId" is not null
on conflict ("visitaId", "equipoId") do nothing;

-- ---------------------------------------------------------
-- 3) Actividades por visita (checklist tecnico)
-- ---------------------------------------------------------
create table if not exists "Actividad" (
  "id" serial primary key,
  "nombre" text not null,
  "descripcion" text,
  "tipo" text not null default 'preventiva',
  "duracionEstimadaMin" integer not null default 30,
  "obligatoria" boolean not null default false,
  "activa" boolean not null default true,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);

drop trigger if exists trg_actividad_updated_at on "Actividad";
create trigger trg_actividad_updated_at before update on "Actividad"
for each row execute function public.set_updated_at();

create table if not exists "VisitaActividad" (
  "id" serial primary key,
  "visitaId" integer not null references "Visita"("id") on delete cascade,
  "actividadId" integer references "Actividad"("id") on delete set null,
  "titulo" text not null,
  "descripcion" text,
  "estado" text not null default 'pendiente', -- pendiente, en_progreso, completada, omitida
  "orden" integer not null default 1,
  "responsableTecnicoId" integer references "Tecnico"("id") on delete set null,
  "fechaProgramada" timestamptz,
  "fechaReal" timestamptz,
  "duracionMin" integer,
  "observaciones" text,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);

create index if not exists "VisitaActividad_visitaId_idx" on "VisitaActividad"("visitaId");
create index if not exists "VisitaActividad_estado_idx" on "VisitaActividad"("estado");

-- No duplicar titulo dentro de la misma visita
create unique index if not exists "VisitaActividad_visita_titulo_key"
on "VisitaActividad"("visitaId", "titulo");

drop trigger if exists trg_visita_actividad_updated_at on "VisitaActividad";
create trigger trg_visita_actividad_updated_at before update on "VisitaActividad"
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------
-- 4) Hoja de vida de equipo
-- ---------------------------------------------------------
create table if not exists "EquipoHojaVida" (
  "id" serial primary key,
  "equipoId" integer not null references "Equipo"("id") on delete cascade,
  "visitaId" integer references "Visita"("id") on delete set null,
  "tecnicoId" integer references "Tecnico"("id") on delete set null,
  "tipoEvento" text not null default 'servicio', -- instalacion, preventivo, correctivo, calibracion, repuesto, incidencia, otro
  "fechaEvento" timestamptz not null default now(),
  "titulo" text not null,
  "detalle" text,
  "costo" numeric(14,2),
  "documentoUrl" text,
  "metadata" jsonb not null default '{}'::jsonb,
  "createdAt" timestamptz not null default now()
);

create index if not exists "EquipoHojaVida_equipo_fecha_idx" on "EquipoHojaVida"("equipoId", "fechaEvento" desc);
create index if not exists "EquipoHojaVida_tipoEvento_idx" on "EquipoHojaVida"("tipoEvento");

-- Inserta automaticamente evento de hoja de vida al completar visita
create or replace function public.fn_log_hoja_vida_desde_visita()
returns trigger
language plpgsql
as $$
begin
  if (tg_op = 'INSERT' and new."estado" = 'completada')
     or (tg_op = 'UPDATE' and new."estado" = 'completada' and old."estado" is distinct from new."estado") then

    insert into "EquipoHojaVida" (
      "equipoId", "visitaId", "tecnicoId", "tipoEvento", "fechaEvento", "titulo", "detalle", "costo", "metadata"
    )
    select
      ve."equipoId",
      new."id",
      new."tecnicoId",
      coalesce(new."tipoVisita", 'servicio'),
      coalesce(new."fechaCierre", now()),
      'Visita completada ' || coalesce(new."codigo", '#' || new."id"::text),
      coalesce(new."notasTecnicas", new."descripcion", 'Sin detalle técnico'),
      coalesce(new."costoManoObra", 0) + coalesce(new."costoRepuestos", 0),
      jsonb_build_object('estado', new."estado", 'servicioId', new."servicioId")
    from "VisitaEquipo" ve
    where ve."visitaId" = new."id"
    on conflict do nothing;

    -- Compatibilidad si no hay registros en VisitaEquipo
    if not exists (select 1 from "VisitaEquipo" x where x."visitaId" = new."id") and new."equipoId" is not null then
      insert into "EquipoHojaVida" (
        "equipoId", "visitaId", "tecnicoId", "tipoEvento", "fechaEvento", "titulo", "detalle", "costo", "metadata"
      ) values (
        new."equipoId",
        new."id",
        new."tecnicoId",
        coalesce(new."tipoVisita", 'servicio'),
        coalesce(new."fechaCierre", now()),
        'Visita completada ' || coalesce(new."codigo", '#' || new."id"::text),
        coalesce(new."notasTecnicas", new."descripcion", 'Sin detalle técnico'),
        coalesce(new."costoManoObra", 0) + coalesce(new."costoRepuestos", 0),
        jsonb_build_object('estado', new."estado", 'servicioId', new."servicioId")
      );
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_log_hoja_vida_visita on "Visita";
create trigger trg_log_hoja_vida_visita
after insert or update on "Visita"
for each row execute function public.fn_log_hoja_vida_desde_visita();

-- ---------------------------------------------------------
-- 5) Cotizador rapido
-- ---------------------------------------------------------
create table if not exists "Cotizacion" (
  "id" serial primary key,
  "numero" text,
  "clienteId" integer not null references "Cliente"("id") on delete restrict,
  "vendedorId" integer references "Vendedor"("id") on delete set null,
  "fecha" timestamptz not null default now(),
  "validaHasta" date,
  "estado" text not null default 'borrador', -- borrador, enviada, aprobada, rechazada, vencida
  "moneda" text not null default 'CLP',
  "descuentoGlobalPct" numeric(5,2) not null default 0,
  "impuestoPct" numeric(5,2) not null default 19,
  "subtotal" numeric(14,2) not null default 0,
  "descuentoMonto" numeric(14,2) not null default 0,
  "impuestoMonto" numeric(14,2) not null default 0,
  "total" numeric(14,2) not null default 0,
  "observaciones" text,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);

create unique index if not exists "Cotizacion_numero_key" on "Cotizacion"("numero") where "numero" is not null;
create index if not exists "Cotizacion_clienteId_idx" on "Cotizacion"("clienteId");
create index if not exists "Cotizacion_estado_idx" on "Cotizacion"("estado");

drop trigger if exists trg_cotizacion_updated_at on "Cotizacion";
create trigger trg_cotizacion_updated_at before update on "Cotizacion"
for each row execute function public.set_updated_at();

create or replace function public.fn_set_cotizacion_numero()
returns trigger
language plpgsql
as $$
begin
  if new."numero" is null then
    update "Cotizacion"
    set "numero" = 'COT-' || to_char(coalesce(new."fecha", now()), 'YYYY') || '-' || lpad(new."id"::text, 6, '0')
    where "id" = new."id"
      and "numero" is null;
  end if;
  return null;
end;
$$;

drop trigger if exists trg_cotizacion_numero on "Cotizacion";
create trigger trg_cotizacion_numero
after insert on "Cotizacion"
for each row execute function public.fn_set_cotizacion_numero();

create table if not exists "CotizacionItem" (
  "id" serial primary key,
  "cotizacionId" integer not null references "Cotizacion"("id") on delete cascade,
  "servicioId" integer references "Servicio"("id") on delete set null,
  "equipoId" integer references "Equipo"("id") on delete set null,
  "descripcion" text not null,
  "cantidad" numeric(12,2) not null default 1,
  "precioUnitario" numeric(14,2) not null default 0,
  "descuentoPct" numeric(5,2) not null default 0,
  "lineaTotal" numeric(14,2) generated always as (
    round(("cantidad" * "precioUnitario" * (1 - ("descuentoPct" / 100.0)))::numeric, 2)
  ) stored,
  "orden" integer not null default 1,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);

create index if not exists "CotizacionItem_cotizacionId_idx" on "CotizacionItem"("cotizacionId");

drop trigger if exists trg_cotizacion_item_updated_at on "CotizacionItem";
create trigger trg_cotizacion_item_updated_at before update on "CotizacionItem"
for each row execute function public.set_updated_at();

create or replace function public.fn_recalcular_totales_cotizacion(p_cotizacion_id integer)
returns void
language plpgsql
as $$
declare
  v_subtotal numeric(14,2);
  v_descuento_pct numeric(5,2);
  v_impuesto_pct numeric(5,2);
  v_descuento_monto numeric(14,2);
  v_base numeric(14,2);
  v_impuesto_monto numeric(14,2);
  v_total numeric(14,2);
begin
  select coalesce(sum(ci."lineaTotal"), 0)
  into v_subtotal
  from "CotizacionItem" ci
  where ci."cotizacionId" = p_cotizacion_id;

  select c."descuentoGlobalPct", c."impuestoPct"
  into v_descuento_pct, v_impuesto_pct
  from "Cotizacion" c
  where c."id" = p_cotizacion_id;

  v_descuento_monto := round((v_subtotal * coalesce(v_descuento_pct, 0) / 100.0)::numeric, 2);
  v_base := v_subtotal - v_descuento_monto;
  v_impuesto_monto := round((v_base * coalesce(v_impuesto_pct, 0) / 100.0)::numeric, 2);
  v_total := v_base + v_impuesto_monto;

  update "Cotizacion"
  set
    "subtotal" = v_subtotal,
    "descuentoMonto" = v_descuento_monto,
    "impuestoMonto" = v_impuesto_monto,
    "total" = v_total
  where "id" = p_cotizacion_id;
end;
$$;

create or replace function public.fn_recalcular_totales_cotizacion_trg()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' then
    perform public.fn_recalcular_totales_cotizacion(old."cotizacionId");
    return old;
  else
    perform public.fn_recalcular_totales_cotizacion(new."cotizacionId");
    return new;
  end if;
end;
$$;

drop trigger if exists trg_recalc_totales_cotizacion_item on "CotizacionItem";
create trigger trg_recalc_totales_cotizacion_item
after insert or update or delete on "CotizacionItem"
for each row execute function public.fn_recalcular_totales_cotizacion_trg();

-- ---------------------------------------------------------
-- 6) Vistas rapidas para reportes y calendario
-- ---------------------------------------------------------
create or replace view public."vw_CalendarioVisitas" as
select
  v."id",
  v."codigo",
  v."fechaProgramada",
  v."fechaFinProgramada",
  v."estado",
  v."prioridad",
  c."id" as "clienteId",
  c."nombre" as "cliente",
  t."nombre" as "tecnico",
  s."descripcion" as "servicio",
  coalesce(string_agg(distinct e."nombre", ' | '), e_legacy."nombre") as "equipos"
from "Visita" v
join "Cliente" c on c."id" = v."clienteId"
left join "Tecnico" t on t."id" = v."tecnicoId"
left join "Servicio" s on s."id" = v."servicioId"
left join "VisitaEquipo" ve on ve."visitaId" = v."id"
left join "Equipo" e on e."id" = ve."equipoId"
left join "Equipo" e_legacy on e_legacy."id" = v."equipoId"
group by
  v."id", v."codigo", v."fechaProgramada", v."fechaFinProgramada", v."estado", v."prioridad",
  c."id", c."nombre", t."nombre", s."descripcion", e_legacy."nombre";

create or replace view public."vw_HojaVidaEquipo" as
select
  e."id" as "equipoId",
  e."codigoInterno",
  e."nombre",
  e."modelo",
  e."serial",
  e."estadoOperativo",
  e."criticidad",
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
from "Equipo" e
join "Cliente" c on c."id" = e."clienteId"
left join "EquipoHojaVida" hv on hv."equipoId" = e."id";

create or replace view public."vw_CotizacionesResumen" as
select
  co."id",
  co."numero",
  co."fecha",
  co."estado",
  co."total",
  co."moneda",
  cl."nombre" as "cliente",
  ve."nombre" as "vendedor"
from "Cotizacion" co
join "Cliente" cl on cl."id" = co."clienteId"
left join "Vendedor" ve on ve."id" = co."vendedorId";

-- ---------------------------------------------------------
-- 7) Consultas utiles (ejemplos rapidos)
-- ---------------------------------------------------------
-- 7.1 Equipos con mantencion vencida/proxima (30 dias)
-- select *
-- from "Equipo"
-- where "proximaMantencion" is not null
--   and "proximaMantencion" <= now() + interval '30 days'
-- order by "proximaMantencion" asc;

-- 7.2 Agenda semanal de visitas
-- select *
-- from public."vw_CalendarioVisitas"
-- where "fechaProgramada" >= date_trunc('week', now())
--   and "fechaProgramada" < date_trunc('week', now()) + interval '7 days'
-- order by "fechaProgramada" asc;

-- 7.3 Hoja de vida de un equipo
-- select *
-- from public."vw_HojaVidaEquipo"
-- where "equipoId" = 1
-- order by "fechaEvento" desc nulls last;

-- 7.4 Cotizaciones pendientes
-- select *
-- from public."vw_CotizacionesResumen"
-- where "estado" in ('borrador', 'enviada')
-- order by "fecha" desc;

commit;
