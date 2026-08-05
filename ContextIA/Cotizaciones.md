# Cotizaciones comerciales

Última actualización: 2026-08-05.

## Flujo de interfaz

`/cotizaciones` mantiene el listado como entrada y usa lightboxes para el trabajo comercial:

1. **Crear nueva cotización** abre el editor sin abandonar el listado.
2. **Abrir** permite editar una cotización existente en ese mismo editor.
3. Al guardar, el editor se cierra y aparece el resultado con acciones para reabrir, exportar PDF, imprimir, enviar por correo y previsualizar el PDF.
4. La salida del editor con cambios pendientes solicita confirmación.

Todos los listados de entidades usan `ComboBox`. Los títulos de campos sólo muestran asterisco rojo cuando son obligatorios: la ausencia de asterisco significa que el dato es opcional.

## Jerarquía comercial

La estructura vigente es:

```text
Ítem de equipo
└── Servicios (uno o varios)
```

- El ítem es un `Equipo` existente, seleccionado sin editar sus datos desde la cotización.
- Un mismo buscador encuentra el equipo por nombre, `partNumber`, `ean`, `serial` o código interno, y despliega coincidencias mientras se escribe.
- Cada servicio es obligatorio y viene del Catálogo de Servicios. El catálogo continúa siendo el único lugar donde se modifica su definición.
- Cada servicio puede incluir una descripción detallada adicional, además de cantidad, precio unitario y descuento por porcentaje o monto fijo.
- El encabezado admite descuento general por porcentaje o monto fijo.
- Al crear una cotización, `validaHasta` se propone a siete días calendario desde la fecha local de creación.

## Persistencia y documento

La migración `20260805090000_cotizacion_items_servicios.sql` introduce `CotizacionItemServicio` como hijo de `CotizacionItem`.

- `CotizacionItem` conserva el snapshot del equipo (nombre, código y descripción) y su total agregado.
- `CotizacionItemServicio` conserva el servicio del catálogo, el nombre cotizado, detalle adicional, precios, descuentos, orden y total de línea.
- Triggers recalculan el total del ítem desde los servicios y luego el total de la cotización; se preservan las líneas históricas que ya tenían un servicio asociado.
- El PDF y el correo muestran el equipo/ítem seguido de cada servicio y su detalle adicional.

La tabla nueva sigue RLS del módulo comercial: lectura para `SUPERADMIN`, `ADMIN`, `OPERACIONES` y `LECTURA`; escritura para los tres primeros roles operativos. El backend además valida que cada ítem y servicio exista antes de persistirlo.

## Validación realizada

- La migración se aplicó en producción al proyecto Supabase `vgfoubwwxqkrtpymzbat` desde una consulta nueva.
- Consulta de lectura posterior: `CotizacionItemServicio` creada, con 14 columnas, 3 políticas RLS y 3 triggers activos.
- `eslint` focalizado, `tsc --noEmit`, `prisma validate` y `next build`: correctos.
- Vercel producción: despliegue `dpl_CeH8ZfuymQMogn8ieTHETzKVN5Qw`, publicado en `https://cm-cing.vercel.app`; `/api/health?deep=1` confirmó `database: ok`.

La prueba E2E que cree o envíe una cotización comercial real sólo se realiza con una operación autorizada explícitamente.
