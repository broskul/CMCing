-- =========================================================
-- CMCing offline tecnico + auth directa + adjuntos R2
-- Ejecutar despues de 20260529131254_cmms_mvp.sql
-- =========================================================

begin;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'RolUsuario') then
    create type "RolUsuario" as enum ('ADMIN', 'OPERACIONES', 'TECNICO', 'LECTURA');
  end if;

  if not exists (select 1 from pg_type where typname = 'EstadoSync') then
    create type "EstadoSync" as enum ('PENDIENTE', 'SUBIENDO', 'SINCRONIZADO', 'ERROR');
  end if;
end;
$$;

-- ---------------------------------------------------------
-- 1) Auth directa usuario/password
-- ---------------------------------------------------------
create table if not exists "Usuario" (
  "id" serial primary key,
  "nombre" text not null,
  "email" text not null unique,
  "passwordHash" text not null,
  "rol" "RolUsuario" not null default 'OPERACIONES',
  "tecnicoId" integer unique references "Tecnico"("id") on delete set null,
  "activo" boolean not null default true,
  "lastLoginAt" timestamptz,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);

drop trigger if exists trg_usuario_updated_at on "Usuario";
create trigger trg_usuario_updated_at before update on "Usuario"
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------
-- 2) Busqueda de equipo y firma persistente por tecnico
-- ---------------------------------------------------------
alter table "Equipo" add column if not exists "sku" text;
alter table "Equipo" add column if not exists "imagenUrl" text;
create index if not exists "Equipo_sku_idx" on "Equipo"("sku");
create index if not exists "Equipo_nombre_trgm_idx" on "Equipo" using gin ("nombre" gin_trgm_ops);
create index if not exists "Equipo_serial_trgm_idx" on "Equipo" using gin ("serial" gin_trgm_ops);
create index if not exists "Equipo_sku_trgm_idx" on "Equipo" using gin ("sku" gin_trgm_ops);

alter table "Tecnico" add column if not exists "firmaTexto" text;
alter table "Tecnico" add column if not exists "firmaImagenUrl" text;
alter table "Tecnico" add column if not exists "firmaImagenR2Key" text;
alter table "Tecnico" add column if not exists "firmaUpdatedAt" timestamptz;
alter table "Tecnico" add column if not exists "activo" boolean not null default true;

-- ---------------------------------------------------------
-- 3) Visita firmada, idempotencia offline y estado de sync
-- ---------------------------------------------------------
alter table "Visita" add column if not exists "fechaInicio" timestamptz;
alter table "Visita" add column if not exists "clienteMutationId" text;
alter table "Visita" add column if not exists "offlineEstado" "EstadoSync" not null default 'SINCRONIZADO';
alter table "Visita" add column if not exists "signedAt" timestamptz;
alter table "Visita" add column if not exists "firmaTecnicoTexto" text;
alter table "Visita" add column if not exists "firmaTecnicoImagenUrl" text;
alter table "Visita" add column if not exists "selfieAdjuntoId" integer;

create unique index if not exists "Visita_clienteMutationId_key"
on "Visita"("clienteMutationId")
where "clienteMutationId" is not null;

create index if not exists "Visita_offlineEstado_idx" on "Visita"("offlineEstado");

-- ---------------------------------------------------------
-- 4) Cola de sincronizacion servidor-side
-- ---------------------------------------------------------
create table if not exists "ColaSincronizacion" (
  "id" serial primary key,
  "clientMutationId" text not null unique,
  "usuarioId" integer references "Usuario"("id") on delete set null,
  "tecnicoId" integer references "Tecnico"("id") on delete set null,
  "visitaId" integer references "Visita"("id") on delete set null,
  "entidad" text not null,
  "accion" text not null,
  "estado" "EstadoSync" not null default 'PENDIENTE',
  "payload" jsonb not null,
  "error" text,
  "attempts" integer not null default 0,
  "queuedAt" timestamptz not null default now(),
  "syncedAt" timestamptz,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);

create index if not exists "ColaSincronizacion_estado_idx" on "ColaSincronizacion"("estado");
create index if not exists "ColaSincronizacion_tecnicoId_idx" on "ColaSincronizacion"("tecnicoId");
create index if not exists "ColaSincronizacion_queuedAt_idx" on "ColaSincronizacion"("queuedAt");

drop trigger if exists trg_cola_sincronizacion_updated_at on "ColaSincronizacion";
create trigger trg_cola_sincronizacion_updated_at before update on "ColaSincronizacion"
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------
-- 5) Adjuntos: evidencia, firma y selfie en Cloudflare R2
-- ---------------------------------------------------------
create table if not exists "ArchivoAdjunto" (
  "id" serial primary key,
  "visitaId" integer references "Visita"("id") on delete cascade,
  "visitaActividadId" integer references "VisitaActividad"("id") on delete cascade,
  "tecnicoId" integer references "Tecnico"("id") on delete set null,
  "syncJobId" integer references "ColaSincronizacion"("id") on delete set null,
  "tipo" text not null default 'evidencia',
  "nombreOriginal" text not null,
  "mimeType" text not null,
  "sizeBytes" integer,
  "r2Bucket" text not null,
  "r2Key" text not null,
  "publicUrl" text,
  "checksumSha256" text,
  "metadata" jsonb not null default '{}'::jsonb,
  "createdAt" timestamptz not null default now()
);

create index if not exists "ArchivoAdjunto_visitaId_idx" on "ArchivoAdjunto"("visitaId");
create index if not exists "ArchivoAdjunto_visitaActividadId_idx" on "ArchivoAdjunto"("visitaActividadId");
create index if not exists "ArchivoAdjunto_tecnicoId_idx" on "ArchivoAdjunto"("tecnicoId");
create index if not exists "ArchivoAdjunto_syncJobId_idx" on "ArchivoAdjunto"("syncJobId");
create unique index if not exists "ArchivoAdjunto_r2Key_key" on "ArchivoAdjunto"("r2Key");

commit;
