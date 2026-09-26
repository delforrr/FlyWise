import { computed, onMounted, onUnmounted } from 'vue';
import type {
  EtlPipeline,
  PipelineId,
  EtlGlobalMetrics,
  EtlLogEntry,
  TriggerSyncOptions,
} from '../types/etl';
import { initialPipelines, initialLogs } from '../data/mockEtl';

// Module-level singleton state for simulation interval to avoid duplicate tickers across multiple callers
let tickerInterval: ReturnType<typeof setInterval> | null = null;
let activeSimulationStep: (() => void) | null = null;
let subscriberCount = 0;

function runSimulationTicker() {
  if (activeSimulationStep) {
    activeSimulationStep();
  }
}

export function useEtlMonitoring() {
  const toast = useToast();

  // Shared reactive state across components
  const pipelines = useState<EtlPipeline[]>('etl_pipelines', () =>
    JSON.parse(JSON.stringify(initialPipelines))
  );
  const logs = useState<EtlLogEntry[]>('etl_logs', () => [...initialLogs]);
  const isSimulationActive = useState<boolean>('etl_simulation_active', () => true);

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

  // Disparar sincronización manual (soporta TriggerSyncOptions o string PipelineId)
  function triggerSync(options: TriggerSyncOptions | PipelineId) {
    const pipelineId = typeof options === 'string' ? options : options.pipelineId;
    const mode = typeof options === 'string' ? 'incremental' : options.mode;
    const batchSize = typeof options === 'string' ? 2500 : options.batchSize;
    const dryRun = typeof options === 'string' ? false : options.dryRun;

    const pipeline = pipelines.value.find((p) => p.id === pipelineId);
    if (!pipeline) return;

    pipeline.status = 'running';
    pipeline.progressPercent = 0;
    pipeline.processedRows = 0;
    pipeline.currentStepMessage = `Iniciando ingesta en modo ${mode === 'full' ? 'completo' : 'incremental'}...`;

    addLog(
      pipeline.id,
      'info',
      `Iniciada sincronización manual de "${pipeline.name}" (${mode === 'full' ? 'Recarga completa' : 'Incremental'}).`,
      `Tamaño de lote: ${batchSize} filas. Modo seguro: ${dryRun ? 'Sí' : 'No'}.`
    );

    toast.add({
      title: 'Ingesta iniciada',
      description: `Iniciando ingesta para ${pipeline.name}`,
      color: 'info',
    });
  }

  // Pausar pipeline
  function pausePipeline(id: PipelineId) {
    const pipeline = pipelines.value.find((p) => p.id === id);
    if (!pipeline || pipeline.status !== 'running') return;

    pipeline.status = 'paused';
    pipeline.currentStepMessage = 'Pausado por el operador. Los workers retendrán los lotes en cola.';
    addLog(pipeline.id, 'warn', `Ingesta pausada manualmente por el operador.`);

    toast.add({
      title: 'Pipeline pausado',
      description: `Se pausó ${pipeline.name}`,
      color: 'warning',
    });
  }

  // Reanudar pipeline
  function resumePipeline(id: PipelineId) {
    const pipeline = pipelines.value.find((p) => p.id === id);
    if (!pipeline || pipeline.status !== 'paused') return;

    pipeline.status = 'running';
    pipeline.currentStepMessage = 'Reanudando ingesta de lotes asíncronos...';
    addLog(pipeline.id, 'info', `Ingesta reanudada por el operador.`);

    toast.add({
      title: 'Pipeline reanudado',
      description: `Se reanudó ${pipeline.name}`,
      color: 'success',
    });
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

    toast.add({
      title: 'Sincronización global iniciada',
      description: 'Todos los pipelines activos han comenzado a sincronizar',
      color: 'info',
    });
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

    toast.add({
      title: 'Ingestas pausadas',
      description: 'Se han pausado todos los pipelines',
      color: 'warning',
    });
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
    subscriberCount++;
    activeSimulationStep = stepSimulation;
    if (!tickerInterval && import.meta.client) {
      tickerInterval = setInterval(runSimulationTicker, 3500);
    }
  });

  onUnmounted(() => {
    subscriberCount = Math.max(0, subscriberCount - 1);
    if (subscriberCount === 0) {
      if (tickerInterval) {
        clearInterval(tickerInterval);
        tickerInterval = null;
      }
      activeSimulationStep = null;
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
