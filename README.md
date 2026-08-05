# CMCing CMMS

CMMS de producción para organizar el servicio técnico de CMCing mediante órdenes de trabajo (OT), actividades asignadas, matrices de cumplimiento, evidencia privada y trazabilidad completa.

## Estado verificado al 2026-08-04

- Supabase/PostgreSQL es la fuente de verdad. El lote productivo de 11 migraciones se aplicó sobre las dos migraciones base y el OpenAPI remoto confirmó 42 tablas públicas.
- Microsoft Entra ID está activo como proveedor Azure de Supabase y el hook `Before User Created` aplica la allowlist del servidor.
- La invitación real de Carlos devolvió `200`; el hook entregó el mensaje a Microsoft Graph con aceptación `202` y `AuthEmailDelivery` quedó `ACCEPTED`, `attempts = 1`, sin error. Esto valida el pipeline hasta Graph, no la confirmación del usuario: Carlos aún debe aceptar la invitación e iniciar sesión.
- Cloudflare R2 se usa como almacenamiento privado; los binarios no se publican mediante URL directa.
- La mejora de notas con OpenAI está preparada, pero permanece inactiva. El usuario incorporará `OPENAI_API_KEY` después.
- Producción está desplegada en `https://cm-cing.vercel.app` con Node `24.x`. La salud profunda respondió `200` con `database: ok`; login, redirect SSO, rutas privadas, headers, manifiesto, service worker y responsive 320/375/390/768 fueron verificados en la URL pública.

## Dominio operativo

- Una OT puede crearse con cero, una o varias actividades.
- Cada actividad pertenece a una OT, se asigna a un técnico y concentra notas, matrices, mediciones, fotografías y documentos.
- Las actividades cerradas quedan bloqueadas. El desbloqueo exige rol administrativo, motivo y registro de auditoría.
- Las matrices soportan respuestas numéricas, dicotómicas, de selección múltiple y de texto. Una matriz publicada queda versionada e inmutable.
- `Visita` se conserva sólo por compatibilidad histórica; la operación técnica nueva usa `OrdenTrabajo` y `OrdenTrabajoActividad`.

## Arquitectura

- Next.js 16 y React 19 para UI, rutas y APIs.
- Supabase Auth con Microsoft SSO, PKCE y sesiones SSR.
- PostgreSQL con RLS/RBAC, revisiones optimistas, auditoría append-only y RPC atómicos.
- IndexedDB/Dexie, service worker y outbox local para la app offline-first del técnico.
- Cloudflare R2 privado para imágenes y adjuntos; PostgreSQL guarda metadata, clave y checksum.
- `pdf-lib` para informes por actividad.
- Microsoft Graph para correos corporativos.
- OpenAI Responses API preparada en servidor, sin credencial activa.
- Vercel como destino de hosting.

## Rutas principales

- `/ordenes-trabajo`: alta y listado de OT.
- `/ordenes-trabajo/[id]`: detalle y actividades de una OT.
- `/actividades/[id]`: ejecución, matrices, evidencia, cierre y auditoría.
- `/tecnico`: jornada móvil offline-first del técnico autenticado.
- `/matrices`: definición, alcance y versionado de matrices.
- `/admin`: maestros y operación administrativa.

## Desarrollo local

1. Instalar dependencias con `npm install`.
2. Crear `.env.local` a partir de `.env.example`, sin copiar secretos a documentación ni commits.
3. Ejecutar `npm run dev` y abrir `http://localhost:3022`.
4. Antes de entregar cambios, ejecutar `npm run check`, `npm run typecheck` y `npm run build` con Node.js 24.

Las migraciones de `supabase/migrations` son la fuente canónica del esquema. `prisma/schema.prisma` se mantiene sólo como referencia y puede requerir una nueva introspección después de cambios SQL.

El puerto local permanente de CMCing es `3022`: tanto `npm run dev` como `npm run start` lo fijan explícitamente.

## Fronteras de seguridad

- Roles y habilitación se resuelven desde `Usuario`, no desde metadata controlable por el cliente.
- Las APIs técnicas usan la sesión Supabase del usuario y RLS; la service role queda reservada para tareas administrativas explícitas y hooks confiables.
- Fotografías y documentos se vinculan a la actividad que los originó y se entregan mediante `/api/r2/private` con autorización.
- No registrar tokens, OTP, secretos, contenido de enlaces de autenticación ni credenciales OpenAI.

## Pendientes de cierre operativo

La plataforma está publicada, pero aún faltan recorridos que requieren identidades y datos reales: Carlos debe aceptar la invitación y validar su primer login; `cmanzor@cmcing.cl` debe completar el primer ingreso Microsoft; falta probar una cuenta rechazada, el ciclo OT completo, bloqueo/desbloqueo auditado, aislamiento entre técnicos, carga/lectura R2 y sincronización offline cerrando y reabriendo el navegador con una sesión técnica válida. El PDF fue generado y revisado visualmente; la plantilla formal aún requiere aprobación de CMC.
