# ContextIA - Runtime y experiencia 360

Última actualización: 2026-08-04.

## Decisión vigente

CMCing no tiene un modo demo operativo. Las pantallas productivas leen Supabase y deben mostrar el error real cuando faltan sesión, política, esquema o integración; no pueden simular que una OT, actividad, matriz o evidencia fue guardada.

`app/lib/demo-store.js` aún existe como archivo heredado, pero no tiene importaciones desde `app/`. Debe tratarse como deuda de limpieza, no como fallback permitido.

## Navegación 360

- `AppShell` y `AppSidebar` mantienen acceso global a OT, actividades, matrices, equipos, clientes, personas, transporte e informes.
- `CommandCenter` ofrece navegación con teclado y recientes para llegar a módulos desde cualquier contexto.
- Las fichas de maestros concentran datos, relaciones e historial en lugar de dispersar acciones en pantallas aisladas.
- En selecciones de negocio se prioriza `ComboBox`/`MultiComboBox`; las mediciones se pueden crear en el mismo listado.
- Las transiciones son suaves y respetan `prefers-reduced-motion`.

## App técnica

- `/tecnico` es una superficie móvil dedicada y offline-first, separada del backoffice.
- IndexedDB conserva snapshot, borradores, blobs y outbox por usuario.
- El service worker puede reabrir el shell técnico sin red después de una carga previa, pero APIs y autenticación son network-only.
- La cola se sincroniza con RPC de OT/actividad; no crea `Visita` nueva.
- Logout o cambio de usuario debe limpiar/aislar la partición local para evitar exposición cruzada.

## Fronteras de producto

- OpenAI se muestra como no configurado mientras falte `OPENAI_API_KEY`; nunca debe simular una mejora.
- Una integración R2, correo o PDF que falle conserva un estado visible/reintentable; no se marca como completada por optimismo de UI.
- Capacidades todavía no validadas E2E deben presentarse como pendientes/no disponibles. El correo Auth llegó hasta `202 Accepted` de Graph y ledger `ACCEPTED`; la activación sigue pendiente hasta que Carlos acepte la invitación e ingrese.

## Validación publicada

Producción está publicada en `https://cm-cing.vercel.app`. Se verificaron build remoto, salud profunda Supabase, login, redirección Microsoft, protecciones anónimas, headers, consola, service worker y viewports 320/375/390/768 sin overflow.

Siguen pendientes recorridos que requieren usuarios, datos y archivos reales:

- ciclo real OT → actividad → matrices → imágenes → cierre → bloqueo → desbloqueo;
- offline cerrar/reabrir navegador y recuperar conexión;
- permisos negativos entre roles/técnicos;
- primer login de ambos superadmins y rechazo de una identidad no permitida;
- carga/lectura R2 y emisión autenticada/versionada del PDF.

No confundir que una ruta compile o que el esquema exista con una validación E2E del producto.
