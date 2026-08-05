-- =========================================================
-- CMCing CMMS produccion - matrices versionadas y documentos
-- Dependencia: 20260804100000_cmms_integrity_audit_lock.sql
-- =========================================================

begin;

-- Cada fila de MatrizCumplimiento representa una version inmutable una vez
-- publicada. familiaId agrupa las revisiones logicas de una misma matriz.
alter table public."MatrizCumplimiento"
  add column if not exists "familiaId" uuid default gen_random_uuid(),
  add column if not exists "estadoVersion" text not null default 'BORRADOR',
  add column if not exists "publishedAt" timestamptz,
  add column if not exists "contentSnapshot" jsonb,
  add column if not exists "contentHashSha256" text,
  add column if not exists "supersedesMatrizId" integer,
  add column if not exists "rowRevision" bigint not null default 1;

update public."MatrizCumplimiento"
set "familiaId" = gen_random_uuid()
where "familiaId" is null;

alter table public."MatrizCumplimiento"
  alter column "familiaId" set not null;

alter table public."MatrizCumplimiento"
  drop constraint if exists "MatrizCumplimiento_estadoVersion_check";

alter table public."MatrizCumplimiento"
  add constraint "MatrizCumplimiento_estadoVersion_check"
  check ("estadoVersion" in ('BORRADOR', 'PUBLICADA', 'RETIRADA'));

alter table public."MatrizCumplimiento"
  drop constraint if exists "MatrizCumplimiento_contentHashSha256_check";

alter table public."MatrizCumplimiento"
  add constraint "MatrizCumplimiento_contentHashSha256_check"
  check (
    "contentHashSha256" is null
    or "contentHashSha256" ~ '^[0-9a-f]{64}$'
  );

do $migration$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public."MatrizCumplimiento"'::regclass
      and conname = 'MatrizCumplimiento_supersedesMatrizId_fkey'
  ) then
    alter table public."MatrizCumplimiento"
      add constraint "MatrizCumplimiento_supersedesMatrizId_fkey"
      foreign key ("supersedesMatrizId")
      references public."MatrizCumplimiento"("id") on delete restrict;
  end if;
end;
$migration$;

create unique index if not exists "MatrizCumplimiento_familia_version_key"
  on public."MatrizCumplimiento"("familiaId", "version");

alter table public."MatrizItem"
  add column if not exists "rowRevision" bigint not null default 1;

alter table public."MedicionCatalogo"
  add column if not exists "rowRevision" bigint not null default 1;

do $migration$
declare
  v_table text;
  v_trigger text;
begin
  foreach v_table in array array['MatrizCumplimiento', 'MatrizItem', 'MedicionCatalogo']
  loop
    v_trigger := 'trg_' || lower(v_table) || '_row_revision';
    execute format('drop trigger if exists %I on public.%I', v_trigger, v_table);
    execute format(
      'create trigger %I before update on public.%I for each row execute function public.cmc_bump_row_revision()',
      v_trigger,
      v_table
    );
  end loop;
end;
$migration$;

-- Snapshot canonico: incluye definicion, items, opciones y unidad de medicion.
-- jsonb produce una representacion textual estable para calcular el hash.
create or replace function public.cmc_build_matrix_snapshot(p_matriz_id integer)
returns jsonb
language sql
stable
security definer
set search_path = pg_catalog, public
as $function$
  select jsonb_build_object(
    'matrizId', m."id",
    'familiaId', m."familiaId",
    'version', m."version",
    'nombre', m."nombre",
    'descripcion', m."descripcion",
    'categoria', m."categoria",
    'items', coalesce(
      jsonb_agg(
        jsonb_build_object(
          'itemId', i."id",
          'titulo', i."titulo",
          'descripcion', i."descripcion",
          'tipoRespuesta', i."tipoRespuesta",
          'requerido', i."requerido",
          'orden', i."orden",
          'opciones', i."opciones",
          'medicion', case when med."id" is null then null else jsonb_build_object(
            'medicionId', med."id",
            'nombre', med."nombre",
            'unidad', med."unidad",
            'simbolo', med."simbolo"
          ) end
        ) order by i."orden", i."id"
      ) filter (where i."id" is not null),
      '[]'::jsonb
    )
  )
  from public."MatrizCumplimiento" m
  left join public."MatrizItem" i on i."matrizId" = m."id"
  left join public."MedicionCatalogo" med on med."id" = i."medicionId"
  where m."id" = p_matriz_id
  group by m."id", m."familiaId", m."version", m."nombre", m."descripcion", m."categoria";
$function$;

-- Las matrices legacy se congelan como version publicada antes de instalar
-- las barreras de inmutabilidad. Sus asignaciones conservaran este snapshot.
update public."MatrizCumplimiento" m
set
  "contentSnapshot" = public.cmc_build_matrix_snapshot(m."id"),
  "contentHashSha256" = encode(
    extensions.digest(convert_to(public.cmc_build_matrix_snapshot(m."id")::text, 'UTF8'), 'sha256'),
    'hex'
  ),
  "estadoVersion" = 'PUBLICADA',
  "publishedAt" = coalesce(m."publishedAt", m."createdAt", now())
where m."contentSnapshot" is null
   or m."contentHashSha256" is null;

create or replace function public.cmc_protect_published_matrix()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $function$
begin
  if old."estadoVersion" = 'BORRADOR'
     and new."estadoVersion" = 'PUBLICADA'
     and coalesce(current_setting('cmcing.matrix_publish', true), '') <> txid_current()::text then
    raise exception 'La publicacion solo puede realizarse mediante cmc_publicar_matriz().' using errcode = '42501';
  end if;

  if old."estadoVersion" = 'PUBLICADA'
     and coalesce(current_setting('cmcing.matrix_publish', true), '') <> txid_current()::text then
    if new."nombre" is distinct from old."nombre"
       or new."descripcion" is distinct from old."descripcion"
       or new."categoria" is distinct from old."categoria"
       or new."familiaId" is distinct from old."familiaId"
       or new."version" is distinct from old."version"
       or new."contentSnapshot" is distinct from old."contentSnapshot"
       or new."contentHashSha256" is distinct from old."contentHashSha256"
       or new."supersedesMatrizId" is distinct from old."supersedesMatrizId"
       or new."estadoVersion" not in ('PUBLICADA', 'RETIRADA') then
      raise exception 'Una matriz publicada es inmutable; cree una nueva version.' using errcode = '42501';
    end if;
  elsif old."estadoVersion" = 'RETIRADA' then
    raise exception 'Una version retirada es inmutable.' using errcode = '42501';
  end if;

  if new."estadoVersion" in ('PUBLICADA', 'RETIRADA')
     and (new."contentSnapshot" is null or new."contentHashSha256" is null) then
    raise exception 'Una matriz publicada requiere snapshot y hash.' using errcode = '23514';
  end if;

  return new;
end;
$function$;

drop trigger if exists trg_cmc_protect_published_matrix on public."MatrizCumplimiento";
create trigger trg_cmc_protect_published_matrix
before update on public."MatrizCumplimiento"
for each row execute function public.cmc_protect_published_matrix();

create or replace function public.cmc_protect_published_matrix_item()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $function$
declare
  v_old_matriz_id integer;
  v_new_matriz_id integer;
  v_old_status text;
  v_new_status text;
begin
  if tg_op in ('UPDATE', 'DELETE') then
    v_old_matriz_id := old."matrizId";
    select m."estadoVersion" into v_old_status
    from public."MatrizCumplimiento" m
    where m."id" = v_old_matriz_id;
  end if;

  if tg_op in ('INSERT', 'UPDATE') then
    v_new_matriz_id := new."matrizId";
    select m."estadoVersion" into v_new_status
    from public."MatrizCumplimiento" m
    where m."id" = v_new_matriz_id;
  end if;

  if v_old_status in ('PUBLICADA', 'RETIRADA')
     or v_new_status in ('PUBLICADA', 'RETIRADA') then
    raise exception 'Los items de una matriz publicada son inmutables; cree una nueva version.'
      using errcode = '42501';
  end if;

  if tg_op = 'UPDATE' and new."tipoRespuesta" is distinct from old."tipoRespuesta" then
    raise exception 'El tipo de respuesta no puede modificarse una vez creado.'
      using errcode = '42501';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$function$;

drop trigger if exists trg_matriz_item_tipo_inmutable on public."MatrizItem";
drop trigger if exists trg_cmc_protect_published_matrix_item on public."MatrizItem";
create trigger trg_cmc_protect_published_matrix_item
before insert or update or delete on public."MatrizItem"
for each row execute function public.cmc_protect_published_matrix_item();

-- ---------------------------------------------------------
-- Alcances por defecto: global, cliente, equipo o tipo de actividad
-- ---------------------------------------------------------
create table if not exists public."MatrizAlcance" (
  "id" bigserial primary key,
  "matrizId" integer not null references public."MatrizCumplimiento"("id") on delete restrict,
  "alcanceTipo" text not null check ("alcanceTipo" in ('GLOBAL', 'CLIENTE', 'EQUIPO', 'TIPO_ACTIVIDAD')),
  "clienteId" integer references public."Cliente"("id") on delete restrict,
  "equipoId" integer references public."Equipo"("id") on delete restrict,
  "actividadId" integer references public."Actividad"("id") on delete restrict,
  "obligatoria" boolean not null default true,
  "prioridad" integer not null default 100,
  "active" boolean not null default true,
  "createdByUsuarioId" integer references public."Usuario"("id") on delete set null,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now(),
  "rowRevision" bigint not null default 1,
  constraint "MatrizAlcance_scope_columns_check" check (
    ("alcanceTipo" = 'GLOBAL' and "clienteId" is null and "equipoId" is null and "actividadId" is null)
    or ("alcanceTipo" = 'CLIENTE' and "clienteId" is not null and "equipoId" is null and "actividadId" is null)
    or ("alcanceTipo" = 'EQUIPO' and "clienteId" is null and "equipoId" is not null and "actividadId" is null)
    or ("alcanceTipo" = 'TIPO_ACTIVIDAD' and "clienteId" is null and "equipoId" is null and "actividadId" is not null)
  )
);

create unique index if not exists "MatrizAlcance_global_key"
  on public."MatrizAlcance"("matrizId") where "alcanceTipo" = 'GLOBAL';
create unique index if not exists "MatrizAlcance_cliente_key"
  on public."MatrizAlcance"("matrizId", "clienteId") where "alcanceTipo" = 'CLIENTE';
create unique index if not exists "MatrizAlcance_equipo_key"
  on public."MatrizAlcance"("matrizId", "equipoId") where "alcanceTipo" = 'EQUIPO';
create unique index if not exists "MatrizAlcance_actividad_key"
  on public."MatrizAlcance"("matrizId", "actividadId") where "alcanceTipo" = 'TIPO_ACTIVIDAD';

drop trigger if exists trg_matriz_alcance_updated_at on public."MatrizAlcance";
create trigger trg_matriz_alcance_updated_at
before update on public."MatrizAlcance"
for each row execute function public.set_updated_at();

drop trigger if exists trg_matrizalcance_row_revision on public."MatrizAlcance";
create trigger trg_matrizalcance_row_revision
before update on public."MatrizAlcance"
for each row execute function public.cmc_bump_row_revision();

-- Compatibilidad: los defaults antiguos pasan al alcance por tipo de actividad.
insert into public."MatrizAlcance" (
  "matrizId", "alcanceTipo", "actividadId", "obligatoria", "prioridad", "active"
)
select d."matrizId", 'TIPO_ACTIVIDAD', d."actividadId", true, 100, true
from public."ActividadMatrizDefault" d
on conflict do nothing;

-- ---------------------------------------------------------
-- Snapshot por asignacion y validacion de respuestas
-- ---------------------------------------------------------
alter table public."ActividadMatrizAsignada"
  add column if not exists "matrizFamiliaId" uuid,
  add column if not exists "matrizVersion" integer,
  add column if not exists "matrizCategoria" text,
  add column if not exists "matrizNombreSnapshot" text,
  add column if not exists "definitionSnapshot" jsonb,
  add column if not exists "definitionHashSha256" text;

create or replace function public.cmc_fill_assignment_snapshot()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  v_matrix public."MatrizCumplimiento"%rowtype;
begin
  if tg_op = 'UPDATE' then
    if new."matrizId" is distinct from old."matrizId"
       or new."matrizFamiliaId" is distinct from old."matrizFamiliaId"
       or new."matrizVersion" is distinct from old."matrizVersion"
       or new."matrizCategoria" is distinct from old."matrizCategoria"
       or new."matrizNombreSnapshot" is distinct from old."matrizNombreSnapshot"
       or new."definitionSnapshot" is distinct from old."definitionSnapshot"
       or new."definitionHashSha256" is distinct from old."definitionHashSha256" then
      raise exception 'La definicion asignada es un snapshot inmutable.' using errcode = '42501';
    end if;
    return new;
  end if;

  select * into v_matrix
  from public."MatrizCumplimiento"
  where "id" = new."matrizId";

  if not found then
    raise exception 'Matriz no encontrada.' using errcode = '23503';
  end if;
  if v_matrix."estadoVersion" <> 'PUBLICADA' then
    raise exception 'Solo se pueden asignar matrices publicadas.' using errcode = '23514';
  end if;

  new."matrizFamiliaId" := v_matrix."familiaId";
  new."matrizVersion" := v_matrix."version";
  new."matrizCategoria" := v_matrix."categoria";
  new."matrizNombreSnapshot" := v_matrix."nombre";
  new."definitionSnapshot" := v_matrix."contentSnapshot";
  new."definitionHashSha256" := v_matrix."contentHashSha256";
  return new;
end;
$function$;

-- Backfill previo a NOT NULL para asignaciones creadas por el esquema legacy.
update public."ActividadMatrizAsignada" a
set
  "matrizFamiliaId" = m."familiaId",
  "matrizVersion" = m."version",
  "matrizCategoria" = m."categoria",
  "matrizNombreSnapshot" = m."nombre",
  "definitionSnapshot" = m."contentSnapshot",
  "definitionHashSha256" = m."contentHashSha256"
from public."MatrizCumplimiento" m
where m."id" = a."matrizId"
  and a."definitionSnapshot" is null;

alter table public."ActividadMatrizAsignada"
  alter column "matrizFamiliaId" set not null,
  alter column "matrizVersion" set not null,
  alter column "matrizCategoria" set not null,
  alter column "matrizNombreSnapshot" set not null,
  alter column "definitionSnapshot" set not null,
  alter column "definitionHashSha256" set not null;

alter table public."ActividadMatrizAsignada"
  drop constraint if exists "ActividadMatrizAsignada_hash_check";
alter table public."ActividadMatrizAsignada"
  add constraint "ActividadMatrizAsignada_hash_check"
  check ("definitionHashSha256" ~ '^[0-9a-f]{64}$');

-- Las respuestas no se destruyen implicitamente al quitar una asignacion. Una
-- asignacion con evidencia debe conservarse o resolverse mediante un flujo
-- explicito; esto mantiene la auditoria completa.
alter table public."ActividadMatrizRespuesta"
  drop constraint if exists "ActividadMatrizRespuesta_actividadMatrizAsignadaId_fkey";
alter table public."ActividadMatrizRespuesta"
  add constraint "ActividadMatrizRespuesta_actividadMatrizAsignadaId_fkey"
  foreign key ("actividadMatrizAsignadaId")
  references public."ActividadMatrizAsignada"("id") on delete restrict;

create or replace function public.cmc_prevent_assignment_delete_with_answers()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $function$
begin
  if exists (
    select 1
    from public."ActividadMatrizRespuesta" r
    where r."actividadMatrizAsignadaId" = old."id"
  ) then
    raise exception 'Una matriz asignada con respuestas no puede eliminarse; conserve la evidencia.'
      using errcode = '23503';
  end if;
  return old;
end;
$function$;

drop trigger if exists trg_cmc_prevent_assignment_delete_with_answers
  on public."ActividadMatrizAsignada";
create trigger trg_cmc_prevent_assignment_delete_with_answers
before delete on public."ActividadMatrizAsignada"
for each row execute function public.cmc_prevent_assignment_delete_with_answers();

revoke execute on function public.cmc_prevent_assignment_delete_with_answers()
  from public, anon, authenticated, service_role;

drop trigger if exists trg_cmc_fill_assignment_snapshot on public."ActividadMatrizAsignada";
create trigger trg_cmc_fill_assignment_snapshot
before insert or update on public."ActividadMatrizAsignada"
for each row execute function public.cmc_fill_assignment_snapshot();

create or replace function public.cmc_validate_matrix_answer()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  v_type text;
  v_allowed_options jsonb;
  v_assignment_matrix integer;
  v_item_matrix integer;
begin
  select a."matrizId", i."matrizId", i."tipoRespuesta", i."opciones"
  into v_assignment_matrix, v_item_matrix, v_type, v_allowed_options
  from public."ActividadMatrizAsignada" a
  cross join public."MatrizItem" i
  where a."id" = new."actividadMatrizAsignadaId"
    and i."id" = new."matrizItemId";

  if not found or v_assignment_matrix <> v_item_matrix then
    raise exception 'El item no pertenece a la matriz asignada.' using errcode = '23514';
  end if;

  if v_type = 'numero' and (
    new."valorNumero" is null or new."valorBooleano" is not null
    or new."valorTexto" is not null or new."valorOpciones" is not null
  ) then
    raise exception 'La respuesta requiere exclusivamente un valor numerico.' using errcode = '23514';
  elsif v_type = 'dicotomica' and (
    new."valorBooleano" is null or new."valorNumero" is not null
    or new."valorTexto" is not null or new."valorOpciones" is not null
  ) then
    raise exception 'La respuesta requiere exclusivamente cumple/no cumple.' using errcode = '23514';
  elsif v_type = 'texto' and (
    nullif(btrim(new."valorTexto"), '') is null or new."valorNumero" is not null
    or new."valorBooleano" is not null or new."valorOpciones" is not null
  ) then
    raise exception 'La respuesta requiere exclusivamente texto no vacio.' using errcode = '23514';
  elsif v_type = 'seleccion_multiple' and (
    new."valorOpciones" is null
    or jsonb_typeof(new."valorOpciones") <> 'array'
    or jsonb_array_length(new."valorOpciones") = 0
    or new."valorNumero" is not null
    or new."valorBooleano" is not null
    or new."valorTexto" is not null
  ) then
    raise exception 'La respuesta requiere exclusivamente una seleccion no vacia.' using errcode = '23514';
  end if;

  if v_type = 'seleccion_multiple' and exists (
    select 1
    from jsonb_array_elements(new."valorOpciones") chosen
    where not exists (
      select 1
      from jsonb_array_elements(coalesce(v_allowed_options, '[]'::jsonb)) allowed
      where allowed = chosen
    )
  ) then
    raise exception 'La respuesta contiene una opcion ajena a la matriz publicada.' using errcode = '23514';
  end if;

  new."respondidoByUsuarioId" := public.cmc_current_usuario_id();
  new."respondidoAt" := now();
  return new;
end;
$function$;

drop trigger if exists trg_cmc_validate_matrix_answer on public."ActividadMatrizRespuesta";
create trigger trg_cmc_validate_matrix_answer
before insert or update on public."ActividadMatrizRespuesta"
for each row execute function public.cmc_validate_matrix_answer();

-- ---------------------------------------------------------
-- Artefactos PDF/informe con snapshot, version y hash verificable
-- ---------------------------------------------------------
create table if not exists public."ActividadDocumento" (
  "id" bigserial primary key,
  "ordenTrabajoActividadId" integer not null
    references public."OrdenTrabajoActividad"("id") on delete restrict,
  "actividadMatrizAsignadaId" integer
    references public."ActividadMatrizAsignada"("id") on delete restrict,
  "tipo" text not null default 'INFORME_RESULTADO'
    check ("tipo" in ('INFORME_RESULTADO', 'ACTA_ENTREGA', 'ANEXO')),
  "version" integer not null check ("version" > 0),
  "estado" text not null default 'BORRADOR'
    check ("estado" in ('BORRADOR', 'GENERADO', 'FINAL')),
  "titulo" text not null,
  "r2Bucket" text,
  "r2Key" text,
  "mimeType" text not null default 'application/pdf',
  "sizeBytes" bigint,
  "sha256" text,
  "sourceSnapshot" jsonb not null,
  "generatedByUsuarioId" integer references public."Usuario"("id") on delete set null,
  "generatedByAuthUserId" uuid references auth.users(id) on delete set null,
  "generatedAt" timestamptz,
  "supersedesDocumentoId" bigint references public."ActividadDocumento"("id") on delete restrict,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now(),
  "rowRevision" bigint not null default 1,
  constraint "ActividadDocumento_final_artifact_check" check (
    "estado" = 'BORRADOR'
    or (
      nullif(btrim("r2Bucket"), '') is not null
      and nullif(btrim("r2Key"), '') is not null
      and "sizeBytes" > 0
      and "sha256" ~ '^[0-9a-f]{64}$'
      and "generatedAt" is not null
    )
  )
);

create unique index if not exists "ActividadDocumento_activity_type_version_key"
  on public."ActividadDocumento"("ordenTrabajoActividadId", "tipo", "version");
create unique index if not exists "ActividadDocumento_r2_key"
  on public."ActividadDocumento"("r2Bucket", "r2Key")
  where "r2Bucket" is not null and "r2Key" is not null;
create index if not exists "ActividadDocumento_activity_idx"
  on public."ActividadDocumento"("ordenTrabajoActividadId", "createdAt" desc);

create or replace function public.cmc_validate_document_parent()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $function$
declare
  v_assignment_activity_id integer;
  v_superseded public."ActividadDocumento"%rowtype;
begin
  if new."actividadMatrizAsignadaId" is not null then
    select a."ordenTrabajoActividadId" into v_assignment_activity_id
    from public."ActividadMatrizAsignada" a
    where a."id" = new."actividadMatrizAsignadaId";

    if not found or v_assignment_activity_id <> new."ordenTrabajoActividadId" then
      raise exception 'El documento y la matriz asignada deben pertenecer a la misma actividad.'
        using errcode = '23514';
    end if;
  end if;

  if new."supersedesDocumentoId" is not null then
    if new."id" is not null and new."supersedesDocumentoId" = new."id" then
      raise exception 'Un documento no puede reemplazarse a si mismo.' using errcode = '23514';
    end if;

    select * into v_superseded
    from public."ActividadDocumento"
    where "id" = new."supersedesDocumentoId";

    if not found
       or v_superseded."ordenTrabajoActividadId" <> new."ordenTrabajoActividadId"
       or v_superseded."tipo" <> new."tipo"
       or v_superseded."version" >= new."version" then
      raise exception 'El documento reemplazado debe ser del mismo tipo/actividad y de una version anterior.'
        using errcode = '23514';
    end if;
  end if;

  if auth.uid() is not null then
    new."generatedByAuthUserId" := auth.uid();
    new."generatedByUsuarioId" := public.cmc_current_usuario_id();
  end if;
  if new."estado" in ('GENERADO', 'FINAL') then
    new."generatedAt" := coalesce(new."generatedAt", now());
  end if;
  return new;
end;
$function$;

drop trigger if exists trg_cmc_validate_document_parent on public."ActividadDocumento";
create trigger trg_cmc_validate_document_parent
before insert or update on public."ActividadDocumento"
for each row execute function public.cmc_validate_document_parent();

drop trigger if exists trg_actividad_documento_updated_at on public."ActividadDocumento";
create trigger trg_actividad_documento_updated_at
before update on public."ActividadDocumento"
for each row execute function public.set_updated_at();

drop trigger if exists trg_actividaddocumento_row_revision on public."ActividadDocumento";
create trigger trg_actividaddocumento_row_revision
before update on public."ActividadDocumento"
for each row execute function public.cmc_bump_row_revision();

create or replace function public.cmc_protect_document_artifact()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $function$
begin
  if tg_op = 'DELETE' then
    raise exception 'Los documentos generados no se eliminan; cree una nueva version.' using errcode = '42501';
  end if;
  if old."estado" = 'FINAL' then
    raise exception 'Un documento final es inmutable; cree una nueva version.' using errcode = '42501';
  end if;
  return new;
end;
$function$;

drop trigger if exists trg_cmc_protect_document_artifact on public."ActividadDocumento";
create trigger trg_cmc_protect_document_artifact
before update or delete on public."ActividadDocumento"
for each row execute function public.cmc_protect_document_artifact();

drop trigger if exists trg_actividaddocumento_activity_lock on public."ActividadDocumento";
create trigger trg_actividaddocumento_activity_lock
before insert or update or delete on public."ActividadDocumento"
for each row execute function public.cmc_guard_activity_child_locked();

drop trigger if exists trg_actividaddocumento_activity_audit on public."ActividadDocumento";
create trigger trg_actividaddocumento_activity_audit
after insert or update or delete on public."ActividadDocumento"
for each row execute function public.cmc_audit_activity_child();

drop trigger if exists trg_actividaddocumento_activity_touch on public."ActividadDocumento";
create trigger trg_actividaddocumento_activity_touch
after insert or update or delete on public."ActividadDocumento"
for each row execute function public.cmc_touch_activity_from_child();

-- Publicar matrices y registrar documentos se expondra por RPC; estas
-- funciones internas no quedan disponibles directamente.
revoke execute on function public.cmc_build_matrix_snapshot(integer) from public, anon, authenticated;
revoke execute on function public.cmc_fill_assignment_snapshot() from public, anon, authenticated;
revoke execute on function public.cmc_validate_matrix_answer() from public, anon, authenticated;
revoke execute on function public.cmc_validate_document_parent() from public, anon, authenticated;

commit;
