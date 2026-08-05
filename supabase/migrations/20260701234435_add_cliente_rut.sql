alter table "Cliente"
add column if not exists "rut" text;

create unique index if not exists "Cliente_rut_key"
on "Cliente"("rut")
where "rut" is not null and btrim("rut") <> '';
