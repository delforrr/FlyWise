import { ref, computed, onMounted, onUnmounted } from 'vue';
import type {
  EtlPipeline,
  PipelineId,
  EtlGlobalMetrics,
  EtlLogEntry,
  TriggerSyncOptions,
} from '../types/etl';

const initialPipelines: EtlPipeline[] = [
  {
    id: 'ourairports',
    name: 'Catálogo de Aeropuertos y Pistas',
    datasetName: 'OurAirports Open Data',
    description:
      'Coordenadas geográficas bajo estándar SRID 4326, códigos oficiales IATA/ICAO, elevación y pistas mundiales.',
    icon: 'i-lucide-map-pin',
    status: 'success',
    progressPercent: 100,
    processedRows: 78412,
    totalEstimatedRows: 78500,
    discardedRows: 88,
    lastSyncAt: 'Hoy a las 04:15 UTC',
    nextScheduledSync: 'Domingo 03:00 UTC',
    scheduleDescription: 'Semanal (Domingos 03:00 UTC)',
    averageSpeedRowsPerSec: 3200,
    currentStepMessage: 'Al día — Coordenadas e identificadores normalizados.',
    discardedSamples: [
      {
        id: 'disc-oa-1',
        rowIndex: 1402,
        rawSample: '"", "ZZZZ", "Pista Privada Sin Nombre", -999.0, 45.0',
        reason: 'Coordenada de latitud fuera de rango astronómico [-90, 90]',
        field: 'latitude_deg',
        timestamp: 'Hoy a las 04:14 UTC',
        resolved: false,
      },
      {
        id: 'disc-oa-2',
        rowIndex: 9811,
        rawSample: '"", "", "Heliport Test Only", -34.6037, -58.3816',
        reason: 'Identificador IATA e ICAO ausentes simultáneamente',
        field: 'ident',
        timestamp: 'Hoy a las 04:14 UTC',
        resolved: false,
      },
    ],
  },
  {
    id: 'openflights',
    name: 'Red de Conexiones y Rutas',
    datasetName: 'OpenFlights Global Routes',
    description:
      'Pares origen-destino, códigos IATA de aerolíneas operadoras, paradas técnicas y tipos de aeronaves asignadas.',
    icon: 'i-lucide-git-commit-horizontal',
    status: 'success',
    progressPercent: 100,
    processedRows: 67490,
    totalEstimatedRows: 67663,
    discardedRows: 173,
    lastSyncAt: 'Ayer a las 23:30 UTC',
    nextScheduledSync: 'Lunes 02:00 UTC',
    scheduleDescription: 'Semanal (Lunes 02:00 UTC)',
    averageSpeedRowsPerSec: 4100,
    currentStepMessage: 'Al día — Red de conexiones y arcos geodésicos precalculados.',
    discardedSamples: [
      {
        id: 'disc-of-1',
        rowIndex: 4120,
        rawSample: '"XX", "999", "AAA", "9999", "BBB", "Y"',
        reason: 'Aeropuerto destino (BBB) no encontrado en el catálogo de aeropuertos',
        field: 'destination_airport_id',
        timestamp: 'Ayer a las 23:28 UTC',
        resolved: false,
      },
      {
        id: 'disc-of-2',
        rowIndex: 12450,
        rawSample: '"", "", "EZE", "123", "MAD", ""',
        reason: 'Código de aerolínea vacío o inexistente',
        field: 'airline_code',
        timestamp: 'Ayer a las 23:29 UTC',
        resolved: false,
      },
    ],
  },
  {
    id: 'bts-transtats',
    name: 'Telemetría y Puntualidad OTP-15',
    datasetName: 'Bureau of Transportation Statistics (BTS)',
    description:
      'Registros de arribos, cálculo de demoras en minutos, cancelaciones y tuplas de agregación (Origen, Destino, Aerolínea, Periodo).',
    icon: 'i-lucide-timer',
    status: 'running',
    progressPercent: 46,
    processedRows: 207000,
    totalEstimatedRows: 450000,
    discardedRows: 342,
    lastSyncAt: '12 Sep 2026 18:00 UTC',
    nextScheduledSync: 'En ejecución',
    scheduleDescription: 'Mensual (Día 15 de cada mes)',
    averageSpeedRowsPerSec: 2850,
    currentStepMessage: 'Procesando lote 83 de 180 — Agregando tuplas OTP-15 en lotes de 2.500 filas.',
    discardedSamples: [
      {
        id: 'disc-bts-1',
        rowIndex: 45020,
        rawSample: '"2026-08-14", "AA", "1234", "JFK", "LAX", "NA", "NA", "1"',
        reason: 'Vuelo marcado como cancelado sin especificar causa formal',
        field: 'cancellation_code',
        timestamp: 'Hace 5 minutos',
        resolved: false,
      },
      {
        id: 'disc-bts-2',
        rowIndex: 112004,
        rawSample: '"2026-08-15", "DL", "567", "ORD", "MIA", "9999", "-15"',
        reason: 'Hora programada inválida fuera del rango 00:00 - 23:59',
        field: 'crs_dep_time',
        timestamp: 'Hace 2 minutos',
        resolved: false,
      },
    ],
  },
  {
    id: 'anac',
    name: 'Registros Operativos Regionales',
    datasetName: 'ANAC Telemetría Aérea',
    description:
      'Telemetría de vuelos comerciales en el cono sur (Argentina / Brasil), con factores de ocupación y horarios reales.',
    icon: 'i-lucide-plane-takeoff',
    status: 'idle',
    progressPercent: 0,
    processedRows: 118900,
    totalEstimatedRows: 120000,
    discardedRows: 24,
    lastSyncAt: '18 Sep 2026 09:12 UTC',
    nextScheduledSync: 'Mañana a las 05:00 UTC',
    scheduleDescription: 'Diario (05:00 UTC)',
    averageSpeedRowsPerSec: 2100,
    currentStepMessage: 'En espera — Listo para sincronización manual o programada.',
    discardedSamples: [
      {
        id: 'disc-anac-1',
        rowIndex: 541,
        rawSample: '"AR", "1302", "AEP", "COR", "2026-09-17", "NO_REPORTED"',
        reason: 'Estado de demora no registrado por la operadora',
        field: 'delay_minutes',
        timestamp: '18 Sep 2026 09:10 UTC',
        resolved: false,
      },
    ],
  },
];

const initialLogs: EtlLogEntry[] = [
  {
    id: 'log-1',
    timestamp: '17:34:10',
    pipelineId: 'bts-transtats',
    pipelineName: 'Telemetría OTP-15 (BTS)',
    level: 'info',
    message: 'Lote 82 procesado correctamente: 2.500 registros agregados a la base de datos.',
    detail: 'Duración del lote: 820 ms. Memoria de worker estable en 142 MB.',
  },
  {
    id: 'log-2',
    timestamp: '17:33:45',
    pipelineId: 'bts-transtats',
    pipelineName: 'Telemetría OTP-15 (BTS)',
    level: 'warn',
    message: 'Fila 112.004 descartada: formato de hora de salida no conforme (9999).',
    detail: 'Almacenado en auditoría de descartes para verificación posterior.',
  },
  {
    id: 'log-3',
    timestamp: '17:32:00',
    pipelineId: 'bts-transtats',
    pipelineName: 'Telemetría OTP-15 (BTS)',
    level: 'info',
    message: 'Lote 81 procesado correctamente: 2.500 registros agregados a la base de datos.',
  },
  {
    id: 'log-4',
    timestamp: '04:15:22',
    pipelineId: 'ourairports',
    pipelineName: 'Catálogo de Aeropuertos',
    level: 'success',
    message: 'Sincronización semanal finalizada con éxito. 78.412 aeropuertos actualizados.',
    detail: 'Caché de consultas geoespaciales refrescada en Redis.',
  },
  {
    id: 'log-5',
    timestamp: 'Ayer 23:30',
    pipelineId: 'openflights',
    pipelineName: 'Red de Conexiones',
    level: 'success',
    message: 'Sincronización de rutas completada. 67.490 tramos listos para renderizado en Deck.gl.',
  },
];

export function useEtlMonitoring() {
  const pipelines = ref<EtlPipeline[]>(JSON.parse(JSON.stringify(initialPipelines)));
  const logs = ref<EtlLogEntry[]>([...initialLogs]);
  const isSimulationActive = ref(true);
  let tickerInterval: ReturnType<typeof setInterval> | null = null;

  // KPIs globales computados
  const globalMetrics = computed<EtlGlobalMetrics>(() => {
    let totalRecords = 0;
    let totalDiscarded = 0;
    let activeJobs = 0;

    for (const p of pipelines.value) {
      totalRecords += p.processedRows;
      totalDiscarded += p.discardedRows;
      if (p.status === 'running') {
        activeJobs++;
      }
    }

    const totalAttempted = totalRecords + totalDiscarded;
    const successRatePercent =
      totalAttempted > 0 ? Number(((totalRecords / totalAttempted) * 100).toFixed(2)) : 100;

    let systemHealth: EtlGlobalMetrics['systemHealth'] = 'optimal';
    if (activeJobs > 0) {
      systemHealth = 'syncing';
    }
    const hasErrors = pipelines.value.some((p) => p.status === 'error');
    if (hasErrors) {
      systemHealth = 'attention_needed';
    }

    return {
      totalAeroRecords: totalRecords,
      activeJobsCount: activeJobs,
      totalDiscardedCount: totalDiscarded,
      successRatePercent,
      systemHealth,
      lastGlobalSync: 'Hace pocos minutos',
    };
  });

  // Agregar una entrada de log estructurada
  function addLog(
    pipelineId: PipelineId,
    level: EtlLogEntry['level'],
    message: string,
    detail?: string
  ) {
    const pipeline = pipelines.value.find((p) => p.id === pipelineId);
    const now = new Date();
    const timeStr = now.toTimeString().split(' ')[0] ?? '12:00:00';

    logs.value.unshift({
      id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: timeStr,
      pipelineId,
      pipelineName: pipeline?.name ?? pipelineId,
      level,
      message,
      detail,
    });

    if (logs.value.length > 100) {
      logs.value.pop();
    }
  }

  // Disparar sincronización manual
  function triggerSync(options: TriggerSyncOptions) {
    const pipeline = pipelines.value.find((p) => p.id === options.pipelineId);
    if (!pipeline) return;

    pipeline.status = 'running';
    pipeline.progressPercent = 0;
    pipeline.processedRows = 0;
    pipeline.currentStepMessage = `Iniciando ingesta en modo ${options.mode === 'full' ? 'completo' : 'incremental'}...`;

    addLog(
      pipeline.id,
      'info',
      `Iniciada sincronización manual de "${pipeline.name}" (${options.mode === 'full' ? 'Recarga completa' : 'Incremental'}).`,
      `Tamaño de lote: ${options.batchSize} filas. Modo seguro: ${options.dryRun ? 'Sí' : 'No'}.`
    );
  }

  // Pausar pipeline
  function pausePipeline(id: PipelineId) {
    const pipeline = pipelines.value.find((p) => p.id === id);
    if (!pipeline || pipeline.status !== 'running') return;

    pipeline.status = 'paused';
    pipeline.currentStepMessage = 'Pausado por el operador. Los workers retendrán los lotes en cola.';
    addLog(pipeline.id, 'warn', `Ingesta pausada manualmente por el operador.`);
  }

  // Reanudar pipeline
  function resumePipeline(id: PipelineId) {
    const pipeline = pipelines.value.find((p) => p.id === id);
    if (!pipeline || pipeline.status !== 'paused') return;

    pipeline.status = 'running';
    pipeline.currentStepMessage = 'Reanudando ingesta de lotes asíncronos...';
    addLog(pipeline.id, 'info', `Ingesta reanudada por el operador.`);
  }

  // Reintentar fallidos
  function retryFailed(id: PipelineId) {
    const pipeline = pipelines.value.find((p) => p.id === id);
    if (!pipeline) return;

    pipeline.status = 'running';
    pipeline.currentStepMessage = 'Reintentando lotes con advertencia y registros corregidos...';
    addLog(
      pipeline.id,
      'info',
      `Reintento de registros iniciado para "${pipeline.name}".`
    );
  }

  // Sincronizar todos
  function syncAll() {
    pipelines.value.forEach((p) => {
      if (p.status !== 'running') {
        p.status = 'running';
        p.progressPercent = 0;
        p.processedRows = 0;
        p.currentStepMessage = 'Iniciando ingesta en lote...';
      }
    });
    addLog(
      'bts-transtats',
      'info',
      'Orden global emitida: Todas las fuentes aeronáuticas sincronizando en paralelo.'
    );
  }

  // Pausar todos los activos
  function pauseAll() {
    pipelines.value.forEach((p) => {
      if (p.status === 'running') {
        p.status = 'paused';
        p.currentStepMessage = 'Pausado por el operador.';
      }
    });
    addLog('bts-transtats', 'warn', 'Orden global emitida: Todas las ingestas activas han sido pausadas.');
  }

  // Limpiar feed de logs
  function clearLogs() {
    logs.value = [];
  }

  // Marcar registro descartado como resuelto
  function resolveDiscardedSample(pipelineId: PipelineId, recordId: string) {
    const pipeline = pipelines.value.find((p) => p.id === pipelineId);
    if (!pipeline) return;
    const sample = pipeline.discardedSamples.find((s) => s.id === recordId);
    if (sample) {
      sample.resolved = true;
      if (pipeline.discardedRows > 0) {
        pipeline.discardedRows--;
      }
      addLog(
        pipeline.id,
        'success',
        `Registro descartado #${sample.rowIndex} marcado como corregido y listo para reintento.`
      );
    }
  }

  // Ciclo de simulación suave para feedback visual en tiempo real
  function stepSimulation() {
    if (!isSimulationActive.value) return;

    for (const pipeline of pipelines.value) {
      if (pipeline.status === 'running') {
        const batchDelta = Math.floor(Math.random() * 800) + 1800;
        pipeline.processedRows = Math.min(
          pipeline.processedRows + batchDelta,
          pipeline.totalEstimatedRows
        );

        pipeline.progressPercent = Math.min(
          100,
          Math.round((pipeline.processedRows / pipeline.totalEstimatedRows) * 100)
        );

        if (pipeline.processedRows >= pipeline.totalEstimatedRows) {
          pipeline.status = 'success';
          pipeline.progressPercent = 100;
          pipeline.lastSyncAt = 'Hace un momento';
          pipeline.currentStepMessage = 'Al día — Ingesta completada con éxito.';
          addLog(
            pipeline.id,
            'success',
            `Pipeline "${pipeline.name}" finalizó con éxito (${pipeline.processedRows.toLocaleString()} registros importados).`
          );
        } else {
          pipeline.currentStepMessage = `Procesando lote: ${pipeline.processedRows.toLocaleString()} de ${pipeline.totalEstimatedRows.toLocaleString()} registros.`;
        }
      }
    }
  }

  onMounted(() => {
    tickerInterval = setInterval(stepSimulation, 3500);
  });

  onUnmounted(() => {
    if (tickerInterval) {
      clearInterval(tickerInterval);
      tickerInterval = null;
    }
  });

  return {
    pipelines,
    logs,
    globalMetrics,
    triggerSync,
    pausePipeline,
    resumePipeline,
    retryFailed,
    syncAll,
    pauseAll,
    clearLogs,
    resolveDiscardedSample,
  };
}
