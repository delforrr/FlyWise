# Flujos principales de FlyWise

Diagramas del sistema implementado. El spec define las ampliaciones por ticket.

## Ingesta de catálogos

```mermaid
flowchart TD
    A[Administrador o programación UTC] --> B[Validar configuración y capturar ejecución]
    B --> C[Encolar trabajo en BullMQ]
    C --> D[Worker: iniciar intento]
    D --> E[Leer CSV como stream]
    E --> F{Fuente configurada}
    F -->|OpenFlights sin cabecera| G[Adapter: posiciones a campos]
    F -->|CSV configurado| H[Aplicar correspondencias de columnas]
    F -->|OurAirports con cabecera| Q[Adapter: formato oficial de países o aeropuertos]
    G --> I[Normalizar y validar catálogo]
    H --> I
    Q --> I
    I --> J{Fila válida}
    J -->|Sí| K[Lote transaccional: conservar protección y archivo]
    J -->|No| L[Contabilizar descarte y muestra acotada]
    K --> M[Actualizar contadores e historial]
    L --> M
    M --> N{Quedan filas}
    N -->|Sí| E
    N -->|No| O[Completar ejecución y checksum]
    D -. Fallo .-> P[Registrar error y reintentar según política]
    P --> D
```

## Correspondencias entre catálogos

```mermaid
flowchart TD
    A[Fila de aeropuerto normalizada] --> B{Identidad externa ya conocida}
    B -->|Sí| C[Conservar su vinculación o su estado pendiente]
    B -->|No| D[Buscar candidatos por códigos]
    D --> E{Coincidencia única y compatible}
    E -->|ICAO y país compatibles, sin otra identidad automática| F[Vincular al aeropuerto existente]
    E -->|Ambigua o contradictoria| G[Guardar observación pendiente]
    D -->|Sin candidatos ni conflicto de códigos en el lote| H[Crear aeropuerto con identidad propia]
    C --> I{Vinculación resuelta}
    F --> I
    H --> I
    I -->|Sí| J{Archivado o protegido manualmente}
    J -->|Sí| K[Conservar los valores administrativos]
    J -->|No| L[Aplicar geografía OurAirports con WGS84]
    I -->|No| G
    G --> M[Admin: buscar aeropuerto y revisar correspondencia]
    M --> N[Vinculación explícita y transaccional]
    N --> J
    L --> O[OpenFlights posterior conserva esa geografía]
```

Los identificadores se interpretan dentro de su fuente. Una coincidencia de IATA con ICAO o país contradictorios requiere revisión. El administrador puede vincular explícitamente alias que no se aceptan automáticamente.

Las correcciones, retiros y restauraciones de operaciones conservan el historial y encolan el recálculo de las combinaciones afectadas. El mapa conserva el último valor válido mientras la combinación está pendiente. Ver la [verificación de operaciones y métricas](verification-03.md) y la [verificación del mapa](verification-07.md).

## Consulta de rutas y mapa

```mermaid
sequenceDiagram
    actor Usuario
    participant UI as Explorador Nuxt
    participant API as API de rutas
    participant OTP as API de métricas
    participant DB as PostgreSQL y PostGIS
    participant Mapa as Deck.gl y MapLibre
    Usuario->>UI: Seleccionar extremos y filtros
    UI->>API: Consultar conexiones
    API->>DB: Resolver rutas y ofertas visibles
    DB-->>API: Extremos, operador y distancia geográfica
    API-->>UI: Conexiones del catálogo histórico
    UI->>OTP: Consultar mes inicial y opciones
    OTP-->>UI: Último mes BTS completo, períodos y aerolíneas
    UI->>OTP: Consultar hasta 100 pares dirigidos por mes y aerolínea
    OTP->>DB: Agregar contadores de operaciones
    OTP-->>UI: Puntualidad, muestra, fuentes y estado del cálculo
    UI->>Mapa: Colorear los arcos con el OTP del sentido correspondiente
    Mapa-->>Usuario: Rojo para 0 % y gris para datos ausentes
```
