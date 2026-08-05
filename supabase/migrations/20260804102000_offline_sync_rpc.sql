-- =========================================================
-- CMCing CMMS produccion - sincronizacion offline y RPC atomicos
-- Dependencia: 20260804101000_matrix_versions_reports.sql
--
-- Cada mutacion usa clientMutationId + hash del request. Reintentar el mismo
-- request devuelve el receipt almacenado; reutilizar el id con otro contenido
-- se rechaza. Los conflictos optimistas quedan persistidos, no se pierden por
-- un RAISE que revierta la transaccion.
-- =========================================================

begin;

create table if not exists public."SyncMutationReceipt" (
  "id" bigserial primary key,
  "clientMutationId" text not null unique,
  "operation" text not null,
  "ordenTrabajoActividadId" integer
    references public."OrdenTrabajoActividad"("id") on delete restrict,
  "actorAuthUserId" uuid not null references auth.users(id) on delete restrict,
  "actorUsuarioId" integer references public."Usuario"("id") on delete set null,
  "requestHashSha256" text not null check ("requestHashSha256" ~ '^[0-9a-f]{64}$'),
  "status" text not null default 'PROCESANDO'
    check ("status" in ('PROCESANDO', 'APLICADA', 'CONFLICTO', 'RECHAZADA')),
  "response" jsonb,
  "createdAt" timestamptz not null default now(),
  "completedAt" timestamptz,
  constraint "SyncMutationReceipt_client_id_check"
    check (char_length(btrim("clientMutationId")) between 8 and 200)
);

create index if not exists "SyncMutationReceipt_actor_created_idx"
  on public."SyncMutationReceipt"("actorAuthUserId", "createdAt" desc);
create index if not exists "SyncMutationReceipt_activity_created_idx"
  on public."SyncMutationReceipt"("ordenTrabajoActividadId", "createdAt" desc);

create table if not exists public."SyncConflict" (
  "id" bigserial primary key,
  "receiptId" bigint not null unique
    references public."SyncMutationReceipt"("id") on delete restrict,
  "ordenTrabajoActividadId" integer not null
    references public."OrdenTrabajoActividad"("id") on delete restrict,
  "operation" text not null,
  "expectedRevision" bigint not null,
  "actualRevision" bigint not null,
  "clientPayload" jsonb not null,
  "serverSnapshot" jsonb not null,
  "status" text not null default 'ABIERTO'
    check ("status" in ('ABIERTO', 'RESUELTO_SERVIDOR', 'RESUELTO_CLIENTE', 'DESCARTADO')),
  "resolvedByAuthUserId" uuid references auth.users(id) on delete set null,
  "resolutionReason" text,
  "resolvedAt" timestamptz,
  "createdAt" timestamptz not null default now(),
  constraint "SyncConflict_resolution_check" check (
    ("status" = 'ABIERTO' and "resolvedAt" is null)
    or ("status" <> 'ABIERTO' and "resolvedAt" is not null and nullif(btrim("resolutionReason"), '') is not null)
  )
);

create index if not exists "SyncConflict_activity_status_idx"
  on public."SyncConflict"("ordenTrabajoActividadId", "status", "createdAt" desc);

create or replace function public.cmc_stamp_sync_conflict_resolution()
returns trigger
language plpgsql
set search_path = pg_catalog, public, auth
as $function$
begin
  if old."status" <> 'ABIERTO' then
    raise exception 'Un conflicto resuelto es inmutable.' using errcode = '42501';
  end if;
  if new."status" = 'ABIERTO' then
    -- Mientras siga abierto no se permite alterar evidencia ni revisiones.
    raise exception 'Use un estado de resolucion para actualizar el conflicto.' using errcode = '42501';
  end if;

  new."receiptId" := old."receiptId";
  new."ordenTrabajoActividadId" := old."ordenTrabajoActividadId";
  new."operation" := old."operation";
  new."expectedRevision" := old."expectedRevision";
  new."actualRevision" := old."actualRevision";
  new."clientPayload" := old."clientPayload";
  new."serverSnapshot" := old."serverSnapshot";
  new."resolvedByAuthUserId" := auth.uid();
  new."resolvedAt" := now();
  return new;
end;
$function$;

drop trigger if exists trg_sync_conflict_resolution on public."SyncConflict";
create trigger trg_sync_conflict_resolution
before update on public."SyncConflict"
for each row execute function public.cmc_stamp_sync_conflict_resolution();

create table if not exists public."SyncOutbox" (
  "id" bigserial primary key,
  "eventId" uuid not null default gen_random_uuid() unique,
  "clientMutationId" text,
  "aggregateType" text not null,
  "aggregateId" text not null,
  "aggregateRevision" bigint not null,
  "eventType" text not null,
  "payload" jsonb not null,
  "actorAuthUserId" uuid references auth.users(id) on delete set null,
  "actorUsuarioId" integer references public."Usuario"("id") on delete set null,
  "occurredAt" timestamptz not null default now(),
  "publishedAt" timestamptz,
  "attempts" integer not null default 0 check ("attempts" >= 0),
  "lastError" text
);

create unique index if not exists "SyncOutbox_mutation_event_key"
  on public."SyncOutbox"("clientMutationId", "eventType")
  where "clientMutationId" is not null;
create index if not exists "SyncOutbox_pending_idx"
  on public."SyncOutbox"("occurredAt", "id")
  where "publishedAt" is null;

alter table public."ColaSincronizacion"
  add column if not exists "ordenTrabajoActividadId" integer;

do $migration$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public."ColaSincronizacion"'::regclass
      and conname = 'ColaSincronizacion_ordenTrabajoActividadId_fkey'
  ) then
    alter table public."ColaSincronizacion"
      add constraint "ColaSincronizacion_ordenTrabajoActividadId_fkey"
      foreign key ("ordenTrabajoActividadId")
      references public."OrdenTrabajoActividad"("id") on delete set null;
  end if;
end;
$migration$;

create index if not exists "ColaSincronizacion_ordenTrabajoActividadId_idx"
  on public."ColaSincronizacion"("ordenTrabajoActividadId");

-- Reemplaza la version inicial del trigger ahora que las columnas snapshot ya
-- existen. Asi ni OPERACIONES ni service_role pueden cerrar por UPDATE directo
-- saltandose matrices obligatorias.
create or replace function public.cmc_enforce_activity_state()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $function$
declare
  v_unlock_marker text := coalesce(current_setting('cmcing.internal_unlock', true), '');
  v_is_closing boolean := false;
begin
  if tg_op = 'INSERT' then
    v_is_closing := new."estado" = 'cerrada';
  else
    v_is_closing := new."estado" = 'cerrada' and old."estado" is distinct from new."estado";
    if old."bloqueada" then
      if not (
        v_unlock_marker = txid_current()::text
        and new."bloqueada" = false
        and new."estado" = 'abierta'
      ) then
        raise exception 'La actividad esta cerrada y bloqueada; use el RPC administrativo de desbloqueo.'
          using errcode = '42501';
      end if;
    end if;
  end if;

  if v_is_closing and exists (
    select 1
    from public."ActividadMatrizAsignada" am
    where am."ordenTrabajoActividadId" = new."id"
      and am."obligatoria"
      and (
        am."estado" <> 'completa'
        or exists (
          select 1
          from jsonb_array_elements(am."definitionSnapshot" -> 'items') item
          where coalesce((item ->> 'requerido')::boolean, false)
            and not exists (
              select 1
              from public."ActividadMatrizRespuesta" answer
              where answer."actividadMatrizAsignadaId" = am."id"
                and answer."matrizItemId" = (item ->> 'itemId')::integer
            )
        )
      )
  ) then
    raise exception 'No se puede cerrar: faltan matrices obligatorias o respuestas requeridas.'
      using errcode = '23514';
  end if;

  if new."estado" = 'cerrada' then
    new."bloqueada" := true;
    new."fechaCierre" := coalesce(new."fechaCierre", now());
    new."bloqueadaAt" := coalesce(new."bloqueadaAt", now());
  elsif new."bloqueada" and new."estado" <> 'cerrada' then
    raise exception 'Una actividad bloqueada debe permanecer cerrada.' using errcode = '23514';
  end if;

  return new;
end;
$function$;

-- ---------------------------------------------------------
-- Autorizacion y snapshots de conflicto
-- ---------------------------------------------------------
create or replace function public.cmc_can_access_activity(p_actividad_id integer)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, auth
as $function$
  select exists (
    select 1
    from public."OrdenTrabajoActividad" a
    join public."Usuario" u
      on u."authUserId" = auth.uid() and u."activo"
    where a."id" = p_actividad_id
      and (
        u."rol"::text in ('SUPERADMIN', 'ADMIN', 'OPERACIONES', 'LECTURA')
        or (u."rol"::text = 'TECNICO' and u."tecnicoId" = a."tecnicoId")
      )
  );
$function$;

create or replace function public.cmc_assert_activity_mutation_access(
  p_actividad_id integer,
  p_admin_only boolean default false
)
returns integer
language plpgsql
stable
security definer
set search_path = pg_catalog, public, auth
as $function$
declare
  v_user public."Usuario"%rowtype;
  v_technician_id integer;
begin
  select * into v_user
  from public."Usuario"
  where "authUserId" = auth.uid()
    and "activo";

  if not found then
    raise exception 'Sesion Supabase no vinculada a un Usuario activo.' using errcode = '42501';
  end if;

  if p_admin_only then
    if v_user."rol"::text not in ('SUPERADMIN', 'ADMIN') then
      raise exception 'Esta operacion requiere un administrador.' using errcode = '42501';
    end if;
  elsif v_user."rol"::text = 'LECTURA' then
    raise exception 'El rol LECTURA no puede modificar actividades.' using errcode = '42501';
  elsif v_user."rol"::text = 'TECNICO' then
    select a."tecnicoId" into v_technician_id
    from public."OrdenTrabajoActividad" a
    where a."id" = p_actividad_id;

    if not found or v_user."tecnicoId" is distinct from v_technician_id then
      raise exception 'El tecnico solo puede modificar actividades que tiene asignadas.' using errcode = '42501';
    end if;
  elsif v_user."rol"::text not in ('SUPERADMIN', 'ADMIN', 'OPERACIONES') then
    raise exception 'Rol no autorizado para modificar actividades.' using errcode = '42501';
  end if;

  return v_user."id";
end;
$function$;

create or replace function public.cmc_activity_sync_snapshot(p_actividad_id integer)
returns jsonb
language sql
stable
security definer
set search_path = pg_catalog, public
as $function$
  select jsonb_build_object(
    'activity', to_jsonb(a),
    'assignments', coalesce((
      select jsonb_agg(to_jsonb(am) order by am."id")
      from public."ActividadMatrizAsignada" am
      where am."ordenTrabajoActividadId" = a."id"
    ), '[]'::jsonb),
    'answers', coalesce((
      select jsonb_agg(to_jsonb(r) order by r."id")
      from public."ActividadMatrizRespuesta" r
      join public."ActividadMatrizAsignada" am on am."id" = r."actividadMatrizAsignadaId"
      where am."ordenTrabajoActividadId" = a."id"
    ), '[]'::jsonb),
    'attachments', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', f."id",
          'tipo', f."tipo",
          'nombreOriginal', f."nombreOriginal",
          'mimeType', f."mimeType",
          'sizeBytes', f."sizeBytes",
          'r2Bucket', f."r2Bucket",
          'r2Key', f."r2Key",
          'checksumSha256', f."checksumSha256",
          'rowRevision', f."rowRevision"
        ) order by f."id"
      )
      from public."ArchivoAdjunto" f
      where f."ordenTrabajoActividadId" = a."id"
    ), '[]'::jsonb),
    'documents', coalesce((
      select jsonb_agg(to_jsonb(d) order by d."id")
      from public."ActividadDocumento" d
      where d."ordenTrabajoActividadId" = a."id"
    ), '[]'::jsonb)
  )
  from public."OrdenTrabajoActividad" a
  where a."id" = p_actividad_id;
$function$;

-- ---------------------------------------------------------
-- Receipt/idempotencia, conflictos y outbox (funciones internas)
-- ---------------------------------------------------------
create or replace function public.cmc_begin_sync_mutation(
  p_client_mutation_id text,
  p_operation text,
  p_actividad_id integer,
  p_request jsonb,
  out receipt_id bigint,
  out replay boolean,
  out stored_response jsonb
)
returns record
language plpgsql
security definer
set search_path = pg_catalog, public, auth, extensions
as $function$
declare
  v_auth_user_id uuid := auth.uid();
  v_user_id integer := public.cmc_current_usuario_id();
  v_hash text := encode(extensions.digest(convert_to(p_request::text, 'UTF8'), 'sha256'), 'hex');
  v_inserted integer;
  v_existing public."SyncMutationReceipt"%rowtype;
begin
  if v_auth_user_id is null or v_user_id is null then
    raise exception 'Se requiere una sesion autenticada y vinculada.' using errcode = '42501';
  end if;
  if char_length(btrim(coalesce(p_client_mutation_id, ''))) not between 8 and 200 then
    raise exception 'clientMutationId invalido.' using errcode = '22023';
  end if;

  insert into public."SyncMutationReceipt" (
    "clientMutationId", "operation", "ordenTrabajoActividadId",
    "actorAuthUserId", "actorUsuarioId", "requestHashSha256"
  )
  values (
    btrim(p_client_mutation_id), p_operation, p_actividad_id,
    v_auth_user_id, v_user_id, v_hash
  )
  on conflict ("clientMutationId") do nothing
  returning "id" into receipt_id;

  get diagnostics v_inserted = row_count;
  if v_inserted = 1 then
    replay := false;
    stored_response := null;
    return;
  end if;

  select * into v_existing
  from public."SyncMutationReceipt"
  where "clientMutationId" = btrim(p_client_mutation_id)
  for update;

  if v_existing."actorAuthUserId" <> v_auth_user_id
     or v_existing."operation" <> p_operation
     or v_existing."ordenTrabajoActividadId" is distinct from p_actividad_id
     or v_existing."requestHashSha256" <> v_hash then
    raise exception 'clientMutationId ya fue usado con otro actor, operacion o contenido.'
      using errcode = '23505';
  end if;

  if v_existing."status" = 'PROCESANDO' then
    raise exception 'La mutacion idempotente continua en proceso; reintente.' using errcode = '55000';
  end if;

  receipt_id := v_existing."id";
  replay := true;
  stored_response := coalesce(v_existing."response", '{}'::jsonb);
end;
$function$;

create or replace function public.cmc_finish_sync_mutation(
  p_receipt_id bigint,
  p_status text,
  p_response jsonb
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
begin
  if p_status not in ('APLICADA', 'CONFLICTO', 'RECHAZADA') then
    raise exception 'Estado final de receipt invalido.' using errcode = '22023';
  end if;

  update public."SyncMutationReceipt"
  set
    "status" = p_status,
    "response" = p_response,
    "completedAt" = now()
  where "id" = p_receipt_id
    and "status" = 'PROCESANDO';

  if not found then
    raise exception 'Receipt inexistente o ya finalizado.' using errcode = '55000';
  end if;
end;
$function$;

create or replace function public.cmc_emit_activity_outbox(
  p_actividad_id integer,
  p_revision bigint,
  p_event_type text,
  p_payload jsonb
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $function$
begin
  insert into public."SyncOutbox" (
    "clientMutationId", "aggregateType", "aggregateId", "aggregateRevision",
    "eventType", "payload", "actorAuthUserId", "actorUsuarioId"
  )
  values (
    nullif(current_setting('cmcing.client_mutation_id', true), ''),
    'OrdenTrabajoActividad',
    p_actividad_id::text,
    p_revision,
    p_event_type,
    p_payload,
    auth.uid(),
    public.cmc_current_usuario_id()
  )
  on conflict ("clientMutationId", "eventType")
    where "clientMutationId" is not null
  do nothing;
end;
$function$;

create or replace function public.cmc_record_sync_conflict(
  p_receipt_id bigint,
  p_actividad_id integer,
  p_operation text,
  p_expected_revision bigint,
  p_actual_revision bigint,
  p_client_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $function$
declare
  v_conflict_id bigint;
  v_snapshot jsonb := public.cmc_activity_sync_snapshot(p_actividad_id);
  v_response jsonb;
  v_actor_id integer := public.cmc_current_usuario_id();
  v_actor_email text;
begin
  insert into public."SyncConflict" (
    "receiptId", "ordenTrabajoActividadId", "operation", "expectedRevision",
    "actualRevision", "clientPayload", "serverSnapshot"
  )
  values (
    p_receipt_id, p_actividad_id, p_operation, p_expected_revision,
    p_actual_revision, p_client_payload, v_snapshot
  )
  returning "id" into v_conflict_id;

  select u."email" into v_actor_email
  from public."Usuario" u where u."id" = v_actor_id;

  insert into public."ActividadAuditoria" (
    "ordenTrabajoActividadId", "accion", "actorUsuarioId", "actorAuthUserId",
    "actorEmailSnapshot", "clientMutationId", "motivo", "rowRevisionAntes",
    "rowRevisionDespues", "source", "metadata"
  )
  values (
    p_actividad_id, 'CONFLICTO_SYNC', v_actor_id, auth.uid(), v_actor_email,
    nullif(current_setting('cmcing.client_mutation_id', true), ''),
    'Revision offline no coincide con el servidor',
    p_expected_revision, p_actual_revision, 'sync_rpc',
    jsonb_build_object('conflictId', v_conflict_id, 'operation', p_operation)
  );

  v_response := jsonb_build_object(
    'ok', false,
    'status', 'conflict',
    'conflictId', v_conflict_id,
    'activityId', p_actividad_id,
    'expectedRevision', p_expected_revision,
    'actualRevision', p_actual_revision,
    'serverSnapshot', v_snapshot,
    'replayed', false
  );

  perform public.cmc_finish_sync_mutation(p_receipt_id, 'CONFLICTO', v_response);
  return v_response;
end;
$function$;

-- ---------------------------------------------------------
-- RPC 1: notas tecnicas
-- ---------------------------------------------------------
create or replace function public.cmc_actualizar_notas_actividad(
  p_actividad_id integer,
  p_notas text,
  p_client_mutation_id text,
  p_expected_revision bigint
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, auth, extensions
as $function$
declare
  v_actor_id integer;
  v_activity public."OrdenTrabajoActividad"%rowtype;
  v_receipt_id bigint;
  v_replay boolean;
  v_stored jsonb;
  v_request jsonb := jsonb_build_object(
    'activityId', p_actividad_id,
    'notes', p_notas,
    'expectedRevision', p_expected_revision
  );
  v_response jsonb;
begin
  if p_expected_revision is null or p_expected_revision < 1 then
    raise exception 'expectedRevision debe ser un entero positivo.' using errcode = '22023';
  end if;

  v_actor_id := public.cmc_assert_activity_mutation_access(p_actividad_id, false);

  select receipt_id, replay, stored_response
  into v_receipt_id, v_replay, v_stored
  from public.cmc_begin_sync_mutation(
    p_client_mutation_id, 'ACTUALIZAR_NOTAS', p_actividad_id, v_request
  );

  if v_replay then
    return jsonb_set(v_stored, '{replayed}', 'true'::jsonb, true);
  end if;

  perform set_config('cmcing.client_mutation_id', btrim(p_client_mutation_id), true);
  perform set_config('cmcing.audit_source', 'sync_rpc:notas', true);

  select * into v_activity
  from public."OrdenTrabajoActividad"
  where "id" = p_actividad_id
  for update;

  if not found then
    raise exception 'Actividad no encontrada.' using errcode = 'P0002';
  end if;
  if v_activity."rowRevision" is distinct from p_expected_revision then
    return public.cmc_record_sync_conflict(
      v_receipt_id, p_actividad_id, 'ACTUALIZAR_NOTAS', p_expected_revision,
      v_activity."rowRevision", v_request
    );
  end if;
  if v_activity."bloqueada" then
    raise exception 'La actividad esta bloqueada.' using errcode = '42501';
  end if;

  update public."OrdenTrabajoActividad"
  set
    "notasTecnico" = nullif(btrim(p_notas), ''),
    "updatedByUsuarioId" = v_actor_id,
    "updatedAt" = now()
  where "id" = p_actividad_id
  returning * into v_activity;

  v_response := jsonb_build_object(
    'ok', true,
    'status', 'applied',
    'operation', 'ACTUALIZAR_NOTAS',
    'activityId', p_actividad_id,
    'rowRevision', v_activity."rowRevision",
    'notes', v_activity."notasTecnico",
    'replayed', false
  );

  perform public.cmc_emit_activity_outbox(
    p_actividad_id, v_activity."rowRevision", 'activity.notes.updated', v_response
  );
  perform public.cmc_finish_sync_mutation(v_receipt_id, 'APLICADA', v_response);
  return v_response;
end;
$function$;

-- ---------------------------------------------------------
-- RPC 2: respuestas de una matriz asignada
-- ---------------------------------------------------------
create or replace function public.cmc_guardar_respuestas_matriz(
  p_actividad_id integer,
  p_asignacion_id integer,
  p_respuestas jsonb,
  p_client_mutation_id text,
  p_expected_revision bigint
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, auth, extensions
as $function$
declare
  v_actor_id integer;
  v_activity public."OrdenTrabajoActividad"%rowtype;
  v_assignment public."ActividadMatrizAsignada"%rowtype;
  v_receipt_id bigint;
  v_replay boolean;
  v_stored jsonb;
  v_request jsonb := jsonb_build_object(
    'activityId', p_actividad_id,
    'assignmentId', p_asignacion_id,
    'answers', p_respuestas,
    'expectedRevision', p_expected_revision
  );
  v_response jsonb;
  v_complete boolean;
begin
  if p_expected_revision is null or p_expected_revision < 1 then
    raise exception 'expectedRevision debe ser un entero positivo.' using errcode = '22023';
  end if;
  if jsonb_typeof(p_respuestas) <> 'array' or jsonb_array_length(p_respuestas) = 0 then
    raise exception 'respuestas debe ser un arreglo no vacio.' using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_respuestas) r
    group by nullif(r ->> 'matrizItemId', '')::integer
    having count(*) > 1
  ) then
    raise exception 'El payload contiene items de matriz duplicados.' using errcode = '22023';
  end if;

  v_actor_id := public.cmc_assert_activity_mutation_access(p_actividad_id, false);

  select receipt_id, replay, stored_response
  into v_receipt_id, v_replay, v_stored
  from public.cmc_begin_sync_mutation(
    p_client_mutation_id, 'GUARDAR_RESPUESTAS', p_actividad_id, v_request
  );

  if v_replay then
    return jsonb_set(v_stored, '{replayed}', 'true'::jsonb, true);
  end if;

  perform set_config('cmcing.client_mutation_id', btrim(p_client_mutation_id), true);
  perform set_config('cmcing.audit_source', 'sync_rpc:respuestas', true);

  select * into v_activity
  from public."OrdenTrabajoActividad"
  where "id" = p_actividad_id
  for update;

  if not found then
    raise exception 'Actividad no encontrada.' using errcode = 'P0002';
  end if;
  if v_activity."rowRevision" is distinct from p_expected_revision then
    return public.cmc_record_sync_conflict(
      v_receipt_id, p_actividad_id, 'GUARDAR_RESPUESTAS', p_expected_revision,
      v_activity."rowRevision", v_request
    );
  end if;
  if v_activity."bloqueada" then
    raise exception 'La actividad esta bloqueada.' using errcode = '42501';
  end if;

  select * into v_assignment
  from public."ActividadMatrizAsignada"
  where "id" = p_asignacion_id
    and "ordenTrabajoActividadId" = p_actividad_id
  for update;

  if not found then
    raise exception 'Matriz asignada no encontrada en la actividad.' using errcode = 'P0002';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_respuestas) r
    where nullif(r ->> 'matrizItemId', '') is null
       or not exists (
         select 1
         from jsonb_array_elements(v_assignment."definitionSnapshot" -> 'items') item
         where (item ->> 'itemId')::integer = (r ->> 'matrizItemId')::integer
       )
  ) then
    raise exception 'El payload contiene un item ajeno al snapshot asignado.' using errcode = '23514';
  end if;

  insert into public."ActividadMatrizRespuesta" (
    "actividadMatrizAsignadaId", "matrizItemId", "valorNumero",
    "valorBooleano", "valorTexto", "valorOpciones", "respondidoByUsuarioId",
    "respondidoAt"
  )
  select
    p_asignacion_id,
    (r ->> 'matrizItemId')::integer,
    nullif(r ->> 'valorNumero', '')::numeric,
    case when r ? 'valorBooleano' and jsonb_typeof(r -> 'valorBooleano') = 'boolean'
      then (r ->> 'valorBooleano')::boolean else null end,
    nullif(r ->> 'valorTexto', ''),
    case when r ? 'valorOpciones' then r -> 'valorOpciones' else null end,
    v_actor_id,
    now()
  from jsonb_array_elements(p_respuestas) r
  on conflict ("actividadMatrizAsignadaId", "matrizItemId") do update
  set
    "valorNumero" = excluded."valorNumero",
    "valorBooleano" = excluded."valorBooleano",
    "valorTexto" = excluded."valorTexto",
    "valorOpciones" = excluded."valorOpciones",
    "respondidoByUsuarioId" = v_actor_id,
    "respondidoAt" = now(),
    "updatedAt" = now();

  select not exists (
    select 1
    from jsonb_array_elements(v_assignment."definitionSnapshot" -> 'items') item
    where coalesce((item ->> 'requerido')::boolean, false)
      and not exists (
        select 1
        from public."ActividadMatrizRespuesta" answer
        where answer."actividadMatrizAsignadaId" = p_asignacion_id
          and answer."matrizItemId" = (item ->> 'itemId')::integer
      )
  ) into v_complete;

  update public."ActividadMatrizAsignada"
  set
    "estado" = case when v_complete then 'completa' else 'pendiente' end,
    "completedAt" = case when v_complete then coalesce("completedAt", now()) else null end,
    "updatedAt" = now()
  where "id" = p_asignacion_id;

  select * into v_activity
  from public."OrdenTrabajoActividad"
  where "id" = p_actividad_id;

  v_response := jsonb_build_object(
    'ok', true,
    'status', 'applied',
    'operation', 'GUARDAR_RESPUESTAS',
    'activityId', p_actividad_id,
    'assignmentId', p_asignacion_id,
    'assignmentComplete', v_complete,
    'rowRevision', v_activity."rowRevision",
    'replayed', false
  );

  perform public.cmc_emit_activity_outbox(
    p_actividad_id, v_activity."rowRevision", 'activity.matrix.answers.saved', v_response
  );
  perform public.cmc_finish_sync_mutation(v_receipt_id, 'APLICADA', v_response);
  return v_response;
end;
$function$;

-- ---------------------------------------------------------
-- RPC 3: cierre atomico y bloqueo total
-- ---------------------------------------------------------
create or replace function public.cmc_cerrar_actividad(
  p_actividad_id integer,
  p_client_mutation_id text,
  p_expected_revision bigint
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, auth, extensions
as $function$
declare
  v_actor_id integer;
  v_activity public."OrdenTrabajoActividad"%rowtype;
  v_receipt_id bigint;
  v_replay boolean;
  v_stored jsonb;
  v_request jsonb := jsonb_build_object(
    'activityId', p_actividad_id,
    'expectedRevision', p_expected_revision
  );
  v_response jsonb;
begin
  if p_expected_revision is null or p_expected_revision < 1 then
    raise exception 'expectedRevision debe ser un entero positivo.' using errcode = '22023';
  end if;

  v_actor_id := public.cmc_assert_activity_mutation_access(p_actividad_id, false);

  select receipt_id, replay, stored_response
  into v_receipt_id, v_replay, v_stored
  from public.cmc_begin_sync_mutation(
    p_client_mutation_id, 'CERRAR_ACTIVIDAD', p_actividad_id, v_request
  );

  if v_replay then
    return jsonb_set(v_stored, '{replayed}', 'true'::jsonb, true);
  end if;

  perform set_config('cmcing.client_mutation_id', btrim(p_client_mutation_id), true);
  perform set_config('cmcing.audit_source', 'sync_rpc:cierre', true);

  select * into v_activity
  from public."OrdenTrabajoActividad"
  where "id" = p_actividad_id
  for update;

  if not found then
    raise exception 'Actividad no encontrada.' using errcode = 'P0002';
  end if;
  if v_activity."rowRevision" is distinct from p_expected_revision then
    return public.cmc_record_sync_conflict(
      v_receipt_id, p_actividad_id, 'CERRAR_ACTIVIDAD', p_expected_revision,
      v_activity."rowRevision", v_request
    );
  end if;
  if v_activity."bloqueada" or v_activity."estado" = 'cerrada' then
    raise exception 'La actividad ya esta cerrada y bloqueada.' using errcode = '55000';
  end if;

  if exists (
    select 1
    from public."ActividadMatrizAsignada" am
    where am."ordenTrabajoActividadId" = p_actividad_id
      and am."obligatoria"
      and (
        am."estado" <> 'completa'
        or exists (
          select 1
          from jsonb_array_elements(am."definitionSnapshot" -> 'items') item
          where coalesce((item ->> 'requerido')::boolean, false)
            and not exists (
              select 1
              from public."ActividadMatrizRespuesta" answer
              where answer."actividadMatrizAsignadaId" = am."id"
                and answer."matrizItemId" = (item ->> 'itemId')::integer
            )
        )
      )
  ) then
    raise exception 'No se puede cerrar: faltan matrices obligatorias o respuestas requeridas.'
      using errcode = '23514';
  end if;

  update public."OrdenTrabajoActividad"
  set
    "estado" = 'cerrada',
    "fechaCierre" = now(),
    "bloqueada" = true,
    "bloqueadaAt" = now(),
    "updatedByUsuarioId" = v_actor_id,
    "updatedAt" = now()
  where "id" = p_actividad_id
  returning * into v_activity;

  v_response := jsonb_build_object(
    'ok', true,
    'status', 'applied',
    'operation', 'CERRAR_ACTIVIDAD',
    'activityId', p_actividad_id,
    'state', v_activity."estado",
    'locked', v_activity."bloqueada",
    'closedAt', v_activity."fechaCierre",
    'rowRevision', v_activity."rowRevision",
    'replayed', false
  );

  perform public.cmc_emit_activity_outbox(
    p_actividad_id, v_activity."rowRevision", 'activity.closed', v_response
  );
  perform public.cmc_finish_sync_mutation(v_receipt_id, 'APLICADA', v_response);
  return v_response;
end;
$function$;

-- ---------------------------------------------------------
-- RPC 4: desbloqueo administrativo con motivo obligatorio
-- ---------------------------------------------------------
create or replace function public.cmc_desbloquear_actividad(
  p_actividad_id integer,
  p_motivo text,
  p_client_mutation_id text,
  p_expected_revision bigint
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, auth, extensions
as $function$
declare
  v_actor_id integer;
  v_activity public."OrdenTrabajoActividad"%rowtype;
  v_receipt_id bigint;
  v_replay boolean;
  v_stored jsonb;
  v_request jsonb := jsonb_build_object(
    'activityId', p_actividad_id,
    'reason', p_motivo,
    'expectedRevision', p_expected_revision
  );
  v_response jsonb;
begin
  if p_expected_revision is null or p_expected_revision < 1 then
    raise exception 'expectedRevision debe ser un entero positivo.' using errcode = '22023';
  end if;
  if char_length(btrim(coalesce(p_motivo, ''))) < 10 then
    raise exception 'El motivo de desbloqueo debe tener al menos 10 caracteres.' using errcode = '22023';
  end if;

  v_actor_id := public.cmc_assert_activity_mutation_access(p_actividad_id, true);

  select receipt_id, replay, stored_response
  into v_receipt_id, v_replay, v_stored
  from public.cmc_begin_sync_mutation(
    p_client_mutation_id, 'DESBLOQUEAR_ACTIVIDAD', p_actividad_id, v_request
  );

  if v_replay then
    return jsonb_set(v_stored, '{replayed}', 'true'::jsonb, true);
  end if;

  perform set_config('cmcing.client_mutation_id', btrim(p_client_mutation_id), true);
  perform set_config('cmcing.audit_source', 'sync_rpc:desbloqueo', true);

  select * into v_activity
  from public."OrdenTrabajoActividad"
  where "id" = p_actividad_id
  for update;

  if not found then
    raise exception 'Actividad no encontrada.' using errcode = 'P0002';
  end if;
  if v_activity."rowRevision" is distinct from p_expected_revision then
    return public.cmc_record_sync_conflict(
      v_receipt_id, p_actividad_id, 'DESBLOQUEAR_ACTIVIDAD', p_expected_revision,
      v_activity."rowRevision", v_request
    );
  end if;
  if not v_activity."bloqueada" then
    raise exception 'La actividad no esta bloqueada.' using errcode = '55000';
  end if;

  perform set_config('cmcing.internal_unlock', txid_current()::text, true);

  update public."OrdenTrabajoActividad"
  set
    "estado" = 'abierta',
    "bloqueada" = false,
    "fechaCierre" = null,
    "desbloqueadaAt" = now(),
    "motivoDesbloqueo" = btrim(p_motivo),
    "updatedByUsuarioId" = v_actor_id,
    "updatedAt" = now()
  where "id" = p_actividad_id
  returning * into v_activity;

  v_response := jsonb_build_object(
    'ok', true,
    'status', 'applied',
    'operation', 'DESBLOQUEAR_ACTIVIDAD',
    'activityId', p_actividad_id,
    'state', v_activity."estado",
    'locked', v_activity."bloqueada",
    'unlockedAt', v_activity."desbloqueadaAt",
    'rowRevision', v_activity."rowRevision",
    'replayed', false
  );

  perform public.cmc_emit_activity_outbox(
    p_actividad_id, v_activity."rowRevision", 'activity.unlocked',
    v_response || jsonb_build_object('reason', btrim(p_motivo))
  );
  perform public.cmc_finish_sync_mutation(v_receipt_id, 'APLICADA', v_response);
  return v_response;
end;
$function$;

-- ---------------------------------------------------------
-- RPC administrativo: publicar una matriz congelando snapshot/hash
-- ---------------------------------------------------------
create or replace function public.cmc_publicar_matriz(
  p_matriz_id integer,
  p_expected_revision bigint
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, auth, extensions
as $function$
declare
  v_matrix public."MatrizCumplimiento"%rowtype;
  v_snapshot jsonb;
  v_hash text;
begin
  if p_expected_revision is null or p_expected_revision < 1 then
    raise exception 'expectedRevision debe ser un entero positivo.' using errcode = '22023';
  end if;
  if not public.cmc_has_any_role(array['SUPERADMIN', 'ADMIN']) then
    raise exception 'Publicar matrices requiere un administrador.' using errcode = '42501';
  end if;

  select * into v_matrix
  from public."MatrizCumplimiento"
  where "id" = p_matriz_id
  for update;

  if not found then
    raise exception 'Matriz no encontrada.' using errcode = 'P0002';
  end if;
  if v_matrix."rowRevision" is distinct from p_expected_revision then
    raise exception 'La matriz fue modificada por otro usuario.' using errcode = '40001';
  end if;
  if v_matrix."estadoVersion" <> 'BORRADOR' then
    raise exception 'Solo una matriz en borrador puede publicarse.' using errcode = '23514';
  end if;
  if not exists (select 1 from public."MatrizItem" i where i."matrizId" = p_matriz_id) then
    raise exception 'La matriz requiere al menos un item.' using errcode = '23514';
  end if;

  if exists (
    select 1
    from public."MatrizItem" i
    where i."matrizId" = p_matriz_id
      and i."tipoRespuesta" = 'seleccion_multiple'
      and case
        when jsonb_typeof(i."opciones") <> 'array' then true
        else
          jsonb_array_length(i."opciones") < 2
          or exists (
            select 1
            from jsonb_array_elements(i."opciones") as option_row(value)
            where jsonb_typeof(option_row.value) <> 'string'
               or nullif(btrim(option_row.value #>> '{}'), '') is null
          )
          or (
            select count(*) from jsonb_array_elements(i."opciones")
          ) <> (
            select count(distinct option_row.value)
            from jsonb_array_elements(i."opciones") as option_row(value)
          )
      end
  ) then
    raise exception 'Cada seleccion multiple requiere al menos dos opciones de texto, no vacias y unicas.'
      using errcode = '23514';
  end if;

  v_snapshot := public.cmc_build_matrix_snapshot(p_matriz_id);
  v_hash := encode(extensions.digest(convert_to(v_snapshot::text, 'UTF8'), 'sha256'), 'hex');
  perform set_config('cmcing.matrix_publish', txid_current()::text, true);

  update public."MatrizCumplimiento"
  set
    "estadoVersion" = 'PUBLICADA',
    "contentSnapshot" = v_snapshot,
    "contentHashSha256" = v_hash,
    "publishedAt" = now(),
    "updatedAt" = now()
  where "id" = p_matriz_id
  returning * into v_matrix;

  return jsonb_build_object(
    'ok', true,
    'matrixId', v_matrix."id",
    'familyId', v_matrix."familiaId",
    'version', v_matrix."version",
    'rowRevision', v_matrix."rowRevision",
    'sha256', v_matrix."contentHashSha256"
  );
end;
$function$;

-- Se retiran las superficies legacy que aceptaban actorUsuarioId desde el
-- cliente. Conservamos las funciones para compatibilidad de DDL, pero sin
-- EXECUTE para roles API.
revoke execute on function public.desbloquear_orden_trabajo_actividad(integer, integer, text)
  from public, anon, authenticated, service_role;
revoke execute on function public.registrar_adjunto_actividad(integer, integer, jsonb)
  from public, anon, authenticated, service_role;

-- Funciones internas: nunca publicas.
revoke execute on function public.cmc_stamp_sync_conflict_resolution()
  from public, anon, authenticated;
revoke execute on function public.cmc_assert_activity_mutation_access(integer, boolean)
  from public, anon, authenticated;
revoke execute on function public.cmc_activity_sync_snapshot(integer)
  from public, anon, authenticated;
revoke execute on function public.cmc_begin_sync_mutation(text, text, integer, jsonb)
  from public, anon, authenticated;
revoke execute on function public.cmc_finish_sync_mutation(bigint, text, jsonb)
  from public, anon, authenticated;
revoke execute on function public.cmc_emit_activity_outbox(integer, bigint, text, jsonb)
  from public, anon, authenticated;
revoke execute on function public.cmc_record_sync_conflict(bigint, integer, text, bigint, bigint, jsonb)
  from public, anon, authenticated;

-- Superficie RPC minima para clientes autenticados.
revoke execute on function public.cmc_can_access_activity(integer) from public, anon;
grant execute on function public.cmc_can_access_activity(integer) to authenticated;

revoke execute on function public.cmc_actualizar_notas_actividad(integer, text, text, bigint)
  from public, anon;
grant execute on function public.cmc_actualizar_notas_actividad(integer, text, text, bigint)
  to authenticated;

revoke execute on function public.cmc_guardar_respuestas_matriz(integer, integer, jsonb, text, bigint)
  from public, anon;
grant execute on function public.cmc_guardar_respuestas_matriz(integer, integer, jsonb, text, bigint)
  to authenticated;

revoke execute on function public.cmc_cerrar_actividad(integer, text, bigint)
  from public, anon;
grant execute on function public.cmc_cerrar_actividad(integer, text, bigint)
  to authenticated;

revoke execute on function public.cmc_desbloquear_actividad(integer, text, text, bigint)
  from public, anon;
grant execute on function public.cmc_desbloquear_actividad(integer, text, text, bigint)
  to authenticated;

revoke execute on function public.cmc_publicar_matriz(integer, bigint)
  from public, anon;
grant execute on function public.cmc_publicar_matriz(integer, bigint)
  to authenticated;

commit;
