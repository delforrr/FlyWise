# Revisión de las validaciones de FlyWise

Rama: `refactor/backend-data-validation`. Destino: `develop`.
Base revisada: `2fc7cacdfd4d9294e0b094b902b4c59a2cef06a1`.
Los tickets y sus criterios están en [el registro de trabajo](../.scratch/backend-data-validation/issues/).

Este documento consolida las revisiones independientes de estándares, cumplimiento de los tickets y revisión adversarial, junto con las correcciones y pruebas realizadas después de sus observaciones.

## Qué cambia y por qué

| Cambio | Motivo | Efecto práctico |
| --- | --- | --- |
| Campos obligatorios comprobados después de transformar y normalizar | Un campo con espacios o un código inválido podía superar la comprobación inicial | El operador recibe un descarte con el campo y el motivo correctos |
| Códigos ambiguos rechazados | Se elegía la primera coincidencia aunque hubiera varias entidades históricas | La búsqueda informa el conflicto y evita mostrar un aeropuerto o una aerolínea arbitrarios |
| Códigos existentes preservados ante entradas malformadas | Una importación defectuosa podía reemplazar un código válido por ausencia | La actualización no borra información válida; la ausencia explícita sigue pudiendo limpiarla |
| Configuraciones guardadas revalidadas | La ejecución confiaba en que toda configuración había pasado por un formulario válido | Los trabajos inválidos se rechazan antes de ejecutarse; un calendario inválido se deshabilita sin impedir que arranque la API |
| Historial separado por intento | Los contadores podían corresponder al intento actual y las muestras al anterior | El operador puede elegir el intento y consultar sus propios descartes; las recuperaciones tras caída también quedan separadas |
| Relaciones de país con procedencia identificada | Una relación inferida podía quedar obsoleta cuando la fuente corregía el país | Las inferencias se actualizan; las relaciones explícitas se conservan |
| Restricciones de catálogo y trabajos completados en la base | Un escritor interno podía saltarse reglas de la API | La base rechaza códigos malformados, nombres vacíos, emails sin normalizar y finalizaciones incompletas |
| Identidad de aeropuerto comprobada en rutas | Dos códigos distintos podían referirse al mismo aeropuerto | IATA e ICAO funcionan y los extremos iguales se rechazan con un error claro; el selector tampoco mantiene PKN → PKN |
| Configuración de arranque validada | Se aceptaban puertos imposibles y secretos demasiado cortos | El desarrollador detecta el problema al arrancar, sin exponer los valores en el error |
| Contrato regenerado antes de compilar y limpieza de validaciones antiguas | Los archivos generados podían quedar desactualizados y existía un DTO de login sin consumidores | La build se prepara sola; login y registro conservan la contraseña exacta |
| Enriquecimiento de operadores calculado una vez por código y lote | La doble importación real llegó a superar el límite de dos minutos | La misma prueba volvió a pasar en unos 27 segundos, sin aumentar su timeout ni insertar duplicados |

## Qué encontró la revisión adversarial

Se corrigieron los cinco casos concretos encontrados:

1. **Recuperación de un trabajador caído:** contar únicamente los fallos terminados podía reutilizar un número de intento. Se cuentan las activaciones y el mensaje de inicio usa ese mismo número. La integración cierra un worker sin terminar su trabajo y comprueba su recuperación real en Redis.
2. **Cambios rápidos del selector:** una respuesta antigua podía reemplazar la selección más reciente. El selector queda deshabilitado mientras carga; el test monta el componente y usa una respuesta diferida para comprobarlo.
3. **Conversión numérica inválida:** `abc` podía convertirse en NaN y después en el código textual NAN. Los números no finitos se rechazan antes de normalizar. NAN textual sigue siendo válido: aparece en el registro de Nadi, ID 1960, en airports.dat.
4. **Espacios en emails escritos directamente en SQL:** el recorte por defecto de PostgreSQL no coincidía con el de JavaScript. La restricción usa el mismo conjunto de espacios, incluidas tabulaciones, espacios no separables y BOM. No se duplica un validador completo de email ni se prohíben espacios interiores de un nombre entre comillas.
5. **Nombres de columnas heredados:** una columna inexistente llamada toString podía encontrarse en el prototipo del objeto. Ahora se comprueba que la columna pertenezca realmente al registro CSV.

La revisión de estándares no identificó infracciones nuevas; observó que dos variables llamadas IATA ahora también podían contener ICAO. Se renombraron para reflejarlo.

## Pruebas y evidencia

- Los casos nuevos se reprodujeron fallando antes de aplicar la corrección y pasaron después.
- La integración importa los archivos completos mediante streams: 261 países, 7.698 aeropuertos, 6.162 aerolíneas y 67.663 rutas. Conserva 6.161 aerolíneas y 67.091 rutas válidas, con 572 rutas descartadas, incluida PKN → PKN. La segunda importación agrega cero rutas.
- Las pruebas de intentos usan PostgreSQL, Redis y BullMQ reales, colas propias de prueba y rollback de los datos de catálogo. Cubren fallo convencional y recuperación de un trabajo detenido tras perder su worker.
- Las pruebas HTTP comprueban códigos ambiguos, formatos inválidos, equivalencia IATA/ICAO y extremos iguales. Otra integración ejecuta el backend compilado como proceso hijo y confirma que un puerto inválido impide abrir el servidor.
- Resultado final: 202 pruebas del backend en 33 suites; 25 integraciones en 12 suites; 177 pruebas del frontend en 22 suites. Tipos, lint sin errores ni avisos, compilaciones y comprobación de contrato/esquema con Prisma verificadas.
- La comprobación del componente del selector es automatizada. No se realizó una recorrida manual del navegador ni una medición de rendimiento gráfico.

## Revisar desde otro equipo

1. Cambiar a esta rama, instalar las dependencias de backend y frontend y ejecutar `docker compose up -d`.
2. Verificar el esquema base del proyecto. La restricción `routes_offer_key` debe usar `UNIQUE NULLS NOT DISTINCT`, tal como establece `20261024_catalog_v1.sql`; así se evitan duplicados cuando se desconoce el operador.
3. En una base existente, aplicar **una sola vez y en este orden** los cambios pendientes de `backend/prisma/changes/`:
   - `20261029_attempt_audit.sql`
   - `20261029_country_links.sql`
   - `20261029_completed_jobs.sql`
   - `20261029_catalog_invariants.sql`
   - `20261029_review_email_trim.sql`
4. Ejecutar `npm run build` dentro de backend. Luego `npx prisma db init --dry-run`: después de las migraciones debe mostrar cero operaciones. Solo entonces ejecutar `npx prisma db init` para firmar el contrato y `npx prisma db verify` para comprobarlo.
5. En backend ejecutar `npm test -- --runInBand`, `npm run test:e2e -- --runInBand`, `npx tsc --noEmit` y `npx eslint src test --max-warnings=0`. En frontend ejecutar `npm run build` y `npm test -- --maxWorkers=2`.

Ejemplo PowerShell desde la raíz para cada archivo pendiente:

```powershell
Get-Content -Raw backend/prisma/changes/20261029_attempt_audit.sql |
  docker exec -i flywise_postgres psql -U dev_user -d flywise_db -v ON_ERROR_STOP=1
```

Las migraciones son transaccionales y no borran datos. Si encuentran registros anteriores incompatibles, se detienen y revierten: hay que revisar esos registros antes de continuar. No usar resets, truncados ni repetir ciegamente los cambios aditivos.

En una base nueva, instalar primero las funciones SQL, crear el contrato actual e instalar el trigger después. El contrato ya incluye las columnas y restricciones nuevas; no volver a agregarlas con las migraciones de actualización. Aplicar la semántica de unicidad con nulos del cambio base.

## Límites y decisiones conservadas

- Los vínculos históricos de país sin procedencia registrada se conservan como explícitos. Reclasificarlos sin evidencia podría sobrescribir una decisión manual.
- El intento 0 identifica historial previo sin número de intento. No se inventa una asignación retrospectiva.
- Se mantienen coordenadas cero válidas, SRID 4326 y su trigger, códigos opcionales y no únicos, operadores desconocidos, aerolíneas inactivas y demoras negativas válidas.
- No se agregaron fuentes nuevas ni importación de puntualidad. El identificador OpenFlights continúa acotado al importador actual.
- El secreto JWT exige al menos 32 caracteres sin espacios. Es una comprobación mínima; no mide la calidad aleatoria del secreto.
- Volver al código anterior no revierte automáticamente los cambios de base. Revisar la compatibilidad del contrato y las restricciones antes de volver atrás.
