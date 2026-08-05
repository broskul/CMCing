# ContextIA - Cloudflare R2

Última actualización: 2026-08-04.

## Objetivo

Cloudflare R2 almacena binarios privados de CMCing: fotografías de actividades, fotos de camiones, firmas y adjuntos históricos. Supabase conserva únicamente metadata, relación de dominio, clave R2 y checksum.

## Estado verificado

- Bucket activo: `cmcing`.
- El bucket es privado y las credenciales auditadas pueden listar objetos.
- Las variables R2 necesarias se sincronizaron de forma server-side con Preview y Production en Vercel.
- En producción `/api/r2/private` rechazó correctamente una solicitud anónima con `401`. No se ha validado todavía el ciclo E2E autenticado: carga, registro SQL, lectura autorizada, denegación entre técnicos y limpieza transaccional.

## Contrato de almacenamiento

- Actividades: `private/ordenes-trabajo/{otId}/actividades/{actividadId}/...`.
- Camiones: `private/camiones/{camionId}/...`.
- Equipos: `private/equipos/{equipoId}/...`.
- Los prefijos legacy de firmas/evidencias siguen siendo privados mientras existan referencias históricas.
- Nunca almacenar evidencia técnica sensible bajo una clave pública ni persistir una URL pública utilizable.
- `ArchivoAdjunto`/`CamionFoto` guardan `r2Bucket`, `r2Key`, MIME, tamaño, checksum y metadata.

## Acceso

- La carga valida sesión, rol, propiedad de la actividad, tamaño, MIME y firma mágica del archivo.
- La clave se construye en servidor; el cliente no elige rutas arbitrarias.
- `/api/r2/private` verifica autorización y entrega el objeto mediante streaming, con soporte de `Range` cuando corresponde.
- Si el registro SQL falla después de la carga, el código intenta eliminar el objeto para no dejar huérfanos.
- Al reemplazar o eliminar una foto se debe conservar coherencia entre R2 y PostgreSQL; cualquier fallo debe quedar visible y reintentable.
- La imagen de equipo se recibe como archivo, arrastre o URL remota. La URL se descarga server-side con validación de protocolo, DNS/red interna, redirecciones y límite de 12 MB; sólo se persiste el binario validado en R2, nunca la URL externa.

## Variables server-side

Nombres canónicos de este proyecto:

- `CLOUDFLARE_R2_ACCOUNT_ID`
- `CLOUDFLARE_R2_ACCESS_KEY_ID`
- `CLOUDFLARE_R2_SECRET_ACCESS_KEY`
- `CLOUDFLARE_R2_BUCKET`

`app/lib/r2.js` mantiene compatibilidad con `R2_ACCOUNT_ID`, `R2_ENDPOINT`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `R2_REGION` y `CLOUDFLARE_S3_URL`. `CLOUDFLARE_R2_PUBLIC_URL`/`R2_PUBLIC_BASE_URL` no deben usarse para evidencia privada.

## Archivos clave

- `app/lib/r2.js`: cliente, validación, streaming, checksum y borrado.
- `app/api/r2/private/route.js`: descarga autorizada.
- `app/api/ot-actividades/[id]/imagenes/route.js`: evidencia de actividad.
- `app/api/camiones/[id]/fotos/route.js`: fotografía de camión.
- `app/api/equipos/[id]/imagen/route.js`: reemplazo de imagen de equipo y metadata en `Equipo`.
- `app/lib/equipment-image-service.js`: validación de archivo/URL, carga privada y limpieza compensatoria.

## Pendientes

- QA publicado con archivo válido, MIME falsificado, acceso entre técnicos, `Range` y archivo mayor al límite.
- Simular fallo SQL después del upload y confirmar eliminación del objeto.
- Aplicar primero la migración de imágenes de equipo y probar carga, arrastre, URL remota y lectura autorizada de `private/equipos/` en el entorno publicado.
- Definir retención, borrado administrativo, inventario periódico y recuperación ante pérdida de metadata.
- Aplicar rotación futura sólo con validación de la clave nueva antes de revocar la anterior.
