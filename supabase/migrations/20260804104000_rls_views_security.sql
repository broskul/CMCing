-- =========================================================
-- CMCing CMMS produccion - RLS/RBAC y vistas security_invoker
-- Dependencia: todas las migraciones anteriores 20260804
-- =========================================================

begin;

-- Preflight de orden. Esta migracion no intenta crear maestros ausentes porque
-- deben provenir de 20260720 con su backfill/constraints completos.
do $migration$
declare
  v_table text;
begin
  foreach v_table in array array[
    'ClienteContacto', 'ClienteDireccion', 'Camion', 'Conductor',
    'CamionConductor', 'CamionFoto', 'OrdenTrabajo', 'OrdenTrabajoActividad',
    'MatrizCumplimiento', 'MatrizAlcance', 'ActividadDocumento'
  ]
  loop
    if to_regclass(format('public.%I', v_table)) is null then
      raise exception 'Falta public.%; aplique primero 20260701, 20260715 y 20260720, y luego 20260804 en orden.', v_table;
    end if;
  end loop;
end;
$migration$;

-- Helpers para politicas que atraviesan relaciones.
create or replace function public.cmc_can_access_assignment(p_asignacion_id integer)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $function$
  select exists (
    select 1
    from public."ActividadMatrizAsignada" a
    where a."id" = p_asignacion_id
      and public.cmc_can_access_activity(a."ordenTrabajoActividadId")
  );
$function$;

create or replace function public.cmc_can_access_visita(p_visita_id integer)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, auth
as $function$
  select exists (
    select 1
    from public."Visita" v
    join public."Usuario" u
      on u."authUserId" = auth.uid() and u."activo"
    where v."id" = p_visita_id
      and (
        u."rol"::text in ('SUPERADMIN', 'ADMIN', 'OPERACIONES', 'LECTURA')
        or (u."rol"::text = 'TECNICO' and u."tecnicoId" = v."tecnicoId")
      )
  );
$function$;

create or replace function public.cmc_can_access_work_order(p_orden_trabajo_id integer)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, auth
as $function$
  select exists (
    select 1
    from public."OrdenTrabajo" ot
    join public."Usuario" u
      on u."authUserId" = auth.uid() and u."activo"
    where ot."id" = p_orden_trabajo_id
      and (
        u."rol"::text in ('SUPERADMIN', 'ADMIN', 'OPERACIONES', 'LECTURA')
        or (
          u."rol"::text = 'TECNICO'
          and exists (
            select 1
            from public."OrdenTrabajoActividad" a
            where a."ordenTrabajoId" = ot."id"
              and a."tecnicoId" = u."tecnicoId"
          )
        )
      )
  );
$function$;

create or replace function public.cmc_can_access_client(p_cliente_id integer)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, auth
as $function$
  select exists (
    select 1
    from public."Usuario" u
    where u."authUserId" = auth.uid()
      and u."activo"
      and (
        u."rol"::text in ('SUPERADMIN', 'ADMIN', 'OPERACIONES', 'LECTURA')
        or (
          u."rol"::text = 'TECNICO'
          and (
            exists (
              select 1
              from public."OrdenTrabajo" ot
              join public."OrdenTrabajoActividad" a on a."ordenTrabajoId" = ot."id"
              where ot."clienteId" = p_cliente_id
                and a."tecnicoId" = u."tecnicoId"
            )
            or exists (
              select 1
              from public."Visita" v
              where v."clienteId" = p_cliente_id
                and v."tecnicoId" = u."tecnicoId"
            )
          )
        )
      )
  );
$function$;

create or replace function public.cmc_can_access_equipment(p_equipo_id integer)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, auth
as $function$
  select exists (
    select 1
    from public."Usuario" u
    where u."authUserId" = auth.uid()
      and u."activo"
      and (
        u."rol"::text in ('SUPERADMIN', 'ADMIN', 'OPERACIONES', 'LECTURA')
        or (
          u."rol"::text = 'TECNICO'
          and (
            exists (
              select 1
              from public."OrdenTrabajoActividad" a
              join public."OrdenTrabajo" ot on ot."id" = a."ordenTrabajoId"
              left join public."OrdenTrabajoEquipo" ote
                on ote."ordenTrabajoId" = ot."id" and ote."equipoId" = p_equipo_id
              where a."tecnicoId" = u."tecnicoId"
                and (ot."equipoId" = p_equipo_id or ote."equipoId" is not null)
            )
            or exists (
              select 1
              from public."Visita" v
              left join public."VisitaEquipo" ve
                on ve."visitaId" = v."id" and ve."equipoId" = p_equipo_id
              where v."tecnicoId" = u."tecnicoId"
                and (v."equipoId" = p_equipo_id or ve."equipoId" is not null)
            )
          )
        )
      )
  );
$function$;

create or replace function public.cmc_can_access_matrix(p_matriz_id integer)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, auth
as $function$
  select exists (
    select 1
    from public."Usuario" u
    join public."MatrizCumplimiento" m on m."id" = p_matriz_id
    where u."authUserId" = auth.uid()
      and u."activo"
      and (
        u."rol"::text in ('SUPERADMIN', 'ADMIN', 'OPERACIONES')
        or (
          u."rol"::text = 'LECTURA'
          and m."activa"
          and m."estadoVersion" = 'PUBLICADA'
        )
        or (
          u."rol"::text = 'TECNICO'
          and m."activa"
          and m."estadoVersion" = 'PUBLICADA'
          and (
            exists (
              select 1
              from public."ActividadMatrizAsignada" assignment
              join public."OrdenTrabajoActividad" activity
                on activity."id" = assignment."ordenTrabajoActividadId"
              where assignment."matrizId" = m."id"
                and activity."tecnicoId" = u."tecnicoId"
            )
            or exists (
              select 1
              from public."MatrizAlcance" scope
              where scope."matrizId" = m."id"
                and scope."active"
                and (
                  scope."alcanceTipo" = 'GLOBAL'
                  or (
                    scope."alcanceTipo" = 'TIPO_ACTIVIDAD'
                    and exists (
                      select 1
                      from public."OrdenTrabajoActividad" assigned_activity
                      where assigned_activity."tecnicoId" = u."tecnicoId"
                        and assigned_activity."actividadId" = scope."actividadId"
                    )
                  )
                  or (scope."alcanceTipo" = 'CLIENTE' and public.cmc_can_access_client(scope."clienteId"))
                  or (scope."alcanceTipo" = 'EQUIPO' and public.cmc_can_access_equipment(scope."equipoId"))
                )
            )
          )
        )
      )
  );
$function$;

-- ---------------------------------------------------------
-- Identidad y configuracion de acceso
-- ---------------------------------------------------------
alter table public."Usuario" enable row level security;
alter table public."Usuario" force row level security;
alter table public."AuthAccessRule" enable row level security;
alter table public."AuthAccessRule" force row level security;

drop policy if exists cmc_usuario_read on public."Usuario";
create policy cmc_usuario_read
on public."Usuario"
for select to authenticated
using (
  "authUserId" = auth.uid()
  or public.cmc_has_any_role(array['SUPERADMIN', 'ADMIN'])
);

drop policy if exists cmc_usuario_superadmin_insert on public."Usuario";
create policy cmc_usuario_superadmin_insert
on public."Usuario"
for insert to authenticated
with check (public.cmc_has_any_role(array['SUPERADMIN']));

drop policy if exists cmc_usuario_superadmin_update on public."Usuario";
create policy cmc_usuario_superadmin_update
on public."Usuario"
for update to authenticated
using (public.cmc_has_any_role(array['SUPERADMIN']))
with check (public.cmc_has_any_role(array['SUPERADMIN']));

drop policy if exists cmc_auth_rule_superadmin_read on public."AuthAccessRule";
create policy cmc_auth_rule_superadmin_read
on public."AuthAccessRule"
for select to authenticated
using (public.cmc_has_any_role(array['SUPERADMIN']));

drop policy if exists cmc_auth_rule_superadmin_insert on public."AuthAccessRule";
create policy cmc_auth_rule_superadmin_insert
on public."AuthAccessRule"
for insert to authenticated
with check (public.cmc_has_any_role(array['SUPERADMIN']));

drop policy if exists cmc_auth_rule_superadmin_update on public."AuthAccessRule";
create policy cmc_auth_rule_superadmin_update
on public."AuthAccessRule"
for update to authenticated
using (public.cmc_has_any_role(array['SUPERADMIN']))
with check (public.cmc_has_any_role(array['SUPERADMIN']));

revoke all on table public."Usuario", public."AuthAccessRule" from public, anon, authenticated;
grant select, insert, update on table public."Usuario" to authenticated;
grant select, insert, update on table public."AuthAccessRule" to authenticated;

-- ---------------------------------------------------------
-- Maestros: lectura para usuarios activos; escritura OPERACIONES+
-- ---------------------------------------------------------
do $migration$
declare
  v_table text;
  v_slug text;
begin
  foreach v_table in array array[
    'Cliente', 'ClienteContacto', 'ClienteDireccion',
    'Equipo', 'Servicio', 'Vendedor', 'Tecnico', 'Actividad',
    'MedicionCatalogo', 'MatrizCumplimiento', 'MatrizItem', 'MatrizAlcance',
    'ActividadMatrizDefault', 'Camion', 'Conductor', 'CamionConductor', 'CamionFoto'
  ]
  loop
    v_slug := lower(v_table);
    execute format('alter table public.%I enable row level security', v_table);
    execute format('alter table public.%I force row level security', v_table);

    execute format('drop policy if exists %I on public.%I', 'cmc_' || v_slug || '_read', v_table);
    execute format(
      'create policy %I on public.%I for select to authenticated using (public.cmc_is_active_user())',
      'cmc_' || v_slug || '_read', v_table
    );

    execute format('drop policy if exists %I on public.%I', 'cmc_' || v_slug || '_insert', v_table);
    execute format(
      'create policy %I on public.%I for insert to authenticated with check (public.cmc_has_any_role(array[''SUPERADMIN'', ''ADMIN'', ''OPERACIONES'']))',
      'cmc_' || v_slug || '_insert', v_table
    );

    execute format('drop policy if exists %I on public.%I', 'cmc_' || v_slug || '_update', v_table);
    execute format(
      'create policy %I on public.%I for update to authenticated using (public.cmc_has_any_role(array[''SUPERADMIN'', ''ADMIN'', ''OPERACIONES''])) with check (public.cmc_has_any_role(array[''SUPERADMIN'', ''ADMIN'', ''OPERACIONES'']))',
      'cmc_' || v_slug || '_update', v_table
    );

    execute format('revoke all on table public.%I from public, anon, authenticated', v_table);
    execute format('grant select, insert, update on table public.%I to authenticated', v_table);
  end loop;
end;
$migration$;

-- Minimizacion de datos de terreno: TECNICO solo ve los clientes/equipos de
-- sus actividades y visitas asignadas, y solo su propia ficha de tecnico.
drop policy if exists cmc_cliente_read on public."Cliente";
create policy cmc_cliente_read
on public."Cliente" for select to authenticated
using (public.cmc_can_access_client("id"));

drop policy if exists cmc_clientecontacto_read on public."ClienteContacto";
create policy cmc_clientecontacto_read
on public."ClienteContacto" for select to authenticated
using (public.cmc_can_access_client("clienteId"));

drop policy if exists cmc_clientedireccion_read on public."ClienteDireccion";
create policy cmc_clientedireccion_read
on public."ClienteDireccion" for select to authenticated
using (public.cmc_can_access_client("clienteId"));

drop policy if exists cmc_equipo_read on public."Equipo";
create policy cmc_equipo_read
on public."Equipo" for select to authenticated
using (public.cmc_can_access_equipment("id"));

drop policy if exists cmc_tecnico_read on public."Tecnico";
create policy cmc_tecnico_read
on public."Tecnico" for select to authenticated
using (
  public.cmc_has_any_role(array['SUPERADMIN', 'ADMIN', 'OPERACIONES', 'LECTURA'])
  or "id" = public.cmc_current_tecnico_id()
);

drop policy if exists cmc_vendedor_read on public."Vendedor";
create policy cmc_vendedor_read
on public."Vendedor" for select to authenticated
using (public.cmc_has_any_role(array['SUPERADMIN', 'ADMIN', 'OPERACIONES', 'LECTURA']));

-- Los tecnicos solo ven versiones publicadas; OPERACIONES+ tambien administra
-- borradores. Los items heredan la visibilidad de su matriz.
drop policy if exists cmc_matrizcumplimiento_read on public."MatrizCumplimiento";
create policy cmc_matrizcumplimiento_read
on public."MatrizCumplimiento"
for select to authenticated
using (public.cmc_can_access_matrix("id"));

drop policy if exists cmc_matrizitem_read on public."MatrizItem";
create policy cmc_matrizitem_read
on public."MatrizItem"
for select to authenticated
using (
  public.cmc_can_access_matrix("matrizId")
);

drop policy if exists cmc_matrizalcance_read on public."MatrizAlcance";
create policy cmc_matrizalcance_read
on public."MatrizAlcance"
for select to authenticated
using (
  public.cmc_has_any_role(array['SUPERADMIN', 'ADMIN', 'OPERACIONES'])
  or (
    public.cmc_current_role() = 'LECTURA'
    and public.cmc_can_access_matrix("matrizId")
  )
  or (
    public.cmc_current_role() = 'TECNICO'
    and public.cmc_can_access_matrix("matrizId")
    and (
      "alcanceTipo" = 'GLOBAL'
      or (
        "alcanceTipo" = 'TIPO_ACTIVIDAD'
        and exists (
          select 1
          from public."OrdenTrabajoActividad" assigned_activity
          where assigned_activity."tecnicoId" = public.cmc_current_tecnico_id()
            and assigned_activity."actividadId" = "MatrizAlcance"."actividadId"
        )
      )
      or ("alcanceTipo" = 'CLIENTE' and public.cmc_can_access_client("clienteId"))
      or ("alcanceTipo" = 'EQUIPO' and public.cmc_can_access_equipment("equipoId"))
    )
  )
);

drop policy if exists cmc_actividadmatrizdefault_read on public."ActividadMatrizDefault";
create policy cmc_actividadmatrizdefault_read
on public."ActividadMatrizDefault"
for select to authenticated
using (public.cmc_can_access_matrix("matrizId"));

-- ---------------------------------------------------------
-- OT y relaciones
-- ---------------------------------------------------------
create or replace function public.cmc_assign_default_matrices()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
begin
  insert into public."ActividadMatrizAsignada" (
    "ordenTrabajoActividadId", "matrizId", "origen", "obligatoria", "estado"
  )
  select
    new."id",
    scope."matrizId",
    'default',
    bool_or(scope."obligatoria"),
    'pendiente'
  from public."MatrizAlcance" scope
  join public."MatrizCumplimiento" matrix on matrix."id" = scope."matrizId"
  join public."OrdenTrabajo" ot on ot."id" = new."ordenTrabajoId"
  where scope."active"
    and matrix."activa"
    and matrix."estadoVersion" = 'PUBLICADA'
    and (
      scope."alcanceTipo" = 'GLOBAL'
      or (scope."alcanceTipo" = 'CLIENTE' and scope."clienteId" = ot."clienteId")
      or (
        scope."alcanceTipo" = 'EQUIPO'
        and (
          scope."equipoId" = ot."equipoId"
          or exists (
            select 1
            from public."OrdenTrabajoEquipo" ote
            where ote."ordenTrabajoId" = ot."id"
              and ote."equipoId" = scope."equipoId"
          )
        )
      )
      or (
        scope."alcanceTipo" = 'TIPO_ACTIVIDAD'
        and scope."actividadId" = new."actividadId"
      )
    )
  group by scope."matrizId"
  on conflict ("ordenTrabajoActividadId", "matrizId") do nothing;

  return new;
end;
$function$;

drop trigger if exists trg_cmc_assign_default_matrices on public."OrdenTrabajoActividad";
create trigger trg_cmc_assign_default_matrices
after insert on public."OrdenTrabajoActividad"
for each row execute function public.cmc_assign_default_matrices();

-- Aplica defaults a actividades productivas abiertas creadas antes de instalar
-- el trigger. Se excluye el backfill legacy para no reinterpretar historia.
select set_config('cmcing.audit_source', 'migration:matrix-defaults', true);

insert into public."ActividadMatrizAsignada" (
  "ordenTrabajoActividadId", "matrizId", "origen", "obligatoria", "estado"
)
select
  activity."id",
  scope."matrizId",
  'default',
  bool_or(scope."obligatoria"),
  'pendiente'
from public."OrdenTrabajoActividad" activity
join public."OrdenTrabajo" ot on ot."id" = activity."ordenTrabajoId"
join public."MatrizAlcance" scope on scope."active"
join public."MatrizCumplimiento" matrix on matrix."id" = scope."matrizId"
where not activity."bloqueada"
  and activity."legacyVisitaId" is null
  and activity."legacyVisitaActividadId" is null
  and matrix."activa"
  and matrix."estadoVersion" = 'PUBLICADA'
  and (
    scope."alcanceTipo" = 'GLOBAL'
    or (scope."alcanceTipo" = 'CLIENTE' and scope."clienteId" = ot."clienteId")
    or (
      scope."alcanceTipo" = 'EQUIPO'
      and (
        scope."equipoId" = ot."equipoId"
        or exists (
          select 1 from public."OrdenTrabajoEquipo" ote
          where ote."ordenTrabajoId" = ot."id"
            and ote."equipoId" = scope."equipoId"
        )
      )
    )
    or (scope."alcanceTipo" = 'TIPO_ACTIVIDAD' and scope."actividadId" = activity."actividadId")
  )
group by activity."id", scope."matrizId"
on conflict ("ordenTrabajoActividadId", "matrizId") do nothing;

select set_config('cmcing.audit_source', '', true);

alter table public."OrdenTrabajo" enable row level security;
alter table public."OrdenTrabajo" force row level security;
drop policy if exists cmc_ordentrabajo_read on public."OrdenTrabajo";
create policy cmc_ordentrabajo_read
on public."OrdenTrabajo" for select to authenticated
using (public.cmc_can_access_work_order("id"));
drop policy if exists cmc_ordentrabajo_insert on public."OrdenTrabajo";
create policy cmc_ordentrabajo_insert
on public."OrdenTrabajo" for insert to authenticated
with check (public.cmc_has_any_role(array['SUPERADMIN', 'ADMIN', 'OPERACIONES']));
drop policy if exists cmc_ordentrabajo_update on public."OrdenTrabajo";
create policy cmc_ordentrabajo_update
on public."OrdenTrabajo" for update to authenticated
using (public.cmc_has_any_role(array['SUPERADMIN', 'ADMIN', 'OPERACIONES']))
with check (public.cmc_has_any_role(array['SUPERADMIN', 'ADMIN', 'OPERACIONES']));
revoke all on table public."OrdenTrabajo" from public, anon, authenticated;
grant select, insert, update on table public."OrdenTrabajo" to authenticated;

alter table public."OrdenTrabajoEquipo" enable row level security;
alter table public."OrdenTrabajoEquipo" force row level security;
drop policy if exists cmc_ordentrabajoequipo_read on public."OrdenTrabajoEquipo";
create policy cmc_ordentrabajoequipo_read
on public."OrdenTrabajoEquipo" for select to authenticated
using (public.cmc_can_access_work_order("ordenTrabajoId"));
drop policy if exists cmc_ordentrabajoequipo_insert on public."OrdenTrabajoEquipo";
create policy cmc_ordentrabajoequipo_insert
on public."OrdenTrabajoEquipo" for insert to authenticated
with check (public.cmc_has_any_role(array['SUPERADMIN', 'ADMIN', 'OPERACIONES']));
drop policy if exists cmc_ordentrabajoequipo_update on public."OrdenTrabajoEquipo";
create policy cmc_ordentrabajoequipo_update
on public."OrdenTrabajoEquipo" for update to authenticated
using (public.cmc_has_any_role(array['SUPERADMIN', 'ADMIN', 'OPERACIONES']))
with check (public.cmc_has_any_role(array['SUPERADMIN', 'ADMIN', 'OPERACIONES']));
revoke all on table public."OrdenTrabajoEquipo" from public, anon, authenticated;
grant select, insert, update on table public."OrdenTrabajoEquipo" to authenticated;

alter table public."OrdenTrabajoActividad" enable row level security;
alter table public."OrdenTrabajoActividad" force row level security;

drop policy if exists cmc_ot_activity_read on public."OrdenTrabajoActividad";
create policy cmc_ot_activity_read
on public."OrdenTrabajoActividad"
for select to authenticated
using (public.cmc_can_access_activity("id"));

drop policy if exists cmc_ot_activity_insert on public."OrdenTrabajoActividad";
create policy cmc_ot_activity_insert
on public."OrdenTrabajoActividad"
for insert to authenticated
with check (public.cmc_has_any_role(array['SUPERADMIN', 'ADMIN', 'OPERACIONES']));

drop policy if exists cmc_ot_activity_update on public."OrdenTrabajoActividad";
create policy cmc_ot_activity_update
on public."OrdenTrabajoActividad"
for update to authenticated
using (public.cmc_has_any_role(array['SUPERADMIN', 'ADMIN', 'OPERACIONES']))
with check (public.cmc_has_any_role(array['SUPERADMIN', 'ADMIN', 'OPERACIONES']));

revoke all on table public."OrdenTrabajoActividad" from public, anon, authenticated;
grant select, insert, update on table public."OrdenTrabajoActividad" to authenticated;

alter table public."ActividadAuditoria" enable row level security;
alter table public."ActividadAuditoria" force row level security;
drop policy if exists cmc_activity_audit_read on public."ActividadAuditoria";
create policy cmc_activity_audit_read
on public."ActividadAuditoria"
for select to authenticated
using (public.cmc_can_access_activity("ordenTrabajoActividadId"));
revoke all on table public."ActividadAuditoria" from public, anon, authenticated;
grant select on table public."ActividadAuditoria" to authenticated;

-- Hijos de actividad: lectura contextual; escritura directa solo de
-- asignaciones por OPERACIONES. Respuestas, adjuntos y documentos usan RPC/API.
alter table public."ActividadMatrizAsignada" enable row level security;
alter table public."ActividadMatrizAsignada" force row level security;
drop policy if exists cmc_assignment_read on public."ActividadMatrizAsignada";
create policy cmc_assignment_read
on public."ActividadMatrizAsignada"
for select to authenticated
using (public.cmc_can_access_activity("ordenTrabajoActividadId"));
drop policy if exists cmc_assignment_insert on public."ActividadMatrizAsignada";
create policy cmc_assignment_insert
on public."ActividadMatrizAsignada"
for insert to authenticated
with check (
  public.cmc_has_any_role(array['SUPERADMIN', 'ADMIN', 'OPERACIONES'])
  and public.cmc_can_access_activity("ordenTrabajoActividadId")
);
drop policy if exists cmc_assignment_update on public."ActividadMatrizAsignada";
create policy cmc_assignment_update
on public."ActividadMatrizAsignada"
for update to authenticated
using (
  public.cmc_has_any_role(array['SUPERADMIN', 'ADMIN', 'OPERACIONES'])
  and public.cmc_can_access_activity("ordenTrabajoActividadId")
)
with check (
  public.cmc_has_any_role(array['SUPERADMIN', 'ADMIN', 'OPERACIONES'])
  and public.cmc_can_access_activity("ordenTrabajoActividadId")
);
drop policy if exists cmc_assignment_delete on public."ActividadMatrizAsignada";
create policy cmc_assignment_delete
on public."ActividadMatrizAsignada"
for delete to authenticated
using (
  public.cmc_has_any_role(array['SUPERADMIN', 'ADMIN', 'OPERACIONES'])
  and public.cmc_can_access_activity("ordenTrabajoActividadId")
);
revoke all on table public."ActividadMatrizAsignada" from public, anon, authenticated;
grant select, insert, update, delete on table public."ActividadMatrizAsignada" to authenticated;

alter table public."ActividadMatrizRespuesta" enable row level security;
alter table public."ActividadMatrizRespuesta" force row level security;
drop policy if exists cmc_answer_read on public."ActividadMatrizRespuesta";
create policy cmc_answer_read
on public."ActividadMatrizRespuesta"
for select to authenticated
using (public.cmc_can_access_assignment("actividadMatrizAsignadaId"));
revoke all on table public."ActividadMatrizRespuesta" from public, anon, authenticated;
grant select on table public."ActividadMatrizRespuesta" to authenticated;

alter table public."ActividadDocumento" enable row level security;
alter table public."ActividadDocumento" force row level security;
drop policy if exists cmc_document_read on public."ActividadDocumento";
create policy cmc_document_read
on public."ActividadDocumento"
for select to authenticated
using (public.cmc_can_access_activity("ordenTrabajoActividadId"));
revoke all on table public."ActividadDocumento" from public, anon, authenticated;
grant select on table public."ActividadDocumento" to authenticated;

alter table public."ArchivoAdjunto" enable row level security;
alter table public."ArchivoAdjunto" force row level security;
drop policy if exists cmc_attachment_read on public."ArchivoAdjunto";
create policy cmc_attachment_read
on public."ArchivoAdjunto"
for select to authenticated
using (
  public.cmc_is_active_user()
  and (
    ("ordenTrabajoActividadId" is not null and public.cmc_can_access_activity("ordenTrabajoActividadId"))
    or ("ordenTrabajoActividadId" is null and "visitaId" is not null and public.cmc_can_access_visita("visitaId"))
    or (
      "ordenTrabajoActividadId" is null and "visitaId" is null and "visitaActividadId" is null
      and public.cmc_has_any_role(array['SUPERADMIN', 'ADMIN', 'OPERACIONES', 'LECTURA'])
    )
  )
);
revoke all on table public."ArchivoAdjunto" from public, anon, authenticated;
grant select on table public."ArchivoAdjunto" to authenticated;

-- ---------------------------------------------------------
-- Legacy Visita y hoja de vida
-- ---------------------------------------------------------
alter table public."Visita" enable row level security;
alter table public."Visita" force row level security;
drop policy if exists cmc_visita_read on public."Visita";
create policy cmc_visita_read
on public."Visita"
for select to authenticated
using (public.cmc_can_access_visita("id"));
drop policy if exists cmc_visita_insert on public."Visita";
create policy cmc_visita_insert
on public."Visita"
for insert to authenticated
with check (public.cmc_has_any_role(array['SUPERADMIN', 'ADMIN', 'OPERACIONES']));
drop policy if exists cmc_visita_update on public."Visita";
create policy cmc_visita_update
on public."Visita"
for update to authenticated
using (public.cmc_has_any_role(array['SUPERADMIN', 'ADMIN', 'OPERACIONES']))
with check (public.cmc_has_any_role(array['SUPERADMIN', 'ADMIN', 'OPERACIONES']));
revoke all on table public."Visita" from public, anon, authenticated;
grant select, insert, update on table public."Visita" to authenticated;

do $migration$
declare
  v_table text;
  v_fk text;
  v_slug text;
begin
  for v_table, v_fk in
    select x.table_name, x.fk_name
    from (values
      ('VisitaEquipo'::text, 'visitaId'::text),
      ('VisitaActividad'::text, 'visitaId'::text)
    ) as x(table_name, fk_name)
  loop
    v_slug := lower(v_table);
    execute format('alter table public.%I enable row level security', v_table);
    execute format('alter table public.%I force row level security', v_table);
    execute format('drop policy if exists %I on public.%I', 'cmc_' || v_slug || '_read', v_table);
    execute format(
      'create policy %I on public.%I for select to authenticated using (public.cmc_can_access_visita(%I))',
      'cmc_' || v_slug || '_read', v_table, v_fk
    );
    execute format('drop policy if exists %I on public.%I', 'cmc_' || v_slug || '_insert', v_table);
    execute format(
      'create policy %I on public.%I for insert to authenticated with check (public.cmc_has_any_role(array[''SUPERADMIN'', ''ADMIN'', ''OPERACIONES'']) and public.cmc_can_access_visita(%I))',
      'cmc_' || v_slug || '_insert', v_table, v_fk
    );
    execute format('drop policy if exists %I on public.%I', 'cmc_' || v_slug || '_update', v_table);
    execute format(
      'create policy %I on public.%I for update to authenticated using (public.cmc_has_any_role(array[''SUPERADMIN'', ''ADMIN'', ''OPERACIONES'']) and public.cmc_can_access_visita(%I)) with check (public.cmc_has_any_role(array[''SUPERADMIN'', ''ADMIN'', ''OPERACIONES'']) and public.cmc_can_access_visita(%I))',
      'cmc_' || v_slug || '_update', v_table, v_fk, v_fk
    );
    execute format('revoke all on table public.%I from public, anon, authenticated', v_table);
    execute format('grant select, insert, update on table public.%I to authenticated', v_table);
  end loop;
end;
$migration$;

alter table public."EquipoHojaVida" enable row level security;
alter table public."EquipoHojaVida" force row level security;
drop policy if exists cmc_equipment_life_read on public."EquipoHojaVida";
create policy cmc_equipment_life_read
on public."EquipoHojaVida" for select to authenticated
using (public.cmc_can_access_equipment("equipoId"));
drop policy if exists cmc_equipment_life_insert on public."EquipoHojaVida";
create policy cmc_equipment_life_insert
on public."EquipoHojaVida" for insert to authenticated
with check (public.cmc_has_any_role(array['SUPERADMIN', 'ADMIN', 'OPERACIONES']));
drop policy if exists cmc_equipment_life_update on public."EquipoHojaVida";
create policy cmc_equipment_life_update
on public."EquipoHojaVida" for update to authenticated
using (public.cmc_has_any_role(array['SUPERADMIN', 'ADMIN', 'OPERACIONES']))
with check (public.cmc_has_any_role(array['SUPERADMIN', 'ADMIN', 'OPERACIONES']));
revoke all on table public."EquipoHojaVida" from public, anon, authenticated;
grant select, insert, update on table public."EquipoHojaVida" to authenticated;

-- ---------------------------------------------------------
-- Comercial: TECNICO queda fuera de cotizaciones
-- ---------------------------------------------------------
do $migration$
declare
  v_table text;
  v_slug text;
begin
  foreach v_table in array array['Cotizacion', 'CotizacionItem']
  loop
    v_slug := lower(v_table);
    execute format('alter table public.%I enable row level security', v_table);
    execute format('alter table public.%I force row level security', v_table);
    execute format('drop policy if exists %I on public.%I', 'cmc_' || v_slug || '_read', v_table);
    execute format(
      'create policy %I on public.%I for select to authenticated using (public.cmc_has_any_role(array[''SUPERADMIN'', ''ADMIN'', ''OPERACIONES'', ''LECTURA'']))',
      'cmc_' || v_slug || '_read', v_table
    );
    execute format('drop policy if exists %I on public.%I', 'cmc_' || v_slug || '_insert', v_table);
    execute format(
      'create policy %I on public.%I for insert to authenticated with check (public.cmc_has_any_role(array[''SUPERADMIN'', ''ADMIN'', ''OPERACIONES'']))',
      'cmc_' || v_slug || '_insert', v_table
    );
    execute format('drop policy if exists %I on public.%I', 'cmc_' || v_slug || '_update', v_table);
    execute format(
      'create policy %I on public.%I for update to authenticated using (public.cmc_has_any_role(array[''SUPERADMIN'', ''ADMIN'', ''OPERACIONES''])) with check (public.cmc_has_any_role(array[''SUPERADMIN'', ''ADMIN'', ''OPERACIONES'']))',
      'cmc_' || v_slug || '_update', v_table
    );
    execute format('revoke all on table public.%I from public, anon, authenticated', v_table);
    execute format('grant select, insert, update on table public.%I to authenticated', v_table);
  end loop;
end;
$migration$;

-- ---------------------------------------------------------
-- Sync: cada usuario ve sus receipts; conflictos por acceso a actividad.
-- Outbox y mapping de migracion son operacionales.
-- ---------------------------------------------------------
alter table public."SyncMutationReceipt" enable row level security;
alter table public."SyncMutationReceipt" force row level security;
drop policy if exists cmc_receipt_read on public."SyncMutationReceipt";
create policy cmc_receipt_read
on public."SyncMutationReceipt" for select to authenticated
using (
  "actorAuthUserId" = auth.uid()
  or public.cmc_has_any_role(array['SUPERADMIN', 'ADMIN'])
);
revoke all on table public."SyncMutationReceipt" from public, anon, authenticated;
grant select on table public."SyncMutationReceipt" to authenticated;

alter table public."SyncConflict" enable row level security;
alter table public."SyncConflict" force row level security;
drop policy if exists cmc_conflict_read on public."SyncConflict";
create policy cmc_conflict_read
on public."SyncConflict" for select to authenticated
using (public.cmc_can_access_activity("ordenTrabajoActividadId"));
drop policy if exists cmc_conflict_admin_update on public."SyncConflict";
create policy cmc_conflict_admin_update
on public."SyncConflict" for update to authenticated
using (public.cmc_has_any_role(array['SUPERADMIN', 'ADMIN']))
with check (public.cmc_has_any_role(array['SUPERADMIN', 'ADMIN']));
revoke all on table public."SyncConflict" from public, anon, authenticated;
grant select, update on table public."SyncConflict" to authenticated;

alter table public."SyncOutbox" enable row level security;
alter table public."SyncOutbox" force row level security;
drop policy if exists cmc_outbox_ops_read on public."SyncOutbox";
create policy cmc_outbox_ops_read
on public."SyncOutbox" for select to authenticated
using (public.cmc_has_any_role(array['SUPERADMIN', 'ADMIN', 'OPERACIONES']));
revoke all on table public."SyncOutbox" from public, anon, authenticated;
grant select on table public."SyncOutbox" to authenticated;

alter table public."ColaSincronizacion" enable row level security;
alter table public."ColaSincronizacion" force row level security;
drop policy if exists cmc_legacy_sync_read on public."ColaSincronizacion";
create policy cmc_legacy_sync_read
on public."ColaSincronizacion" for select to authenticated
using (
  "usuarioId" = public.cmc_current_usuario_id()
  or "tecnicoId" = public.cmc_current_tecnico_id()
  or public.cmc_has_any_role(array['SUPERADMIN', 'ADMIN', 'OPERACIONES'])
);
revoke all on table public."ColaSincronizacion" from public, anon, authenticated;
grant select on table public."ColaSincronizacion" to authenticated;

alter table public."MigracionLegacyVisitaOT" enable row level security;
alter table public."MigracionLegacyVisitaOT" force row level security;
drop policy if exists cmc_legacy_mapping_read on public."MigracionLegacyVisitaOT";
create policy cmc_legacy_mapping_read
on public."MigracionLegacyVisitaOT" for select to authenticated
using (public.cmc_has_any_role(array['SUPERADMIN', 'ADMIN', 'OPERACIONES', 'LECTURA']));
revoke all on table public."MigracionLegacyVisitaOT" from public, anon, authenticated;
grant select on table public."MigracionLegacyVisitaOT" to authenticated;

-- ---------------------------------------------------------
-- Las tres vistas que Supabase Advisor marcaba como SECURITY DEFINER pasan a
-- ejecutar con el invocador, por lo que respetan grants y RLS de las tablas.
-- ---------------------------------------------------------
create or replace view public."vw_CalendarioVisitas"
with (security_invoker = true)
as
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
from public."Visita" v
join public."Cliente" c on c."id" = v."clienteId"
left join public."Tecnico" t on t."id" = v."tecnicoId"
left join public."Servicio" s on s."id" = v."servicioId"
left join public."VisitaEquipo" ve on ve."visitaId" = v."id"
left join public."Equipo" e on e."id" = ve."equipoId"
left join public."Equipo" e_legacy on e_legacy."id" = v."equipoId"
group by
  v."id", v."codigo", v."fechaProgramada", v."fechaFinProgramada", v."estado", v."prioridad",
  c."id", c."nombre", t."nombre", s."descripcion", e_legacy."nombre";

create or replace view public."vw_HojaVidaEquipo"
with (security_invoker = true)
as
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
from public."Equipo" e
join public."Cliente" c on c."id" = e."clienteId"
left join public."EquipoHojaVida" hv on hv."equipoId" = e."id";

create or replace view public."vw_CotizacionesResumen"
with (security_invoker = true)
as
select
  co."id",
  co."numero",
  co."fecha",
  co."estado",
  co."total",
  co."moneda",
  cl."nombre" as "cliente",
  ve."nombre" as "vendedor"
from public."Cotizacion" co
join public."Cliente" cl on cl."id" = co."clienteId"
left join public."Vendedor" ve on ve."id" = co."vendedorId";

revoke all on table public."vw_CalendarioVisitas", public."vw_HojaVidaEquipo",
  public."vw_CotizacionesResumen" from public, anon;
grant select on table public."vw_CalendarioVisitas", public."vw_HojaVidaEquipo",
  public."vw_CotizacionesResumen" to authenticated;

-- Grants de secuencia para inserts permitidos por RLS. No se concede SELECT,
-- por lo que no se expone currval de otras sesiones.
grant usage on all sequences in schema public to authenticated;
revoke usage on sequence public."AuthEmailDelivery_id_seq" from authenticated;
revoke usage on sequence public."ActividadAuditoria_id_seq" from authenticated;
revoke usage on sequence public."SyncMutationReceipt_id_seq" from authenticated;
revoke usage on sequence public."SyncConflict_id_seq" from authenticated;
revoke usage on sequence public."SyncOutbox_id_seq" from authenticated;
revoke usage on sequence public."ActividadDocumento_id_seq" from authenticated;
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;

-- Barrido final: ninguna funcion SECURITY DEFINER queda expuesta a PUBLIC o
-- anon por privilegios por defecto.
alter default privileges in schema public
  revoke execute on functions from public, anon, authenticated, service_role;

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
    execute format('revoke execute on function %s from authenticated', v_function);
    execute format('revoke execute on function %s from service_role', v_function);
    execute format('revoke execute on function %s from supabase_auth_admin', v_function);
  end loop;
end;
$migration$;

-- Helpers de RLS y RPC aprobados para authenticated.
grant execute on function public.cmc_current_usuario_id() to authenticated;
grant execute on function public.cmc_current_tecnico_id() to authenticated;
grant execute on function public.cmc_current_role() to authenticated;
grant execute on function public.cmc_is_active_user() to authenticated;
grant execute on function public.cmc_has_any_role(text[]) to authenticated;
grant execute on function public.cmc_can_access_activity(integer) to authenticated;
grant execute on function public.cmc_can_access_assignment(integer) to authenticated;
grant execute on function public.cmc_can_access_visita(integer) to authenticated;
grant execute on function public.cmc_can_access_work_order(integer) to authenticated;
grant execute on function public.cmc_can_access_client(integer) to authenticated;
grant execute on function public.cmc_can_access_equipment(integer) to authenticated;
grant execute on function public.cmc_can_access_matrix(integer) to authenticated;
grant execute on function public.cmc_actualizar_notas_actividad(integer, text, text, bigint) to authenticated;
grant execute on function public.cmc_guardar_respuestas_matriz(integer, integer, jsonb, text, bigint) to authenticated;
grant execute on function public.cmc_cerrar_actividad(integer, text, bigint) to authenticated;
grant execute on function public.cmc_desbloquear_actividad(integer, text, text, bigint) to authenticated;
grant execute on function public.cmc_publicar_matriz(integer, bigint) to authenticated;

-- Hooks/RPC de infraestructura conservan roles especializados.
grant execute on function public.cmc_before_user_created_hook(jsonb) to supabase_auth_admin;
grant execute on function public.cmc_sync_auth_user_profile() to supabase_auth_admin;
grant execute on function public.claim_auth_email_delivery(text, text, text) to service_role;
grant execute on function public.complete_auth_email_delivery(text, uuid, text, text) to service_role;

commit;
