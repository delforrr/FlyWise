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

**Proceso de ingesta**: definición reutilizable de una fuente, sus correspondencias con el dominio y su programación.
_Evitar_: ejecución.

**Ejecución de ingesta**: trabajo solicitado para importar un conjunto de datos; conserva su configuración e historial cuando corresponde a un proceso.
_Evitar_: intento.

**Intento de ingesta**: una pasada de procesamiento dentro de una ejecución. Una ejecución puede tener varios intentos por recuperación automática; un reintento solicitado por el administrador crea otra ejecución.
_Evitar_: proceso.

**Operación de vuelo**: realización individual de un servicio entre origen y destino, para un operador y fecha determinados, con resultado final conocido.
_Evitar_: ruta, oferta, movimiento aeroportuario.

**Movimiento aeroportuario**: aterrizaje o despegue observado en un aeropuerto; una operación puede producir más de un movimiento.
_Evitar_: vuelo completo.

**Puntualidad de llegada**: medida del cumplimiento del horario de llegada previsto de las operaciones elegibles. Es la puntualidad que representa el color de una ruta en FlyWise.
_Evitar_: puntualidad de salida, indicador externo.

**Indicador externo**: medida publicada por una fuente con su población, metodología y período propios.
_Evitar_: operación individual, OTP FlyWise.

**Cobertura**: conjunto de operaciones, lugares, operadores y períodos representados por una fuente o cálculo.
_Evitar_: totalidad mundial implícita.

**Período observado**: intervalo de fechas al que corresponden los hechos medidos, independiente del momento de su importación.
_Evitar_: fecha de carga.

**Correspondencia de identidad**: vinculación explícita entre una identidad externa y el aeropuerto u operador que representa en FlyWise.
_Evitar_: igualdad de códigos entre fuentes.

**Revisión candidata**: operaciones inmutables de una ejecución de ingesta para una población. Puede sustituir la publicación vigente tras validar que cubre el alcance completo y que sigue habilitada para promoverse.
_Evitar_: publicación vigente.

**Publicación de métricas**: resultado validado de una población de operaciones de un tramo, operadora y mes, con procedencia y definición de cálculo identificadas. La publicación vigente permanece disponible hasta que otra válida la sustituye.
_Evitar_: ejecución de ingesta, descarga completada.

**Servicio de datos**: configuración administrable de un proveedor o modalidad de carga compatible, con alcance y programación propios.
_Evitar_: proveedor externo, ejecución individual.
