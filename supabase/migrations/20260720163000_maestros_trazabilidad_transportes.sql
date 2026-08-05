begin;

-- ---------------------------------------------------------
-- 1) Clientes: ficha trazable, contactos y direcciones
-- ---------------------------------------------------------
alter table "Cliente" add column if not exists "tipoEntidad" text not null default 'cliente';
alter table "Cliente" add column if not exists "giro" text;
alter table "Cliente" add column if not exists "notas" text;

create table if not exists "ClienteContacto" (
  "id" serial primary key,
  "clienteId" integer not null references "Cliente"("id") on delete cascade,
  "nombre" text not null,
  "cargo" text,
  "email" text,
  "telefono" text,
  "rol" text not null default 'principal',
  "principal" boolean not null default false,
  "notas" text,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);

create index if not exists "ClienteContacto_clienteId_idx" on "ClienteContacto"("clienteId");
create index if not exists "ClienteContacto_email_idx" on "ClienteContacto"("email");

drop trigger if exists trg_cliente_contacto_updated_at on "ClienteContacto";
create trigger trg_cliente_contacto_updated_at before update on "ClienteContacto"
for each row execute function public.set_updated_at();

create table if not exists "ClienteDireccion" (
  "id" serial primary key,
  "clienteId" integer not null references "Cliente"("id") on delete cascade,
  "tipo" text not null default 'servicio',
  "nombre" text,
  "direccion" text not null,
  "comuna" text,
  "ciudad" text,
  "region" text,
  "principal" boolean not null default false,
  "notas" text,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);

create index if not exists "ClienteDireccion_clienteId_idx" on "ClienteDireccion"("clienteId");

drop trigger if exists trg_cliente_direccion_updated_at on "ClienteDireccion";
create trigger trg_cliente_direccion_updated_at before update on "ClienteDireccion"
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------
-- 2) Transporte: camiones, conductores, asignaciones y fotos
-- ---------------------------------------------------------
create table if not exists "Camion" (
  "id" serial primary key,
  "patente" text not null,
  "codigoInterno" text,
  "marca" text,
  "modelo" text,
  "anio" integer,
  "tipo" text,
  "largoM" numeric(10,2),
  "anchoM" numeric(10,2),
  "altoM" numeric(10,2),
  "taraKg" numeric(12,2),
  "cargaMaxKg" numeric(12,2),
  "volumenM3" numeric(12,2),
  "propietarioTipo" text not null default 'interno',
  "propietarioClienteId" integer references "Cliente"("id") on delete set null,
  "proveedorNombre" text,
  "estado" text not null default 'activo',
  "observaciones" text,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now(),
  constraint "Camion_propietarioTipo_check" check ("propietarioTipo" in ('interno', 'proveedor', 'mandante'))
);

create unique index if not exists "Camion_patente_key" on "Camion"(upper("patente"));
create index if not exists "Camion_propietarioClienteId_idx" on "Camion"("propietarioClienteId");
create index if not exists "Camion_estado_idx" on "Camion"("estado");

drop trigger if exists trg_camion_updated_at on "Camion";
create trigger trg_camion_updated_at before update on "Camion"
for each row execute function public.set_updated_at();

create table if not exists "Conductor" (
  "id" serial primary key,
  "nombre" text not null,
  "rut" text,
  "telefono" text,
  "email" text,
  "licencia" text,
  "licenciaVence" date,
  "estado" text not null default 'activo',
  "observaciones" text,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);

create unique index if not exists "Conductor_rut_key"
on "Conductor"("rut")
where "rut" is not null and btrim("rut") <> '';
create index if not exists "Conductor_estado_idx" on "Conductor"("estado");

drop trigger if exists trg_conductor_updated_at on "Conductor";
create trigger trg_conductor_updated_at before update on "Conductor"
for each row execute function public.set_updated_at();

create table if not exists "CamionConductor" (
  "id" serial primary key,
  "camionId" integer not null references "Camion"("id") on delete cascade,
  "conductorId" integer not null references "Conductor"("id") on delete cascade,
  "activo" boolean not null default true,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now(),
  unique ("camionId", "conductorId")
);

alter table "CamionConductor" add column if not exists "activo" boolean not null default true;
alter table "CamionConductor" add column if not exists "updatedAt" timestamptz not null default now();
create index if not exists "CamionConductor_camionId_idx" on "CamionConductor"("camionId");
create index if not exists "CamionConductor_conductorId_idx" on "CamionConductor"("conductorId");

drop trigger if exists trg_camion_conductor_updated_at on "CamionConductor";
create trigger trg_camion_conductor_updated_at before update on "CamionConductor"
for each row execute function public.set_updated_at();

create table if not exists "CamionFoto" (
  "id" serial primary key,
  "camionId" integer not null references "Camion"("id") on delete cascade,
  "tipo" text not null default 'foto',
  "titulo" text,
  "nombreOriginal" text,
  "mimeType" text,
  "sizeBytes" integer,
  "r2Bucket" text not null,
  "r2Key" text not null,
  "checksumSha256" text,
  "observaciones" text,
  "createdAt" timestamptz not null default now()
);

create unique index if not exists "CamionFoto_r2Key_key" on "CamionFoto"("r2Key");
create index if not exists "CamionFoto_camionId_idx" on "CamionFoto"("camionId");

commit;
