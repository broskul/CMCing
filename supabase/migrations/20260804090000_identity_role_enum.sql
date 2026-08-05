-- =========================================================
-- CMCing CMMS produccion - identidad (paso 1/2)
--
-- PostgreSQL no permite usar un valor de enum nuevo dentro de la misma
-- transaccion en que se agrega. Por eso SUPERADMIN vive en una migracion
-- separada y debe ejecutarse antes de 20260804091000.
-- =========================================================

begin;

alter type public."RolUsuario"
  add value if not exists 'SUPERADMIN' before 'ADMIN';

commit;
