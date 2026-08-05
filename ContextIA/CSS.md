# CSS y consistencia visual

## Regla de alineación

> Debemos procurar siempre alinear verticalmente los elementos contiguos horizontalmente dentro de un cuadro en común.

La regla aplica a encabezados de campo, entradas, cuadros combinados, botones auxiliares y resúmenes dentro de una misma grilla. No se debe usar texto de ayuda en una columna que cambie la altura de su par; si una explicación es indispensable, se reserva un bloque común debajo de toda la fila.

## Formularios

- Solo los campos obligatorios muestran un asterisco rojo junto al título.
- Todo campo sin asterisco se entiende opcional; no se agrega la palabra `Opcional` bajo o junto al control.
- Los títulos usan una altura de línea mínima compartida (`.quote-field-label`) antes del control, para conservar la alineación incluso cuando cambie el contenido.
- Los cuadros combinados son el control estándar para seleccionar entidades ya existentes. Su listado se filtra dentro del propio control y puede buscar por los identificadores que el módulo defina.

## Cotizaciones

En el editor comercial, cada tarjeta mantiene sus niveles visuales: ítem de equipo, luego sus servicios. El ítem seleccionado se muestra como identidad de solo lectura; los servicios conservan sus propios campos de cantidad, precio, descuento y total.
