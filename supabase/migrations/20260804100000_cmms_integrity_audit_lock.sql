-- =========================================================
-- CMCing CMMS produccion - integridad, revision y auditoria
-- Dependencias: migraciones 20260715 y 2026080409*.sql
-- =========================================================

begin;

-- Revision monotona para concurrencia optimista/offline. La revision de la
-- actividad tambien se incrementa cuando cambia cualquiera de sus hijos.
alter table public."OrdenTrabajo"
  add column if not exists "rowRevision" bigint not null default 1;

alter table public."OrdenTrabajoActividad"
  add column if not exists "rowRevision" bigint not null default 1;

alter table public."ActividadMatrizAsignada"
  add column if not exists "rowRevision" bigint not null default 1;

alter table public."ActividadMatrizRespuesta"
  add column if not exists "rowRevision" bigint not null default 1;

alter table public."ArchivoAdjunto"
  add column if not exists "rowRevision" bigint not null default 1,
  add column if not exists "updatedAt" timestamptz not null default now();

create or replace function public.cmc_bump_row_revision()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $function$
begin
  new."rowRevision" := coalesce(old."rowRevision", 0) + 1;
  return new;
end;
$function$;

do $migration$
declare
  v_table text;
  v_trigger text;
begin
  foreach v_table in array array[
    'Usuario',
    'OrdenTrabajo',
    'OrdenTrabajoActividad',
    'ActividadMatrizAsignada',
    'ActividadMatrizRespuesta',
    'ArchivoAdjunto'
  ]
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

-- ---------------------------------------------------------
-- Auditoria append-only y sin cascada destructiva
-- ---------------------------------------------------------
alter table public."ActividadAuditoria"
  drop constraint if exists "ActividadAuditoria_ordenTrabajoActividadId_fkey";

alter table public."ActividadAuditoria"
  add constraint "ActividadAuditoria_ordenTrabajoActividadId_fkey"
  foreign key ("ordenTrabajoActividadId")
  references public."OrdenTrabajoActividad"("id")
  on delete restrict;

alter table public."ActividadAuditoria"
  drop constraint if exists "ActividadAuditoria_actorUsuarioId_fkey";

alter table public."ActividadAuditoria"
  add constraint "ActividadAuditoria_actorUsuarioId_fkey"
  foreign key ("actorUsuarioId")
  references public."Usuario"("id")
  on delete restrict;

alter table public."ActividadAuditoria"
  drop constraint if exists "ActividadAuditoria_accion_check";

alter table public."ActividadAuditoria"
  add column if not exists "actorAuthUserId" uuid,
  add column if not exists "actorEmailSnapshot" text,
  add column if not exists "clientMutationId" text,
  add column if not exists "rowRevisionAntes" bigint,
  add column if not exists "rowRevisionDespues" bigint,
  add column if not exists "source" text not null default 'database_trigger',
  add column if not exists "metadata" jsonb not null default '{}'::jsonb;

alter table public."ActividadAuditoria"
  drop constraint if exists "ActividadAuditoria_actorAuthUserId_fkey";

alter table public."ActividadAuditoria"
  add constraint "ActividadAuditoria_actorAuthUserId_fkey"
  foreign key ("actorAuthUserId") references auth.users(id) on delete restrict;

alter table public."ActividadAuditoria"
  add constraint "ActividadAuditoria_accion_check"
  check ("accion" in (
    'CREACION', 'ACTUALIZACION', 'CIERRE', 'DESBLOQUEO',
    'HIJO_CREACION', 'HIJO_ACTUALIZACION', 'HIJO_ELIMINACION',
    'CONFLICTO_SYNC', 'DOCUMENTO_GENERADO'
  ));

-- Un unico RPC puede insertar varias respuestas/hijos con el mismo mutationId;
-- por eso este indice es de consulta y no de unicidad.
drop index if exists public."ActividadAuditoria_mutation_event_key";
create index if not exists "ActividadAuditoria_mutation_idx"
  on public."ActividadAuditoria"("clientMutationId", "createdAt")
  where "clientMutationId" is not null;

create index if not exists "ActividadAuditoria_actor_idx"
  on public."ActividadAuditoria"("actorAuthUserId", "createdAt" desc);

create or replace function public.cmc_block_audit_mutation()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $function$
begin
  raise exception 'La auditoria es append-only y no admite UPDATE ni DELETE.'
    using errcode = '42501';
end;
$function$;

drop trigger if exists trg_actividad_auditoria_append_only on public."ActividadAuditoria";
create trigger trg_actividad_auditoria_append_only
before update or delete on public."ActividadAuditoria"
for each row execute function public.cmc_block_audit_mutation();

-- ---------------------------------------------------------
-- Estado y bloqueo fuerte de la actividad
-- ---------------------------------------------------------
create or replace function public.cmc_enforce_activity_state()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $function$
declare
  v_unlock_marker text := coalesce(current_setting('cmcing.internal_unlock', true), '');
begin
  if tg_op = 'UPDATE' then
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

drop trigger if exists trg_proteger_ot_actividad_bloqueada on public."OrdenTrabajoActividad";
drop trigger if exists trg_cmc_enforce_activity_state on public."OrdenTrabajoActividad";
create trigger trg_cmc_enforce_activity_state
before insert or update on public."OrdenTrabajoActividad"
for each row execute function public.cmc_enforce_activity_state();

create or replace function public.cmc_prevent_activity_delete()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $function$
begin
  -- Una actividad posee auditoria desde su creacion. El DELETE queda prohibido
  -- incluso si esta abierta; cancelar/conservar mantiene la trazabilidad.
  raise exception 'Las actividades no se eliminan; deben conservarse para auditoria.'
    using errcode = '42501';
end;
$function$;

drop trigger if exists trg_cmc_prevent_activity_delete on public."OrdenTrabajoActividad";
create trigger trg_cmc_prevent_activity_delete
before delete on public."OrdenTrabajoActividad"
for each row execute function public.cmc_prevent_activity_delete();

-- Actor y email quedan congelados en cada evento. Se ignoran por completo los
-- campos updatedByUsuarioId/createdByUsuarioId enviados por el cliente.
create or replace function public.fn_auditar_ot_actividad()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $function$
declare
  v_accion text;
  v_actor_id integer := public.cmc_current_usuario_id();
  v_actor_auth uuid := auth.uid();
  v_actor_email text;
  v_motivo text;
  v_mutation_id text := nullif(current_setting('cmcing.client_mutation_id', true), '');
  v_source text := coalesce(nullif(current_setting('cmcing.audit_source', true), ''), 'database_trigger');
begin
  if v_actor_id is not null then
    select u."email" into v_actor_email
    from public."Usuario" u
    where u."id" = v_actor_id;
  end if;

  if tg_op = 'INSERT' then
    insert into public."ActividadAuditoria" (
      "ordenTrabajoActividadId", "accion", "actorUsuarioId", "actorAuthUserId",
      "actorEmailSnapshot", "clientMutationId", "datosDespues",
      "rowRevisionDespues", "source"
    )
    values (
      new."id", 'CREACION', v_actor_id, v_actor_auth, v_actor_email,
      v_mutation_id, to_jsonb(new), new."rowRevision", v_source
    );
    return new;
  end if;

  -- El touch automatico de un hijo solo cambia revision/updatedAt y el propio
  -- hijo genera su evento detallado; no duplicamos ruido aqui.
  if (to_jsonb(old) - 'rowRevision' - 'updatedAt')
     = (to_jsonb(new) - 'rowRevision' - 'updatedAt') then
    return new;
  end if;

  if old."bloqueada" and not new."bloqueada" then
    v_accion := 'DESBLOQUEO';
    v_motivo := new."motivoDesbloqueo";
  elsif old."estado" is distinct from new."estado" and new."estado" = 'cerrada' then
    v_accion := 'CIERRE';
    v_motivo := 'Cierre de actividad';
  else
    v_accion := 'ACTUALIZACION';
  end if;

  insert into public."ActividadAuditoria" (
    "ordenTrabajoActividadId", "accion", "actorUsuarioId", "actorAuthUserId",
    "actorEmailSnapshot", "clientMutationId", "motivo", "datosAntes", "datosDespues",
    "rowRevisionAntes", "rowRevisionDespues", "source"
  )
  values (
    new."id", v_accion, v_actor_id, v_actor_auth, v_actor_email,
    v_mutation_id, v_motivo, to_jsonb(old), to_jsonb(new),
    old."rowRevision", new."rowRevision", v_source
  );

  return new;
end;
$function$;

drop trigger if exists trg_auditar_ot_actividad_insert on public."OrdenTrabajoActividad";
drop trigger if exists trg_auditar_ot_actividad_update on public."OrdenTrabajoActividad";
create trigger trg_auditar_ot_actividad_insert
after insert on public."OrdenTrabajoActividad"
for each row execute function public.fn_auditar_ot_actividad();

create trigger trg_auditar_ot_actividad_update
after update on public."OrdenTrabajoActividad"
for each row execute function public.fn_auditar_ot_actividad();

-- Normaliza cierres creados por la version legacy antes de que el trigger
-- fuerte existiera. El UPDATE queda auditado y no elimina ningun dato.
update public."OrdenTrabajoActividad"
set
  "bloqueada" = true,
  "bloqueadaAt" = coalesce("bloqueadaAt", "fechaCierre", "updatedAt", now()),
  "fechaCierre" = coalesce("fechaCierre", "updatedAt", now()),
  "updatedAt" = now()
where "estado" = 'cerrada'
  and not "bloqueada";

-- Resuelve el padre de cualquiera de los hijos actuales. Los documentos se
-- incorporan en la migracion siguiente y reutilizan estas funciones.
create or replace function public.cmc_activity_id_for_child(
  p_table_name text,
  p_row jsonb
)
returns integer
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $function$
declare
  v_activity_id integer;
begin
  if p_table_name in ('ArchivoAdjunto', 'ActividadMatrizAsignada', 'ActividadDocumento') then
    v_activity_id := nullif(p_row ->> 'ordenTrabajoActividadId', '')::integer;
  elsif p_table_name = 'ActividadMatrizRespuesta' then
    select ama."ordenTrabajoActividadId" into v_activity_id
    from public."ActividadMatrizAsignada" ama
    where ama."id" = nullif(p_row ->> 'actividadMatrizAsignadaId', '')::integer;
  else
    raise exception 'Hijo de actividad no soportado: %', p_table_name using errcode = '22023';
  end if;

  return v_activity_id;
end;
$function$;

create or replace function public.cmc_guard_activity_child_locked()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  v_old_activity_id integer;
  v_new_activity_id integer;
  v_locked boolean;
begin
  if tg_op in ('UPDATE', 'DELETE') then
    v_old_activity_id := public.cmc_activity_id_for_child(tg_table_name, to_jsonb(old));
  end if;
  if tg_op in ('INSERT', 'UPDATE') then
    v_new_activity_id := public.cmc_activity_id_for_child(tg_table_name, to_jsonb(new));
  end if;

  if tg_op = 'UPDATE'
     and v_old_activity_id is distinct from v_new_activity_id
     and not (
       tg_table_name = 'ArchivoAdjunto'
       and v_old_activity_id is null
       and v_new_activity_id is not null
     ) then
    raise exception 'La relacion entre un hijo y su actividad es inmutable.' using errcode = '42501';
  end if;

  if v_old_activity_id is not null then
    select a."bloqueada" into v_locked
    from public."OrdenTrabajoActividad" a
    where a."id" = v_old_activity_id;

    if not found then
      raise exception 'Actividad padre anterior no encontrada.' using errcode = '23503';
    end if;
    if v_locked then
      raise exception 'La actividad esta bloqueada; sus notas, respuestas, matrices, imagenes y documentos son inmutables.'
        using errcode = '42501';
    end if;
  end if;

  if v_new_activity_id is not null
     and v_new_activity_id is distinct from v_old_activity_id then
    select a."bloqueada" into v_locked
    from public."OrdenTrabajoActividad" a
    where a."id" = v_new_activity_id;

    if not found then
      raise exception 'Actividad padre nueva no encontrada.' using errcode = '23503';
    end if;
    if v_locked then
      raise exception 'La actividad esta bloqueada; sus notas, respuestas, matrices, imagenes y documentos son inmutables.'
        using errcode = '42501';
    end if;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$function$;

create or replace function public.cmc_audit_activity_child()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $function$
declare
  v_row jsonb;
  v_activity_id integer;
  v_actor_id integer := public.cmc_current_usuario_id();
  v_actor_auth uuid := auth.uid();
  v_actor_email text;
  v_action text;
  v_mutation_id text := nullif(current_setting('cmcing.client_mutation_id', true), '');
begin
  if tg_op = 'DELETE' then
    v_row := to_jsonb(old);
  else
    v_row := to_jsonb(new);
  end if;

  v_activity_id := public.cmc_activity_id_for_child(tg_table_name, v_row);
  if v_activity_id is null then
    if tg_op = 'DELETE' then
      return old;
    end if;
    return new;
  end if;

  if v_actor_id is not null then
    select u."email" into v_actor_email
    from public."Usuario" u where u."id" = v_actor_id;
  end if;

  v_action := case tg_op
    when 'INSERT' then 'HIJO_CREACION'
    when 'UPDATE' then 'HIJO_ACTUALIZACION'
    else 'HIJO_ELIMINACION'
  end;

  insert into public."ActividadAuditoria" (
    "ordenTrabajoActividadId", "accion", "actorUsuarioId", "actorAuthUserId",
    "actorEmailSnapshot", "clientMutationId", "motivo", "datosAntes", "datosDespues",
    "source", "metadata"
  )
  values (
    v_activity_id,
    v_action,
    v_actor_id,
    v_actor_auth,
    v_actor_email,
    v_mutation_id,
    tg_table_name || ' ' || lower(tg_op),
    case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) else null end,
    case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) else null end,
    coalesce(nullif(current_setting('cmcing.audit_source', true), ''), 'child_trigger'),
    jsonb_build_object('table', tg_table_name, 'operation', tg_op)
  );

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$function$;

create or replace function public.cmc_touch_activity_from_child()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  v_row jsonb;
  v_activity_id integer;
begin
  if tg_op = 'DELETE' then
    v_row := to_jsonb(old);
  else
    v_row := to_jsonb(new);
  end if;

  v_activity_id := public.cmc_activity_id_for_child(tg_table_name, v_row);
  if v_activity_id is not null then
    update public."OrdenTrabajoActividad"
    set "updatedAt" = now()
    where "id" = v_activity_id
      and not "bloqueada";
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$function$;

do $migration$
declare
  v_table text;
  v_slug text;
begin
  foreach v_table in array array[
    'ArchivoAdjunto',
    'ActividadMatrizAsignada',
    'ActividadMatrizRespuesta'
  ]
  loop
    v_slug := lower(v_table);
    execute format('drop trigger if exists %I on public.%I', 'trg_' || v_slug || '_activity_lock', v_table);
    execute format(
      'create trigger %I before insert or update or delete on public.%I for each row execute function public.cmc_guard_activity_child_locked()',
      'trg_' || v_slug || '_activity_lock',
      v_table
    );

    execute format('drop trigger if exists %I on public.%I', 'trg_' || v_slug || '_activity_audit', v_table);
    execute format(
      'create trigger %I after insert or update or delete on public.%I for each row execute function public.cmc_audit_activity_child()',
      'trg_' || v_slug || '_activity_audit',
      v_table
    );

    execute format('drop trigger if exists %I on public.%I', 'trg_' || v_slug || '_activity_touch', v_table);
    execute format(
      'create trigger %I after insert or update or delete on public.%I for each row execute function public.cmc_touch_activity_from_child()',
      'trg_' || v_slug || '_activity_touch',
      v_table
    );
  end loop;
end;
$migration$;

-- Ninguna funcion SECURITY DEFINER del esquema public queda ejecutable por
-- PUBLIC de forma implicita. Las migraciones posteriores conceden solo los
-- RPC expresamente publicados para authenticated.
do $migration$
declare
  v_function regprocedure;
begin
  for v_function in
    select p.oid::regprocedure
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prosecdef
  loop
    execute format('revoke execute on function %s from public', v_function);
    execute format('revoke execute on function %s from anon', v_function);
  end loop;
end;
$migration$;

-- Los helpers RLS si son invocables por authenticated.
grant execute on function public.cmc_current_usuario_id() to authenticated;
grant execute on function public.cmc_current_tecnico_id() to authenticated;
grant execute on function public.cmc_current_role() to authenticated;
grant execute on function public.cmc_is_active_user() to authenticated;
grant execute on function public.cmc_has_any_role(text[]) to authenticated;

commit;
