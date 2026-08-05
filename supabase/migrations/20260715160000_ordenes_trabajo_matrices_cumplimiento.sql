-- =========================================================
-- CMCing - Ordenes de trabajo, actividades y cumplimiento
-- Ejecutar en Supabase SQL Editor o mediante una conexion DDL.
-- =========================================================

begin;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new."updatedAt" = now();
  return new;
end;
$$;

-- ---------------------------------------------------------
-- 1) Orden de trabajo
-- ---------------------------------------------------------
create table if not exists "OrdenTrabajo" (
  "id" serial primary key,
  "codigo" text,
  "titulo" text not null,
  "descripcion" text,
  "clienteId" integer not null references "Cliente"("id") on delete restrict,
  "equipoId" integer references "Equipo"("id") on delete set null,
  "prioridad" text not null default 'media' check ("prioridad" in ('baja', 'media', 'alta', 'critica')),
  "estado" text not null default 'abierta' check ("estado" in ('abierta', 'cerrada', 'cancelada')),
  "fechaApertura" timestamptz not null default now(),
  "fechaProgramada" timestamptz,
  "fechaCierre" timestamptz,
  "createdByUsuarioId" integer references "Usuario"("id") on delete set null,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);

create unique index if not exists "OrdenTrabajo_codigo_key"
on "OrdenTrabajo"("codigo") where "codigo" is not null;
create index if not exists "OrdenTrabajo_clienteId_idx" on "OrdenTrabajo"("clienteId");
create index if not exists "OrdenTrabajo_equipoId_idx" on "OrdenTrabajo"("equipoId");
create index if not exists "OrdenTrabajo_estado_idx" on "OrdenTrabajo"("estado");
create index if not exists "OrdenTrabajo_fechaProgramada_idx" on "OrdenTrabajo"("fechaProgramada");

drop trigger if exists trg_orden_trabajo_updated_at on "OrdenTrabajo";
create trigger trg_orden_trabajo_updated_at before update on "OrdenTrabajo"
for each row execute function public.set_updated_at();

create or replace function public.fn_set_orden_trabajo_codigo()
returns trigger
language plpgsql
as $$
begin
  if new."codigo" is null then
    update "OrdenTrabajo"
    set "codigo" = 'OT-' || to_char(coalesce(new."fechaApertura", now()), 'YYYY') || '-' || lpad(new."id"::text, 6, '0')
    where "id" = new."id" and "codigo" is null;
  end if;
  return null;
end;
$$;

drop trigger if exists trg_orden_trabajo_codigo on "OrdenTrabajo";
create trigger trg_orden_trabajo_codigo
after insert on "OrdenTrabajo"
for each row execute function public.fn_set_orden_trabajo_codigo();

-- ---------------------------------------------------------
-- 2) Actividades ejecutables y auditoria total
-- ---------------------------------------------------------
create table if not exists "OrdenTrabajoActividad" (
  "id" serial primary key,
  "ordenTrabajoId" integer not null references "OrdenTrabajo"("id") on delete cascade,
  "actividadId" integer references "Actividad"("id") on delete set null,
  "tecnicoId" integer not null references "Tecnico"("id") on delete restrict,
  "titulo" text not null,
  "descripcionBreve" text,
  "notasTecnico" text,
  "estado" text not null default 'abierta' check ("estado" in ('abierta', 'cerrada')),
  "fechaProgramada" timestamptz,
  "fechaInicio" timestamptz,
  "fechaCierre" timestamptz,
  "bloqueada" boolean not null default false,
  "bloqueadaAt" timestamptz,
  "desbloqueadaAt" timestamptz,
  "motivoDesbloqueo" text,
  "createdByUsuarioId" integer references "Usuario"("id") on delete set null,
  "updatedByUsuarioId" integer references "Usuario"("id") on delete set null,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);

create index if not exists "OrdenTrabajoActividad_ordenTrabajoId_idx" on "OrdenTrabajoActividad"("ordenTrabajoId");
create index if not exists "OrdenTrabajoActividad_tecnicoId_idx" on "OrdenTrabajoActividad"("tecnicoId");
create index if not exists "OrdenTrabajoActividad_estado_idx" on "OrdenTrabajoActividad"("estado");
create index if not exists "OrdenTrabajoActividad_fechaProgramada_idx" on "OrdenTrabajoActividad"("fechaProgramada");

drop trigger if exists trg_ot_actividad_updated_at on "OrdenTrabajoActividad";
create trigger trg_ot_actividad_updated_at before update on "OrdenTrabajoActividad"
for each row execute function public.set_updated_at();

create table if not exists "ActividadAuditoria" (
  "id" bigserial primary key,
  "ordenTrabajoActividadId" integer not null references "OrdenTrabajoActividad"("id") on delete cascade,
  "accion" text not null check ("accion" in ('CREACION', 'ACTUALIZACION', 'CIERRE', 'DESBLOQUEO')),
  "actorUsuarioId" integer references "Usuario"("id") on delete set null,
  "motivo" text,
  "datosAntes" jsonb,
  "datosDespues" jsonb,
  "createdAt" timestamptz not null default now()
);

create index if not exists "ActividadAuditoria_actividad_idx"
on "ActividadAuditoria"("ordenTrabajoActividadId", "createdAt" desc);

create or replace function public.fn_proteger_ot_actividad_bloqueada()
returns trigger
language plpgsql
as $$
begin
  if old."bloqueada" = true
     and coalesce(current_setting('cmcing.activity_unlock', true), '') <> '1' then
    raise exception 'La actividad esta cerrada y bloqueada. Debe ser desbloqueada por un administrador.'
      using errcode = '42501';
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_proteger_ot_actividad_bloqueada on "OrdenTrabajoActividad";
create trigger trg_proteger_ot_actividad_bloqueada
before update or delete on "OrdenTrabajoActividad"
for each row execute function public.fn_proteger_ot_actividad_bloqueada();

create or replace function public.fn_auditar_ot_actividad()
returns trigger
language plpgsql
as $$
declare
  v_accion text;
  v_actor integer;
  v_motivo text;
begin
  if tg_op = 'INSERT' then
    v_accion := 'CREACION';
    v_actor := new."createdByUsuarioId";
    insert into "ActividadAuditoria" (
      "ordenTrabajoActividadId", "accion", "actorUsuarioId", "datosDespues"
    ) values (
      new."id", v_accion, v_actor, to_jsonb(new)
    );
    return new;
  end if;

  v_actor := coalesce(new."updatedByUsuarioId", new."createdByUsuarioId");
  if old."estado" is distinct from new."estado" and new."estado" = 'cerrada' then
    v_accion := 'CIERRE';
    v_motivo := 'Cierre de actividad';
  elsif old."bloqueada" = true and new."bloqueada" = false then
    v_accion := 'DESBLOQUEO';
    v_motivo := new."motivoDesbloqueo";
  else
    v_accion := 'ACTUALIZACION';
  end if;

  insert into "ActividadAuditoria" (
    "ordenTrabajoActividadId", "accion", "actorUsuarioId", "motivo", "datosAntes", "datosDespues"
  ) values (
    new."id", v_accion, v_actor, v_motivo, to_jsonb(old), to_jsonb(new)
  );
  return new;
end;
$$;

drop trigger if exists trg_auditar_ot_actividad_insert on "OrdenTrabajoActividad";
create trigger trg_auditar_ot_actividad_insert
after insert on "OrdenTrabajoActividad"
for each row execute function public.fn_auditar_ot_actividad();

drop trigger if exists trg_auditar_ot_actividad_update on "OrdenTrabajoActividad";
create trigger trg_auditar_ot_actividad_update
after update on "OrdenTrabajoActividad"
for each row execute function public.fn_auditar_ot_actividad();

create or replace function public.desbloquear_orden_trabajo_actividad(
  p_actividad_id integer,
  p_actor_usuario_id integer,
  p_motivo text
)
returns setof "OrdenTrabajoActividad"
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actividad "OrdenTrabajoActividad"%rowtype;
begin
  if length(trim(coalesce(p_motivo, ''))) < 10 then
    raise exception 'El motivo de desbloqueo debe tener al menos 10 caracteres.';
  end if;

  select * into v_actividad
  from "OrdenTrabajoActividad"
  where "id" = p_actividad_id
  for update;

  if not found then
    raise exception 'Actividad no encontrada.';
  end if;

  if v_actividad."bloqueada" = false then
    raise exception 'La actividad no esta bloqueada.';
  end if;

  perform set_config('cmcing.activity_unlock', '1', true);

  return query
  update "OrdenTrabajoActividad"
  set
    "estado" = 'abierta',
    "bloqueada" = false,
    "desbloqueadaAt" = now(),
    "motivoDesbloqueo" = trim(p_motivo),
    "updatedByUsuarioId" = p_actor_usuario_id
  where "id" = p_actividad_id
  returning *;
end;
$$;

-- ---------------------------------------------------------
-- 3) Catalogo de mediciones y matrices de cumplimiento
-- ---------------------------------------------------------
create table if not exists "MedicionCatalogo" (
  "id" serial primary key,
  "nombre" text not null,
  "unidad" text,
  "simbolo" text,
  "descripcion" text,
  "activa" boolean not null default true,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);

create unique index if not exists "MedicionCatalogo_nombre_unidad_key"
on "MedicionCatalogo"(lower("nombre"), lower(coalesce("unidad", '')));

drop trigger if exists trg_medicion_catalogo_updated_at on "MedicionCatalogo";
create trigger trg_medicion_catalogo_updated_at before update on "MedicionCatalogo"
for each row execute function public.set_updated_at();

create table if not exists "MatrizCumplimiento" (
  "id" serial primary key,
  "nombre" text not null,
  "descripcion" text,
  "categoria" text not null check ("categoria" in ('evaluacion', 'informe_resultado')),
  "version" integer not null default 1 check ("version" > 0),
  "activa" boolean not null default true,
  "createdByUsuarioId" integer references "Usuario"("id") on delete set null,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);

create index if not exists "MatrizCumplimiento_categoria_idx" on "MatrizCumplimiento"("categoria");

drop trigger if exists trg_matriz_cumplimiento_updated_at on "MatrizCumplimiento";
create trigger trg_matriz_cumplimiento_updated_at before update on "MatrizCumplimiento"
for each row execute function public.set_updated_at();

create table if not exists "MatrizItem" (
  "id" serial primary key,
  "matrizId" integer not null references "MatrizCumplimiento"("id") on delete cascade,
  "titulo" text not null,
  "descripcion" text,
  "tipoRespuesta" text not null check ("tipoRespuesta" in ('numero', 'dicotomica', 'seleccion_multiple', 'texto')),
  "medicionId" integer references "MedicionCatalogo"("id") on delete set null,
  "opciones" jsonb not null default '[]'::jsonb,
  "requerido" boolean not null default true,
  "orden" integer not null default 1,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now(),
  unique ("matrizId", "orden")
);

create index if not exists "MatrizItem_matrizId_idx" on "MatrizItem"("matrizId");

drop trigger if exists trg_matriz_item_updated_at on "MatrizItem";
create trigger trg_matriz_item_updated_at before update on "MatrizItem"
for each row execute function public.set_updated_at();

create or replace function public.fn_matriz_item_tipo_inmutable()
returns trigger
language plpgsql
as $$
begin
  if new."tipoRespuesta" is distinct from old."tipoRespuesta" then
    raise exception 'El tipo de respuesta de un item de matriz no puede modificarse una vez creado.';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_matriz_item_tipo_inmutable on "MatrizItem";
create trigger trg_matriz_item_tipo_inmutable
before update on "MatrizItem"
for each row execute function public.fn_matriz_item_tipo_inmutable();

create table if not exists "ActividadMatrizDefault" (
  "id" serial primary key,
  "actividadId" integer not null references "Actividad"("id") on delete cascade,
  "matrizId" integer not null references "MatrizCumplimiento"("id") on delete cascade,
  "createdAt" timestamptz not null default now(),
  unique ("actividadId", "matrizId")
);

create table if not exists "ActividadMatrizAsignada" (
  "id" serial primary key,
  "ordenTrabajoActividadId" integer not null references "OrdenTrabajoActividad"("id") on delete cascade,
  "matrizId" integer not null references "MatrizCumplimiento"("id") on delete restrict,
  "origen" text not null default 'manual' check ("origen" in ('default', 'manual')),
  "obligatoria" boolean not null default true,
  "estado" text not null default 'pendiente' check ("estado" in ('pendiente', 'completa')),
  "completedAt" timestamptz,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now(),
  unique ("ordenTrabajoActividadId", "matrizId")
);

create index if not exists "ActividadMatrizAsignada_actividad_idx"
on "ActividadMatrizAsignada"("ordenTrabajoActividadId");

drop trigger if exists trg_actividad_matriz_asignada_updated_at on "ActividadMatrizAsignada";
create trigger trg_actividad_matriz_asignada_updated_at before update on "ActividadMatrizAsignada"
for each row execute function public.set_updated_at();

create table if not exists "ActividadMatrizRespuesta" (
  "id" bigserial primary key,
  "actividadMatrizAsignadaId" integer not null references "ActividadMatrizAsignada"("id") on delete cascade,
  "matrizItemId" integer not null references "MatrizItem"("id") on delete cascade,
  "valorNumero" numeric,
  "valorBooleano" boolean,
  "valorTexto" text,
  "valorOpciones" jsonb,
  "respondidoByUsuarioId" integer references "Usuario"("id") on delete set null,
  "respondidoAt" timestamptz not null default now(),
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now(),
  unique ("actividadMatrizAsignadaId", "matrizItemId")
);

create index if not exists "ActividadMatrizRespuesta_asignacion_idx"
on "ActividadMatrizRespuesta"("actividadMatrizAsignadaId");

drop trigger if exists trg_actividad_matriz_respuesta_updated_at on "ActividadMatrizRespuesta";
create trigger trg_actividad_matriz_respuesta_updated_at before update on "ActividadMatrizRespuesta"
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------
-- 4) Las imagenes y otros adjuntos pertenecen a la actividad
-- ---------------------------------------------------------
alter table "ArchivoAdjunto"
add column if not exists "ordenTrabajoActividadId" integer;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'ArchivoAdjunto_ordenTrabajoActividadId_fkey'
  ) then
    alter table "ArchivoAdjunto"
    add constraint "ArchivoAdjunto_ordenTrabajoActividadId_fkey"
    foreign key ("ordenTrabajoActividadId")
    references "OrdenTrabajoActividad"("id")
    on delete cascade;
  end if;
end;
$$;

create index if not exists "ArchivoAdjunto_ordenTrabajoActividadId_idx"
on "ArchivoAdjunto"("ordenTrabajoActividadId");

create or replace function public.registrar_adjunto_actividad(
  p_actividad_id integer,
  p_actor_usuario_id integer,
  p_archivo jsonb
)
returns setof "ArchivoAdjunto"
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actividad "OrdenTrabajoActividad"%rowtype;
  v_adjunto "ArchivoAdjunto"%rowtype;
begin
  select * into v_actividad
  from "OrdenTrabajoActividad"
  where "id" = p_actividad_id
  for update;

  if not found then
    raise exception 'Actividad no encontrada.' using errcode = 'P0002';
  end if;
  if v_actividad."bloqueada" = true then
    raise exception 'La actividad esta cerrada y no admite imagenes.' using errcode = '42501';
  end if;
  if nullif(trim(p_archivo->>'nombreOriginal'), '') is null
     or nullif(trim(p_archivo->>'r2Key'), '') is null then
    raise exception 'Faltan datos obligatorios del archivo.' using errcode = '22023';
  end if;

  insert into "ArchivoAdjunto" (
    "ordenTrabajoActividadId", "tecnicoId", "tipo", "nombreOriginal", "mimeType",
    "sizeBytes", "r2Bucket", "r2Key", "publicUrl", "checksumSha256", "metadata"
  ) values (
    p_actividad_id,
    v_actividad."tecnicoId",
    coalesce(nullif(p_archivo->>'tipo', ''), 'imagen_actividad'),
    p_archivo->>'nombreOriginal',
    coalesce(nullif(p_archivo->>'mimeType', ''), 'application/octet-stream'),
    nullif(p_archivo->>'sizeBytes', '')::integer,
    p_archivo->>'r2Bucket',
    p_archivo->>'r2Key',
    null,
    p_archivo->>'checksumSha256',
    coalesce(p_archivo->'metadata', '{}'::jsonb)
  )
  returning * into v_adjunto;

  insert into "ActividadAuditoria" (
    "ordenTrabajoActividadId", "accion", "actorUsuarioId", "motivo", "datosDespues"
  ) values (
    p_actividad_id,
    'ACTUALIZACION',
    p_actor_usuario_id,
    'Imagen agregada: ' || v_adjunto."nombreOriginal",
    jsonb_build_object(
      'archivoAdjuntoId', v_adjunto."id",
      'nombreOriginal', v_adjunto."nombreOriginal",
      'mimeType', v_adjunto."mimeType",
      'r2Key', v_adjunto."r2Key"
    )
  );

  return next v_adjunto;
end;
$$;

-- Tipos iniciales de actividad. No se duplican por nombre.
insert into "Actividad" ("nombre", "descripcion", "tipo", "duracionEstimadaMin", "obligatoria", "activa")
select seed."nombre", seed."descripcion", seed."tipo", seed."duracion", false, true
from (values
  ('Visita a terreno', 'Actividad ejecutada en las instalaciones del cliente.', 'terreno', 120),
  ('Recepcion en laboratorio CMC', 'Recepcion y registro inicial del equipo en laboratorio.', 'laboratorio', 30),
  ('Evaluacion en terreno', 'Evaluacion tecnica y registro del estado inicial en terreno.', 'evaluacion', 90),
  ('Asistencia remota', 'Diagnostico o soporte realizado por canales remotos.', 'remota', 60),
  ('Entrega de equipo', 'Entrega, conformidad y registro del estado final del equipo.', 'entrega', 45)
) as seed("nombre", "descripcion", "tipo", "duracion")
where not exists (
  select 1 from "Actividad" a where lower(a."nombre") = lower(seed."nombre")
);

commit;
