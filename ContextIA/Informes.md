# ContextIA - Informes

## Estado vigente

Ultima actualizacion: 2026-05-29.
Informes y cotizaciones generan PDF y correo HTML usando datos reales desde Supabase. El informe tecnico individual se acerco al formato historico CMCing usado en los PDFs de referencia.

## Objetivo del modulo

Emitir documentos comerciales y tecnicos con branding CMCing:

- informe de visitas,
- informe tecnico por visita,
- informe de facturacion,
- cotizacion.

## Fuentes de verdad y sistemas externos

- Datos runtime:
  - `app/lib/supabase-store.js`
- Generacion PDF server-side:
  - `pdf-lib` en `app/lib/reporting.js`
- Generacion PDF cliente:
  - `html2pdf.js` en `app/informes/visitas/page.js`
- Correo:
  - MS Graph en `app/api/informes/email/route.js`
  - MS Graph en `app/api/cotizaciones/[id]/email/route.js`
- Referencias visuales:
  - PDFs historicos entregados por usuario.

## Flujo funcional real

- `/informes/visitas` filtra visitas desde Supabase y genera:
  - PDF completo,
  - PDF tecnico por visita.
- `/informes/facturacion` exporta PDF y envia correo.
- `/cotizaciones` crea cotizacion, exporta PDF y envia correo.
- Informes tecnicos incluyen datos de equipo, objetivo, especificaciones, secciones numeradas, firma, selfie si existe y listado de evidencias.

## Decisiones tecnicas vigentes

- El informe tecnico HTML replica la estructura principal del PDF historico:
  - logo superior,
  - fecha/codigo a la derecha,
  - destinatario/ref,
  - titulo `INFORME TECNICO`,
  - datos del equipo,
  - objetivo/especificaciones,
  - secciones con encabezado gris,
  - footer CMCing.
- Firma del tecnico se compone de texto e imagen.
- Selfie capturada al firmar se adjunta al servicio y puede aparecer en informe mediante endpoint autenticado; no se usa URL publica para firma/selfie/evidencias.
- Las imagenes privadas de R2 se resuelven en UI por `/api/r2/private`, usando `r2Key` o URL interna `r2://...`.
- Los correos usan HTML con branding y PDF adjunto.

## Riesgos y bugs conocidos

- Si el usuario no tiene sesion valida, imagenes privadas de firma/selfie no renderizan en PDF HTML.
- `html2pdf.js` puede variar saltos de pagina segun navegador.
- PDFs historicos tienen detalles finos que aun no estan replicados al 100%.
- Si Supabase no tiene datos o migraciones, los informes se generan vacios o fallan por tabla faltante.
- QA 2026-05-29 genero PDFs de visitas/facturacion y envio ambos informes por MS Graph a `carlos@prof3sional.com`.
- QA 2026-05-29 con service role genero PDF de cotizacion `COT-2026-000003` y envio la cotizacion por MS Graph a `carlos@prof3sional.com`.
- QA 2026-05-29 offline/R2 genero PDF de cotizacion `COT-FIX-20260530000428` y PDF de informe de visitas para la visita `6`; la API de informes incluye 4 adjuntos de la visita sincronizada.
- Las rutas dinamicas `[id]` deben esperar `params` en Next 16; se corrigio para CRUD/PDF/email de recursos por id.

## Pendientes reales y proximos pasos

- Ajustar paginacion del informe tecnico para servicios largos.
- Incorporar plantillas por tipo de equipo/servicio.
- Guardar version emitida del informe y bitacora de envios.
