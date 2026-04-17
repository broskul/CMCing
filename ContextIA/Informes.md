# ContextIA - Informes

## Estado vigente

Ultima actualizacion: 2026-04-17.
El modulo de informes opera en modo demo sobre datos en memoria.

## Objetivo del modulo

Permitir generar y presentar informes operativos de visitas y facturacion, con exportacion CSV, exportacion PDF y envio por correo HTML con PDF adjunto.

## Fuentes de verdad y sistemas externos

- Fuente de datos principal: `app/lib/demo-store.js`.
- Generacion PDF: `pdf-lib` via `app/lib/reporting.js`.
- Correo: API interna `app/api/informes/email/route.js` (usa MS Graph).
- Assets visuales: logo y productos en `public/brand/` y `public/productos/`.

## Flujo funcional real

1. Usuario filtra desde UI:
- `app/informes/visitas/page.js`
- `app/informes/facturacion/page.js`

2. UI consume API de informe:
- `GET /api/informes/visitas`
- `GET /api/informes/facturacion`

3. Exportaciones:
- CSV se genera en cliente.
- PDF se genera en servidor:
  - `GET /api/informes/visitas/pdf`
  - `GET /api/informes/facturacion/pdf`

4. Envio email:
- UI llama `POST /api/informes/email`.
- Se construye HTML bonito con logo y tarjetas de productos.
- Se adjunta PDF del informe.

## Archivos clave

- `app/informes/visitas/page.js`
- `app/informes/facturacion/page.js`
- `app/api/informes/visitas/route.js`
- `app/api/informes/facturacion/route.js`
- `app/api/informes/visitas/pdf/route.js`
- `app/api/informes/facturacion/pdf/route.js`
- `app/api/informes/email/route.js`
- `app/lib/reporting.js`
- `app/lib/demo-store.js`

## Decisiones tecnicas vigentes

- Se usa `pdf-lib` para evitar dependencias pesadas y generar PDF server-side.
- Se incluye logo CMCing y fotos de productos en PDF y correo.
- El logo se renderiza con `object-fit: contain` para que se vea completo.
- En mail, imagenes inline se envian como `cid` attachments.

## Riesgos y bugs conocidos

- El layout del PDF prioriza estabilidad y legibilidad, no diseño editorial avanzado.
- Textos largos en tarjetas PDF se recortan para evitar desbordes.
- No hay versionado ni historial de informes enviados.

## Workarounds actuales

- Si hay error de envio, el endpoint devuelve detalle y la UI lo muestra.
- Si faltan filtros, el informe opera con rango abierto.

## Pendientes reales y proximos pasos

- Mejorar maquetacion PDF (saltos de pagina y tablas mas ricas).
- Agregar bitacora de correos enviados (id, fecha, destinatarios, estado).
- Definir templates separados para "interno" vs "cliente final" si cambia tono.
- Incorporar opcion de logos secundarios o firma comercial dinamica.

## Notas para presentacion y onboarding

- El flujo demo ya permite simular el caso real completo: filtrar -> exportar PDF -> enviar correo.
- Recalcar que los datos son de prueba y viven en memoria del proceso.
