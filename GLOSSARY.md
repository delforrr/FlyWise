# FlyWise

Exploración de rutas comerciales y administración de catálogos aeronáuticos.

## Lenguaje

**Ruta**: conexión dirigida entre un aeropuerto de origen y uno de destino. Puede reunir varias ofertas.
_Evitar_: oferta, vuelo concreto.

**Oferta de ruta**: alternativa de operación de una ruta, caracterizada por aerolínea o código de aerolínea, código compartido y cantidad de escalas.
_Evitar_: ruta canónica, vuelo observado.

**Archivo de catálogo**: retiro de un registro de las consultas vigentes conservando su identidad y relaciones históricas.
_Evitar_: borrado definitivo.

**Protección manual**: condición por la que una edición administrativa se conserva frente a futuras importaciones hasta que se libere su protección.
_Evitar_: bloqueo de lectura.

**Proceso de ingesta**: definición reutilizable de una fuente, sus correspondencias con el catálogo y su programación.
_Evitar_: ejecución.

**Ejecución de ingesta**: trabajo solicitado para importar un conjunto de datos; conserva su configuración e historial cuando corresponde a un proceso.
_Evitar_: intento.

**Intento de ingesta**: una pasada de procesamiento dentro de una ejecución. Una ejecución puede tener varios intentos por recuperación automática; un reintento solicitado por el administrador crea otra ejecución.
_Evitar_: proceso.
