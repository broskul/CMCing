# ContextIA - Auth

## Estado vigente

Ultima actualizacion: 2026-04-17.
No hay autenticacion/autorizacion de usuarios implementada en la app.

## Objetivo del modulo

Registrar estado real de seguridad y dejar ruta clara para implementar auth antes de produccion.

## Fuentes de verdad y sistemas externos

- No hay proveedor de identidad activo para login de app.
- Unica integracion Microsoft actual: envio de correo por Graph (backend to backend).

## Flujo funcional real

- Cualquier usuario con acceso a la URL puede navegar por paginas y consumir APIs internas.
- No hay roles, sesiones, ni proteccion por middleware.

## Archivos clave

- No existen aun archivos de auth dedicados.
- Futuro punto de entrada sugerido: `middleware` + proveedor OIDC/Entra.

## Decisiones tecnicas vigentes

- En demo se prioriza velocidad de validacion funcional sobre control de acceso.
- Se asume entorno controlado para pruebas comerciales.

## Riesgos y bugs conocidos

- Riesgo alto si se despliega asi a produccion.
- APIs de escritura expuestas sin control de identidad.

## Workarounds actuales

- Uso solo en entorno demo/controlado.
- No publicar como entorno abierto productivo.

## Pendientes reales y proximos pasos

- Elegir estrategia de auth (ej. Entra ID / NextAuth / otro OIDC).
- Definir roles minimos (admin, operativo, lectura).
- Proteger rutas API sensibles con middleware y validacion de sesion.
- Auditar permisos por accion (crear/editar/eliminar/enviar correo).

## Notas para presentacion y onboarding

- Al presentar, dejar claro que auth es pendiente de fase produccion.
- Evitar demos en redes publicas sin capa adicional de acceso.
