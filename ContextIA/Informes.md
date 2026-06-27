# ContextIA - Informes

## Estado vigente

Ultima actualizacion: 2026-06-06.
Informes y cotizaciones generan PDF y correo HTML usando datos reales desde Supabase. El informe tecnico individual replica la estructura visual historica CMCing y respeta el orden exigido para el tecnico y el PDF: datos del equipo, I. trabajos realizados y reportes, II. estado inicial, III. reportes de medicion, IV. consideraciones/certificados de instrumentos y V. codigos de trazabilidad. Los anexos fotograficos van despues de la firma, en pagina nueva.

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
- `/tecnico` captura la informacion del servicio en el mismo orden que debe salir en el informe tecnico.
- Informes tecnicos incluyen datos de equipo, objetivo, especificaciones, trabajos realizados, checklist, mediciones, certificados de instrumentos, codigo de instrumento, codigo de servicio, espacio de firma del tecnico al cierre y, si existen, anexos fotograficos en pagina posterior.

## Decisiones tecnicas vigentes

- El informe tecnico HTML replica la estructura principal del PDF historico:
  - logo superior,
  - fecha/codigo a la derecha,
  - destinatario/ref,
  - titulo `INFORME TECNICO`,
  - datos del equipo,
  - objetivo/especificaciones,
  - secciones con encabezado gris y titulos historicos (`I. TRABAJOS REALIZADOS Y REPORTES`, `II. ESTADO INICIAL`, `III. REPORTES DE MEDICION`, `IV. CONSIDERACIONES`),
  - footer CMCing.
- La paginacion vigente del informe tecnico deja datos del equipo, I y II en el primer bloque; luego fuerza una pagina de continuacion con header compacto (logo menor a la izquierda; fecha, titulo, cliente y codigo a la derecha) para III, IV, V y firma; los anexos fotograficos comienzan despues en otra pagina con el mismo header compacto.
- Las secciones `report-block`, header de continuacion, firma y anexos usan `break-inside: avoid`/`page-break-inside: avoid` para evitar cortes internos cuando html2pdf pagina el documento.
- La app tecnico usa cuadros combinados buscables para tecnico, cliente, servicio, equipos, checklist, variable y unidad. Equipos y checklist se agregan a listas compactas bajo el control.
- Objetivo y especificaciones son texto libre editable desde la app tecnico y viajan al informe tecnico.
- La captura de mediciones usa un unico formulario de medicion en edicion y una tabla/lista inferior para las mediciones agregadas. Al agregar una medicion, el formulario se reinicia completo para ingresar la siguiente desde cero.
- La medicion version 2 soporta criterios distintos segun los informes historicos:
  - tolerancia `±` con cajas `-` y `+`,
  - rango `min/max`,
  - limite `maximo`,
  - limite `minimo`,
  - unidad de criterio igual a la unidad de medicion o `%`.
- La diferencia se calcula automaticamente desde programado/observado, o en `%` usando `Base %` si se necesita una referencia distinta del programado.
- La captura tecnica guarda `descripcion` como texto legible de trabajos realizados y `notasTecnicas` como JSON versionado `cmcing_technical_report` version 2 con objetivo, especificaciones, checklist, mediciones configuradas, certificados y codigos. Las visitas antiguas siguen usando fallback desde `descripcion`/`notasTecnicas`.
- El codigo del servicio capturado por el tecnico tambien se guarda en `Visita.codigo` cuando viene informado.
- El encabezado del informe tecnico muestra ciudad/fecha, codigo de servicio y cliente; si el cliente tiene direccion se imprime bajo `Sres.` como en los informes historicos.
- `shortCliente` y `shortEquipo` exponen `direccion` y `codigoInterno` para que el informe pueda imprimir direccion del cliente y `Nº IDENTIFICACION`.
- Firma del tecnico no se inventa: si existe imagen real de firma se imprime; si no existe, se reserva espacio en blanco para firmar y se imprime el nombre/responsable disponible como texto bajo la linea.
- La firma del tecnico cierra el cuerpo del informe antes de cualquier anexo. Los anexos fotograficos empiezan con `ANEXO FOTOGRAFICO` en pagina nueva y cada imagen conserva titulo y descripcion breve desde `ArchivoAdjunto.metadata`.
- La app tecnico permite agregar imagenes adjuntas con titulo y descripcion breve; se guardan como adjuntos `imagen_adjunta` y la metadata viaja a `ArchivoAdjunto.metadata`.
- Selfie capturada al firmar se adjunta al servicio para validacion, pero no se mezcla con el bloque de firma del informe historico. No se usa URL publica para firma/selfie/evidencias.
- Las imagenes privadas de R2 se resuelven en UI por `/api/r2/private`, usando `r2Key` o URL interna `r2://...`.
- Los correos usan HTML con branding y PDF adjunto.

## Riesgos y bugs conocidos

- Si el usuario no tiene sesion valida, imagenes privadas de firma/selfie no renderizan en PDF HTML.
- `html2pdf.js` puede variar saltos de pagina segun navegador.
- PDFs historicos tienen detalles finos que aun no estan replicados al 100%.
- `Visita.codigo` es unico; si se reutiliza un codigo de servicio en la app tecnico, la sincronizacion puede fallar por restriccion de unicidad.
- Si Supabase no tiene datos o migraciones, los informes se generan vacios o fallan por tabla faltante.
- QA 2026-05-29 genero PDFs de visitas/facturacion y envio ambos informes por MS Graph a `carlos@prof3sional.com`.
- QA 2026-05-29 con service role genero PDF de cotizacion `COT-2026-000003` y envio la cotizacion por MS Graph a `carlos@prof3sional.com`.
- QA 2026-05-29 offline/R2 genero PDF de cotizacion `COT-FIX-20260530000428` y PDF de informe de visitas para la visita `6`; la API de informes incluye 4 adjuntos de la visita sincronizada.
- QA 2026-06-06 genero visita tecnica `10` con codigo `IT_2026 3659`, cliente `AQUAGESTION S.A.`, equipo `EQ-BM-68`, imagen recortada desde referencia y PDF en `QA/informe_tecnico_QA_IT_2026_3659.pdf`. Se valido texto extraido con titulos: `DATOS DEL EQUIPO`, `I. TRABAJOS REALIZADOS Y REPORTES`, `II. ESTADO INICIAL`, `III. REPORTES DE MEDICION`, `IV. CONSIDERACIONES`, `V. CODIGO INSTRUMENTO Y CODIGO DEL SERVICIO`.
- QA 2026-06-06 genero PDF `QA/informe_tecnico_QA_headers_firma_anexos.pdf` con 3 paginas: pagina 1 datos/I/II, pagina 2 header de continuacion + III/IV/V/firma sin imagen inventada, pagina 3 header + anexo fotografico titulado/descripto. Se valido texto extraido: orden completo correcto y `Nombre y Firma Responsable` antes de `ANEXO FOTOGRAFICO`.
- QA 2026-06-06 en navegador `/tecnico`: se recargo la app, se verificaron objetivo/especificaciones, Base %, condicion y se agrego una medicion de temperatura; la lista inferior mostro `Prog.`, `Obs.`, `Dif.`, fila `Temperatura °C`, diferencia `+0.1 °C` y criterio `± 1 °C`.
- Ajuste 2026-06-06: despues de agregar una medicion en `/tecnico`, `measurementDraft` vuelve a `createEmptyMeasurement()` para limpiar todos los campos.
- Ajuste 2026-05-29: PDF de cotizacion usa espaciado vertical mas compacto entre datos de cliente, tabla de items, separador de totales y observaciones para evitar grandes blancos con pocos items.
- Las rutas dinamicas `[id]` deben esperar `params` en Next 16; se corrigio para CRUD/PDF/email de recursos por id.

## Pendientes reales y proximos pasos

- Probar servicios largos reales para afinar agrupacion si una medicion o consideracion supera una pagina completa.
- Incorporar plantillas por tipo de equipo/servicio.
- Guardar version emitida del informe y bitacora de envios.
