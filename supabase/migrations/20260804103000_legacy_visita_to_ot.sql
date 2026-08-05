-- =========================================================
-- CMCing CMMS produccion - migracion legacy Visita -> OT
-- Dependencia: 20260804102000_offline_sync_rpc.sql
--
-- No elimina ni reescribe Visita/VisitaActividad. Crea relaciones explicitas,
-- conserva adjuntos y deja una fila de control por visita migrada.
-- =========================================================

begin;

alter table public."OrdenTrabajo"
  add column if not exists "legacyVisitaId" integer;

alter table public."OrdenTrabajoActividad"
  add column if not exists "legacyVisitaActividadId" integer,
  add column if not exists "legacyVisitaId" integer;

do $migration$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public."OrdenTrabajo"'::regclass
      and conname = 'OrdenTrabajo_legacyVisitaId_fkey'
  ) then
    alter table public."OrdenTrabajo"
      add constraint "OrdenTrabajo_legacyVisitaId_fkey"
      foreign key ("legacyVisitaId") references public."Visita"("id") on delete restrict;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public."OrdenTrabajoActividad"'::regclass
      and conname = 'OrdenTrabajoActividad_legacyVisitaActividadId_fkey'
  ) then
    alter table public."OrdenTrabajoActividad"
      add constraint "OrdenTrabajoActividad_legacyVisitaActividadId_fkey"
      foreign key ("legacyVisitaActividadId")
      references public."VisitaActividad"("id") on delete restrict;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public."OrdenTrabajoActividad"'::regclass
      and conname = 'OrdenTrabajoActividad_legacyVisitaId_fkey'
  ) then
    alter table public."OrdenTrabajoActividad"
      add constraint "OrdenTrabajoActividad_legacyVisitaId_fkey"
      foreign key ("legacyVisitaId") references public."Visita"("id") on delete restrict;
  end if;
end;
$migration$;

create unique index if not exists "OrdenTrabajo_legacyVisitaId_key"
  on public."OrdenTrabajo"("legacyVisitaId")
  where "legacyVisitaId" is not null;
create unique index if not exists "OrdenTrabajoActividad_legacyVisitaActividadId_key"
  on public."OrdenTrabajoActividad"("legacyVisitaActividadId")
  where "legacyVisitaActividadId" is not null;
create unique index if not exists "OrdenTrabajoActividad_legacyVisitaId_key"
  on public."OrdenTrabajoActividad"("legacyVisitaId")
  where "legacyVisitaId" is not null;

-- La OT admite multiples equipos; equipoId legacy sigue siendo el principal.
create table if not exists public."OrdenTrabajoEquipo" (
  "id" bigserial primary key,
  "ordenTrabajoId" integer not null
    references public."OrdenTrabajo"("id") on delete restrict,
  "equipoId" integer not null
    references public."Equipo"("id") on delete restrict,
  "principal" boolean not null default false,
  "origen" text not null default 'MANUAL'
    check ("origen" in ('MANUAL', 'VISITA_LEGACY')),
  "createdAt" timestamptz not null default now(),
  unique ("ordenTrabajoId", "equipoId")
);

create index if not exists "OrdenTrabajoEquipo_equipo_idx"
  on public."OrdenTrabajoEquipo"("equipoId", "ordenTrabajoId");

create unique index if not exists "OrdenTrabajoEquipo_one_primary_key"
  on public."OrdenTrabajoEquipo"("ordenTrabajoId")
  where "principal";

create table if not exists public."MigracionLegacyVisitaOT" (
  "visitaId" integer primary key references public."Visita"("id") on delete restrict,
  "ordenTrabajoId" integer not null unique
    references public."OrdenTrabajo"("id") on delete restrict,
  "activityCount" integer not null,
  "attachmentCount" integer not null,
  "sourceSnapshot" jsonb not null,
  "migratedAt" timestamptz not null default now()
);

-- 1) Cabecera OT. El codigo LEG evita colisiones con la secuencia OT normal y
-- permite rastrear visualmente el origen sin reemplazar el ID canonico.
insert into public."OrdenTrabajo" (
  "codigo", "titulo", "descripcion", "clienteId", "equipoId", "prioridad",
  "estado", "fechaApertura", "fechaProgramada", "fechaCierre",
  "createdAt", "updatedAt", "legacyVisitaId"
)
select
  'OT-LEG-' || lpad(v."id"::text, 8, '0'),
  'Servicio legacy ' || coalesce(nullif(v."codigo", ''), 'VIS-' || v."id"::text),
  coalesce(v."descripcion", v."notasTecnicas"),
  v."clienteId",
  v."equipoId",
  case lower(coalesce(v."prioridad", 'media'))
    when 'baja' then 'baja'
    when 'alta' then 'alta'
    when 'critica' then 'critica'
    else 'media'
  end,
  case
    when lower(coalesce(v."estado", '')) in ('completada', 'completado', 'cerrada', 'cerrado', 'finalizada', 'finalizado') then 'cerrada'
    when lower(coalesce(v."estado", '')) in ('cancelada', 'cancelado', 'anulada', 'anulado') then 'cancelada'
    else 'abierta'
  end,
  coalesce(v."fechaInicio", v."fechaProgramada", v."fecha"::timestamptz, v."createdAt", now()),
  coalesce(v."fechaProgramada", v."fecha"::timestamptz),
  case
    when lower(coalesce(v."estado", '')) in ('completada', 'completado', 'cerrada', 'cerrado', 'finalizada', 'finalizado')
      then coalesce(v."fechaCierre", v."updatedAt", now())
    else null
  end,
  v."createdAt",
  v."updatedAt",
  v."id"
from public."Visita" v
where not exists (
  select 1 from public."OrdenTrabajo" ot where ot."legacyVisitaId" = v."id"
);

-- 2) Equipos multiples de la visita y equipo principal legacy.
insert into public."OrdenTrabajoEquipo" (
  "ordenTrabajoId", "equipoId", "principal", "origen"
)
select
  ot."id",
  ve."equipoId",
  (ve."equipoId" = v."equipoId") as "principal",
  'VISITA_LEGACY'
from public."OrdenTrabajo" ot
join public."Visita" v on v."id" = ot."legacyVisitaId"
join public."VisitaEquipo" ve on ve."visitaId" = v."id"
on conflict ("ordenTrabajoId", "equipoId") do nothing;

insert into public."OrdenTrabajoEquipo" (
  "ordenTrabajoId", "equipoId", "principal", "origen"
)
select ot."id", v."equipoId", true, 'VISITA_LEGACY'
from public."OrdenTrabajo" ot
join public."Visita" v on v."id" = ot."legacyVisitaId"
where v."equipoId" is not null
on conflict ("ordenTrabajoId", "equipoId") do update
set "principal" = true;

-- Si una visita no tenia equipoId principal, elegimos deterministicamente el
-- primero para que cada OT con equipos tenga exactamente un principal.
with missing_primary as (
  select ote."ordenTrabajoId", min(ote."id") as "selectedId"
  from public."OrdenTrabajoEquipo" ote
  group by ote."ordenTrabajoId"
  having not bool_or(ote."principal")
)
update public."OrdenTrabajoEquipo" ote
set "principal" = true
from missing_primary mp
where ote."id" = mp."selectedId";

-- 3) Actividades legacy. Se insertan abiertas para poder relacionar adjuntos;
-- al final de la transaccion se restaura el cierre/bloqueo original.
-- Si una base antigua contiene visitas huerfanas, se conserva la trazabilidad
-- bajo un tecnico de sistema inactivo en vez de perder filas o abortar todo el
-- backfill.
insert into public."Tecnico" (
  "nombre", "especialidad", "email", "activo", "createdAt", "updatedAt"
)
select
  '[Sistema] Tecnico legacy sin asignar',
  'Migracion de datos',
  'legacy-unassigned@cmcing.invalid',
  false,
  now(),
  now()
where exists (
  select 1
  from public."Visita" v
  where v."tecnicoId" is null
     or not exists (select 1 from public."Tecnico" t where t."id" = v."tecnicoId")
)
and not exists (
  select 1 from public."Tecnico" t where lower(t."email") = 'legacy-unassigned@cmcing.invalid'
);

insert into public."OrdenTrabajoActividad" (
  "ordenTrabajoId", "actividadId", "tecnicoId", "titulo", "descripcionBreve",
  "notasTecnico", "estado", "fechaProgramada", "fechaInicio", "fechaCierre",
  "bloqueada", "createdAt", "updatedAt", "legacyVisitaActividadId"
)
select
  ot."id",
  va."actividadId",
  coalesce(
    (select t."id" from public."Tecnico" t where t."id" = va."responsableTecnicoId"),
    (select t."id" from public."Tecnico" t where t."id" = v."tecnicoId"),
    (select t."id" from public."Tecnico" t where lower(t."email") = 'legacy-unassigned@cmcing.invalid' limit 1)
  ),
  va."titulo",
  va."descripcion",
  va."observaciones",
  'abierta',
  coalesce(va."fechaProgramada", v."fechaProgramada", v."fecha"::timestamptz),
  va."fechaReal",
  null,
  false,
  va."createdAt",
  va."updatedAt",
  va."id"
from public."VisitaActividad" va
join public."Visita" v on v."id" = va."visitaId"
join public."OrdenTrabajo" ot on ot."legacyVisitaId" = v."id"
where not exists (
  select 1
  from public."OrdenTrabajoActividad" ota
  where ota."legacyVisitaActividadId" = va."id"
);

-- Visitas sin checklist reciben una actividad sintetica. Si ya tenian
-- checklist pero tambien adjuntos a nivel visita, se crea una actividad de
-- evidencia general para no asociar esas fotos arbitrariamente a otro trabajo.
insert into public."OrdenTrabajoActividad" (
  "ordenTrabajoId", "actividadId", "tecnicoId", "titulo", "descripcionBreve",
  "notasTecnico", "estado", "fechaProgramada", "fechaInicio", "fechaCierre",
  "bloqueada", "createdAt", "updatedAt", "legacyVisitaId"
)
select
  ot."id",
  null,
  coalesce(
    (select t."id" from public."Tecnico" t where t."id" = v."tecnicoId"),
    (select t."id" from public."Tecnico" t where lower(t."email") = 'legacy-unassigned@cmcing.invalid' limit 1)
  ),
  case
    when exists (select 1 from public."VisitaActividad" va where va."visitaId" = v."id")
      then 'Evidencia general de visita legacy'
    else coalesce(nullif(v."tipoVisita", ''), 'Visita tecnica')
  end,
  v."descripcion",
  v."notasTecnicas",
  'abierta',
  coalesce(v."fechaProgramada", v."fecha"::timestamptz),
  v."fechaInicio",
  null,
  false,
  v."createdAt",
  v."updatedAt",
  v."id"
from public."Visita" v
join public."OrdenTrabajo" ot on ot."legacyVisitaId" = v."id"
where (
  not exists (select 1 from public."VisitaActividad" va where va."visitaId" = v."id")
  or exists (
    select 1
    from public."ArchivoAdjunto" f
    where f."visitaId" = v."id"
      and f."visitaActividadId" is null
      and f."ordenTrabajoActividadId" is null
  )
)
and not exists (
  select 1 from public."OrdenTrabajoActividad" ota where ota."legacyVisitaId" = v."id"
);

-- 4) Las evidencias pasan a pertenecer a la actividad correspondiente, pero
-- se conservan visitaId/visitaActividadId como referencias historicas.
update public."ArchivoAdjunto" f
set "ordenTrabajoActividadId" = ota."id"
from public."OrdenTrabajoActividad" ota
where ota."legacyVisitaActividadId" = f."visitaActividadId"
  and f."visitaActividadId" is not null
  and f."ordenTrabajoActividadId" is null;

update public."ArchivoAdjunto" f
set "ordenTrabajoActividadId" = ota."id"
from public."OrdenTrabajoActividad" ota
where ota."legacyVisitaId" = f."visitaId"
  and f."visitaId" is not null
  and f."visitaActividadId" is null
  and f."ordenTrabajoActividadId" is null;

do $migration$
begin
  if exists (
    select 1
    from public."ArchivoAdjunto" f
    join public."OrdenTrabajo" ot on ot."legacyVisitaId" = f."visitaId"
    where f."ordenTrabajoActividadId" is null
  ) then
    raise exception 'Quedaron adjuntos legacy sin actividad OT; revisar integridad de Visita/VisitaActividad.';
  end if;
end;
$migration$;

-- 5) Restituye estado cerrado/bloqueado tras completar relaciones hijas.
update public."OrdenTrabajoActividad" ota
set
  "estado" = 'cerrada',
  "fechaCierre" = coalesce(va."fechaReal", v."fechaCierre", va."updatedAt", now()),
  "bloqueada" = true,
  "bloqueadaAt" = coalesce(va."fechaReal", v."fechaCierre", va."updatedAt", now()),
  "updatedAt" = greatest(ota."updatedAt", va."updatedAt")
from public."VisitaActividad" va
join public."Visita" v on v."id" = va."visitaId"
where ota."legacyVisitaActividadId" = va."id"
  and not ota."bloqueada"
  and (
    lower(coalesce(va."estado", '')) in ('completada', 'completado', 'cerrada', 'cerrado', 'finalizada', 'finalizado')
    or lower(coalesce(v."estado", '')) in ('completada', 'completado', 'cerrada', 'cerrado', 'finalizada', 'finalizado')
  );

update public."OrdenTrabajoActividad" ota
set
  "estado" = 'cerrada',
  "fechaCierre" = coalesce(v."fechaCierre", v."updatedAt", now()),
  "bloqueada" = true,
  "bloqueadaAt" = coalesce(v."fechaCierre", v."updatedAt", now()),
  "updatedAt" = greatest(ota."updatedAt", v."updatedAt")
from public."Visita" v
where ota."legacyVisitaId" = v."id"
  and not ota."bloqueada"
  and lower(coalesce(v."estado", '')) in ('completada', 'completado', 'cerrada', 'cerrado', 'finalizada', 'finalizado');

-- 6) Receipt de migracion. sourceSnapshot contiene solo datos operacionales,
-- no secretos, hashes de password ni contenido binario.
insert into public."MigracionLegacyVisitaOT" (
  "visitaId", "ordenTrabajoId", "activityCount", "attachmentCount", "sourceSnapshot"
)
select
  v."id",
  ot."id",
  (select count(*)::integer from public."OrdenTrabajoActividad" a where a."ordenTrabajoId" = ot."id"),
  (
    select count(*)::integer
    from public."ArchivoAdjunto" f
    join public."OrdenTrabajoActividad" a on a."id" = f."ordenTrabajoActividadId"
    where a."ordenTrabajoId" = ot."id"
  ),
  jsonb_build_object(
    'visitaId', v."id",
    'codigo', v."codigo",
    'estado', v."estado",
    'updatedAt', v."updatedAt"
  )
from public."Visita" v
join public."OrdenTrabajo" ot on ot."legacyVisitaId" = v."id"
on conflict ("visitaId") do update
set
  "ordenTrabajoId" = excluded."ordenTrabajoId",
  "activityCount" = excluded."activityCount",
  "attachmentCount" = excluded."attachmentCount",
  "sourceSnapshot" = excluded."sourceSnapshot",
  "migratedAt" = now();

comment on column public."OrdenTrabajo"."legacyVisitaId" is
  'Relacion reversible y no destructiva a Visita durante la transicion al modelo OT.';

commit;
