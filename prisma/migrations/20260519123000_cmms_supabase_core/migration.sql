-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- Required for UUID primary keys on Supabase/Postgres.
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Retire the first demo schema if this migration is applied after the initial prototype.
DROP TABLE IF EXISTS "Visita" CASCADE;
DROP TABLE IF EXISTS "Equipo" CASCADE;
DROP TABLE IF EXISTS "Cliente" CASCADE;
DROP TABLE IF EXISTS "Servicio" CASCADE;
DROP TABLE IF EXISTS "Vendedor" CASCADE;
DROP TABLE IF EXISTS "Tecnico" CASCADE;

-- CreateEnum
CREATE TYPE "ClienteEstado" AS ENUM ('prospecto', 'activo', 'suspendido', 'inactivo');

-- CreateEnum
CREATE TYPE "ContactoRol" AS ENUM ('principal', 'compras', 'tecnico', 'facturacion', 'administracion', 'otro');

-- CreateEnum
CREATE TYPE "DireccionTipo" AS ENUM ('matriz', 'facturacion', 'despacho', 'servicio', 'otro');

-- CreateEnum
CREATE TYPE "EmpleadoRol" AS ENUM ('comercial', 'jefatura', 'tecnico', 'administrativo');

-- CreateEnum
CREATE TYPE "EmpleadoEstado" AS ENUM ('activo', 'inactivo');

-- CreateEnum
CREATE TYPE "EquipoEstado" AS ENUM ('operativo', 'observado', 'fuera_servicio', 'retirado');

-- CreateEnum
CREATE TYPE "MantencionTipo" AS ENUM ('preventiva', 'correctiva', 'calibracion', 'instalacion', 'spot', 'incidente');

-- CreateEnum
CREATE TYPE "MantencionOrigen" AS ENUM ('programada', 'solicitada', 'spot', 'incidente');

-- CreateEnum
CREATE TYPE "CoberturaServicio" AS ENUM ('garantia', 'contrato', 'cobrable', 'interno', 'sin_cobro');

-- CreateEnum
CREATE TYPE "Prioridad" AS ENUM ('baja', 'media', 'alta', 'critica');

-- CreateEnum
CREATE TYPE "MantencionEstado" AS ENUM ('borrador', 'programada', 'asignada', 'en_progreso', 'completada', 'cancelada');

-- CreateEnum
CREATE TYPE "VisitaEstado" AS ENUM ('pendiente', 'programada', 'en_progreso', 'completada', 'cancelada');

-- CreateEnum
CREATE TYPE "IncidenteEstado" AS ENUM ('abierto', 'en_revision', 'resuelto', 'cerrado', 'cancelado');

-- CreateEnum
CREATE TYPE "ImagenVisitaTipo" AS ENUM ('antes', 'durante', 'despues', 'evidencia', 'firma', 'placa', 'otro');

-- CreateTable
CREATE TABLE "clientes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "codigo" TEXT,
    "nombre" TEXT NOT NULL,
    "razon_social" TEXT,
    "rut" TEXT,
    "giro" TEXT,
    "email" TEXT,
    "telefono" TEXT,
    "sitio_web" TEXT,
    "estado" "ClienteEstado" NOT NULL DEFAULT 'activo',
    "notas" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "clientes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cliente_contactos" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "cliente_id" UUID NOT NULL,
    "nombre" TEXT NOT NULL,
    "cargo" TEXT,
    "rol" "ContactoRol" NOT NULL DEFAULT 'principal',
    "email" TEXT,
    "telefono" TEXT,
    "movil" TEXT,
    "principal" BOOLEAN NOT NULL DEFAULT false,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "notas" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "cliente_contactos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cliente_direcciones" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "cliente_id" UUID NOT NULL,
    "tipo" "DireccionTipo" NOT NULL DEFAULT 'servicio',
    "nombre" TEXT,
    "direccion" TEXT NOT NULL,
    "comuna" TEXT,
    "ciudad" TEXT,
    "region" TEXT,
    "pais" TEXT NOT NULL DEFAULT 'Chile',
    "codigo_postal" TEXT,
    "principal" BOOLEAN NOT NULL DEFAULT false,
    "latitud" DOUBLE PRECISION,
    "longitud" DOUBLE PRECISION,
    "notas" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "cliente_direcciones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "equipo_modelos" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "nombre" TEXT NOT NULL,
    "marca" TEXT,
    "modelo" TEXT,
    "categoria" TEXT,
    "fabricante" TEXT,
    "descripcion" TEXT,
    "imagen_url" TEXT,
    "manual_url" TEXT,
    "mantenimiento_cada_dias" INTEGER,
    "garantia_meses" INTEGER,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "equipo_modelos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "equipos" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "cliente_id" UUID NOT NULL,
    "modelo_id" UUID,
    "nombre" TEXT NOT NULL,
    "marca" TEXT,
    "modelo" TEXT,
    "nro_serie" TEXT NOT NULL,
    "codigo_interno" TEXT,
    "ubicacion" TEXT,
    "fecha_instalacion" TIMESTAMPTZ(6),
    "garantia_hasta" TIMESTAMPTZ(6),
    "estado" "EquipoEstado" NOT NULL DEFAULT 'operativo',
    "criticidad" "Prioridad" NOT NULL DEFAULT 'media',
    "imagen_url" TEXT,
    "notas" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "equipos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "equipo_asignaciones" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "equipo_id" UUID NOT NULL,
    "cliente_id" UUID NOT NULL,
    "direccion_id" UUID,
    "fecha_inicio" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_fin" TIMESTAMPTZ(6),
    "motivo" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "equipo_asignaciones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "empleados" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "nombre" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "telefono" TEXT,
    "cargo" TEXT,
    "especialidad" TEXT,
    "roles" "EmpleadoRol"[] DEFAULT ARRAY[]::"EmpleadoRol"[],
    "estado" "EmpleadoEstado" NOT NULL DEFAULT 'activo',
    "supervisor_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "empleados_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "servicios" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "codigo" TEXT,
    "descripcion" TEXT NOT NULL,
    "tipo" "MantencionTipo" NOT NULL DEFAULT 'preventiva',
    "precio" DOUBLE PRECISION,
    "moneda" TEXT NOT NULL DEFAULT 'CLP',
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "servicios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plan_mantenciones" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "equipo_id" UUID NOT NULL,
    "nombre" TEXT NOT NULL,
    "frecuencia_dias" INTEGER NOT NULL,
    "ultima_fecha" TIMESTAMPTZ(6),
    "proxima_fecha" TIMESTAMPTZ(6),
    "cobertura" "CoberturaServicio" NOT NULL DEFAULT 'contrato',
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "notas" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "plan_mantenciones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mantenciones" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "folio" TEXT,
    "cliente_id" UUID NOT NULL,
    "plan_id" UUID,
    "incidente_id" UUID,
    "servicio_id" UUID,
    "comercial_id" UUID,
    "jefatura_id" UUID,
    "tipo" "MantencionTipo" NOT NULL DEFAULT 'preventiva',
    "origen" "MantencionOrigen" NOT NULL DEFAULT 'programada',
    "cobertura" "CoberturaServicio" NOT NULL DEFAULT 'cobrable',
    "estado" "MantencionEstado" NOT NULL DEFAULT 'programada',
    "prioridad" "Prioridad" NOT NULL DEFAULT 'media',
    "titulo" TEXT NOT NULL,
    "descripcion" TEXT,
    "diagnostico" TEXT,
    "resolucion" TEXT,
    "fecha_programada" TIMESTAMPTZ(6),
    "fecha_compromiso" TIMESTAMPTZ(6),
    "fecha_cierre" TIMESTAMPTZ(6),
    "monto_estimado" DOUBLE PRECISION,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "mantenciones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mantencion_equipos" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "mantencion_id" UUID NOT NULL,
    "equipo_id" UUID NOT NULL,
    "principal" BOOLEAN NOT NULL DEFAULT false,
    "alcance" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mantencion_equipos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "incidentes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "cliente_id" UUID NOT NULL,
    "equipo_id" UUID,
    "contacto_id" UUID,
    "asignado_a_id" UUID,
    "titulo" TEXT NOT NULL,
    "descripcion" TEXT,
    "severidad" "Prioridad" NOT NULL DEFAULT 'media',
    "estado" "IncidenteEstado" NOT NULL DEFAULT 'abierto',
    "fecha_reporte" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_cierre" TIMESTAMPTZ(6),
    "causa_raiz" TEXT,
    "solucion" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "incidentes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "visitas" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "cliente_id" UUID NOT NULL,
    "mantencion_id" UUID,
    "incidente_id" UUID,
    "servicio_id" UUID,
    "fecha" TIMESTAMPTZ(6) NOT NULL,
    "fecha_fin" TIMESTAMPTZ(6),
    "estado" "VisitaEstado" NOT NULL DEFAULT 'pendiente',
    "descripcion" TEXT,
    "resultado" TEXT,
    "recomendaciones" TEXT,
    "firma_cliente_nombre" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "visitas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "visita_empleados" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "visita_id" UUID NOT NULL,
    "empleado_id" UUID NOT NULL,
    "rol" "EmpleadoRol",
    "principal" BOOLEAN NOT NULL DEFAULT false,
    "horas" DOUBLE PRECISION,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "visita_empleados_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "visita_equipos" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "visita_id" UUID NOT NULL,
    "equipo_id" UUID NOT NULL,
    "principal" BOOLEAN NOT NULL DEFAULT false,
    "observacion" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "visita_equipos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "visita_imagenes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "visita_id" UUID NOT NULL,
    "equipo_id" UUID,
    "tipo" "ImagenVisitaTipo" NOT NULL DEFAULT 'evidencia',
    "bucket" TEXT NOT NULL,
    "object_key" TEXT NOT NULL,
    "url" TEXT,
    "mime_type" TEXT,
    "file_name" TEXT,
    "size_bytes" INTEGER,
    "caption" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "visita_imagenes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "clientes_codigo_key" ON "clientes"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "clientes_rut_key" ON "clientes"("rut");

-- CreateIndex
CREATE INDEX "clientes_nombre_idx" ON "clientes"("nombre");

-- CreateIndex
CREATE INDEX "cliente_contactos_cliente_id_idx" ON "cliente_contactos"("cliente_id");

-- CreateIndex
CREATE INDEX "cliente_contactos_email_idx" ON "cliente_contactos"("email");

-- CreateIndex
CREATE INDEX "cliente_direcciones_cliente_id_idx" ON "cliente_direcciones"("cliente_id");

-- CreateIndex
CREATE UNIQUE INDEX "equipo_modelos_marca_modelo_key" ON "equipo_modelos"("marca", "modelo");

-- CreateIndex
CREATE UNIQUE INDEX "equipos_nro_serie_key" ON "equipos"("nro_serie");

-- CreateIndex
CREATE UNIQUE INDEX "equipos_codigo_interno_key" ON "equipos"("codigo_interno");

-- CreateIndex
CREATE INDEX "equipos_cliente_id_idx" ON "equipos"("cliente_id");

-- CreateIndex
CREATE INDEX "equipos_estado_idx" ON "equipos"("estado");

-- CreateIndex
CREATE INDEX "equipo_asignaciones_equipo_id_fecha_fin_idx" ON "equipo_asignaciones"("equipo_id", "fecha_fin");

-- CreateIndex
CREATE INDEX "equipo_asignaciones_cliente_id_idx" ON "equipo_asignaciones"("cliente_id");

-- CreateIndex
CREATE UNIQUE INDEX "empleados_email_key" ON "empleados"("email");

-- CreateIndex
CREATE INDEX "empleados_estado_idx" ON "empleados"("estado");

-- CreateIndex
CREATE INDEX "empleados_supervisor_id_idx" ON "empleados"("supervisor_id");

-- CreateIndex
CREATE UNIQUE INDEX "servicios_codigo_key" ON "servicios"("codigo");

-- CreateIndex
CREATE INDEX "plan_mantenciones_equipo_id_idx" ON "plan_mantenciones"("equipo_id");

-- CreateIndex
CREATE INDEX "plan_mantenciones_proxima_fecha_idx" ON "plan_mantenciones"("proxima_fecha");

-- CreateIndex
CREATE UNIQUE INDEX "mantenciones_folio_key" ON "mantenciones"("folio");

-- CreateIndex
CREATE INDEX "mantenciones_cliente_id_idx" ON "mantenciones"("cliente_id");

-- CreateIndex
CREATE INDEX "mantenciones_estado_idx" ON "mantenciones"("estado");

-- CreateIndex
CREATE INDEX "mantenciones_fecha_programada_idx" ON "mantenciones"("fecha_programada");

-- CreateIndex
CREATE INDEX "mantencion_equipos_equipo_id_idx" ON "mantencion_equipos"("equipo_id");

-- CreateIndex
CREATE UNIQUE INDEX "mantencion_equipos_mantencion_id_equipo_id_key" ON "mantencion_equipos"("mantencion_id", "equipo_id");

-- CreateIndex
CREATE INDEX "incidentes_cliente_id_idx" ON "incidentes"("cliente_id");

-- CreateIndex
CREATE INDEX "incidentes_equipo_id_idx" ON "incidentes"("equipo_id");

-- CreateIndex
CREATE INDEX "incidentes_estado_idx" ON "incidentes"("estado");

-- CreateIndex
CREATE INDEX "visitas_cliente_id_idx" ON "visitas"("cliente_id");

-- CreateIndex
CREATE INDEX "visitas_mantencion_id_idx" ON "visitas"("mantencion_id");

-- CreateIndex
CREATE INDEX "visitas_fecha_idx" ON "visitas"("fecha");

-- CreateIndex
CREATE INDEX "visita_empleados_empleado_id_idx" ON "visita_empleados"("empleado_id");

-- CreateIndex
CREATE UNIQUE INDEX "visita_empleados_visita_id_empleado_id_key" ON "visita_empleados"("visita_id", "empleado_id");

-- CreateIndex
CREATE INDEX "visita_equipos_equipo_id_idx" ON "visita_equipos"("equipo_id");

-- CreateIndex
CREATE UNIQUE INDEX "visita_equipos_visita_id_equipo_id_key" ON "visita_equipos"("visita_id", "equipo_id");

-- CreateIndex
CREATE UNIQUE INDEX "visita_imagenes_object_key_key" ON "visita_imagenes"("object_key");

-- CreateIndex
CREATE INDEX "visita_imagenes_visita_id_idx" ON "visita_imagenes"("visita_id");

-- CreateIndex
CREATE INDEX "visita_imagenes_equipo_id_idx" ON "visita_imagenes"("equipo_id");

-- AddForeignKey
ALTER TABLE "cliente_contactos" ADD CONSTRAINT "cliente_contactos_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cliente_direcciones" ADD CONSTRAINT "cliente_direcciones_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equipos" ADD CONSTRAINT "equipos_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equipos" ADD CONSTRAINT "equipos_modelo_id_fkey" FOREIGN KEY ("modelo_id") REFERENCES "equipo_modelos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equipo_asignaciones" ADD CONSTRAINT "equipo_asignaciones_equipo_id_fkey" FOREIGN KEY ("equipo_id") REFERENCES "equipos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equipo_asignaciones" ADD CONSTRAINT "equipo_asignaciones_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equipo_asignaciones" ADD CONSTRAINT "equipo_asignaciones_direccion_id_fkey" FOREIGN KEY ("direccion_id") REFERENCES "cliente_direcciones"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "empleados" ADD CONSTRAINT "empleados_supervisor_id_fkey" FOREIGN KEY ("supervisor_id") REFERENCES "empleados"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plan_mantenciones" ADD CONSTRAINT "plan_mantenciones_equipo_id_fkey" FOREIGN KEY ("equipo_id") REFERENCES "equipos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mantenciones" ADD CONSTRAINT "mantenciones_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mantenciones" ADD CONSTRAINT "mantenciones_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "plan_mantenciones"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mantenciones" ADD CONSTRAINT "mantenciones_incidente_id_fkey" FOREIGN KEY ("incidente_id") REFERENCES "incidentes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mantenciones" ADD CONSTRAINT "mantenciones_servicio_id_fkey" FOREIGN KEY ("servicio_id") REFERENCES "servicios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mantenciones" ADD CONSTRAINT "mantenciones_comercial_id_fkey" FOREIGN KEY ("comercial_id") REFERENCES "empleados"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mantenciones" ADD CONSTRAINT "mantenciones_jefatura_id_fkey" FOREIGN KEY ("jefatura_id") REFERENCES "empleados"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mantencion_equipos" ADD CONSTRAINT "mantencion_equipos_mantencion_id_fkey" FOREIGN KEY ("mantencion_id") REFERENCES "mantenciones"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mantencion_equipos" ADD CONSTRAINT "mantencion_equipos_equipo_id_fkey" FOREIGN KEY ("equipo_id") REFERENCES "equipos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incidentes" ADD CONSTRAINT "incidentes_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incidentes" ADD CONSTRAINT "incidentes_equipo_id_fkey" FOREIGN KEY ("equipo_id") REFERENCES "equipos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incidentes" ADD CONSTRAINT "incidentes_contacto_id_fkey" FOREIGN KEY ("contacto_id") REFERENCES "cliente_contactos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incidentes" ADD CONSTRAINT "incidentes_asignado_a_id_fkey" FOREIGN KEY ("asignado_a_id") REFERENCES "empleados"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visitas" ADD CONSTRAINT "visitas_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visitas" ADD CONSTRAINT "visitas_mantencion_id_fkey" FOREIGN KEY ("mantencion_id") REFERENCES "mantenciones"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visitas" ADD CONSTRAINT "visitas_incidente_id_fkey" FOREIGN KEY ("incidente_id") REFERENCES "incidentes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visitas" ADD CONSTRAINT "visitas_servicio_id_fkey" FOREIGN KEY ("servicio_id") REFERENCES "servicios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visita_empleados" ADD CONSTRAINT "visita_empleados_visita_id_fkey" FOREIGN KEY ("visita_id") REFERENCES "visitas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visita_empleados" ADD CONSTRAINT "visita_empleados_empleado_id_fkey" FOREIGN KEY ("empleado_id") REFERENCES "empleados"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visita_equipos" ADD CONSTRAINT "visita_equipos_visita_id_fkey" FOREIGN KEY ("visita_id") REFERENCES "visitas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visita_equipos" ADD CONSTRAINT "visita_equipos_equipo_id_fkey" FOREIGN KEY ("equipo_id") REFERENCES "equipos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visita_imagenes" ADD CONSTRAINT "visita_imagenes_visita_id_fkey" FOREIGN KEY ("visita_id") REFERENCES "visitas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visita_imagenes" ADD CONSTRAINT "visita_imagenes_equipo_id_fkey" FOREIGN KEY ("equipo_id") REFERENCES "equipos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Supabase Data API grants. RLS still controls row visibility.
GRANT USAGE ON SCHEMA public TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
  public.clientes,
  public.cliente_contactos,
  public.cliente_direcciones,
  public.equipo_modelos,
  public.equipos,
  public.equipo_asignaciones,
  public.empleados,
  public.servicios,
  public.plan_mantenciones,
  public.mantenciones,
  public.mantencion_equipos,
  public.incidentes,
  public.visitas,
  public.visita_empleados,
  public.visita_equipos,
  public.visita_imagenes
TO authenticated, service_role;

ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cliente_contactos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cliente_direcciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.equipo_modelos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.equipos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.equipo_asignaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.empleados ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.servicios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plan_mantenciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mantenciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mantencion_equipos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.incidentes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.visitas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.visita_empleados ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.visita_equipos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.visita_imagenes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated_manage_clientes" ON public.clientes FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_manage_cliente_contactos" ON public.cliente_contactos FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_manage_cliente_direcciones" ON public.cliente_direcciones FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_manage_equipo_modelos" ON public.equipo_modelos FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_manage_equipos" ON public.equipos FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_manage_equipo_asignaciones" ON public.equipo_asignaciones FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_manage_empleados" ON public.empleados FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_manage_servicios" ON public.servicios FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_manage_plan_mantenciones" ON public.plan_mantenciones FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_manage_mantenciones" ON public.mantenciones FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_manage_mantencion_equipos" ON public.mantencion_equipos FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_manage_incidentes" ON public.incidentes FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_manage_visitas" ON public.visitas FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_manage_visita_empleados" ON public.visita_empleados FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_manage_visita_equipos" ON public.visita_equipos FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_manage_visita_imagenes" ON public.visita_imagenes FOR ALL TO authenticated USING (true) WITH CHECK (true);
