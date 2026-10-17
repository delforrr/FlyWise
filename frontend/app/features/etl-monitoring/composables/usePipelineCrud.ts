import { ref, computed } from 'vue';
import type {
  EtlPipeline,
  PipelineId,
  PipelineConnectionConfig,
  ProbeEndpointResult,
  TargetEntity,
  FieldMappingRule,
} from '../types/etl';
import { TARGET_FIELDS_CATALOG } from '../types/etl';
import { initialPipelines } from '../data/mockEtl';
import { pipelineSchema } from '../schemas/pipelineSchemas';

export interface PipelineValidationResult {
  isValid: boolean;
  errors: Record<string, string>;
}

export function validatePipeline(data: Partial<EtlPipeline>): PipelineValidationResult {
  const result = pipelineSchema.safeParse(data);
  if (result.success) {
    return {
      isValid: true,
      errors: {},
    };
  }

  const errors: Record<string, string> = {};
  for (const issue of result.error.issues) {
    const key = issue.path[0] ? String(issue.path[0]) : 'general';
    if (!errors[key]) {
      errors[key] = issue.message;
    }
  }

  return {
    isValid: false,
    errors,
  };
}

export function usePipelineCrud() {
  const toast = useToast();

  // Compartir el estado reactivo global con useEtlMonitoring
  const pipelines = useState<EtlPipeline[]>('etl_pipelines', () =>
    JSON.parse(JSON.stringify(initialPipelines))
  );

  const isTestingEndpoint = ref(false);
  const lastProbeResult = ref<ProbeEndpointResult | null>(null);

  // Filtros reactivos para la vista CRUD
  const selectedEntityFilter = ref<'all' | TargetEntity>('all');
  const selectedSourceTypeFilter = ref<'all' | 'system' | 'custom'>('all');
  const searchQuery = ref('');

  const filteredServices = computed(() => {
    return pipelines.value.filter((p) => {
      // Filtro por entidad
      if (selectedEntityFilter.value !== 'all') {
        if (p.targetEntity !== selectedEntityFilter.value) return false;
      }

      // Filtro por origen (Sistema vs Personalizado)
      if (selectedSourceTypeFilter.value === 'system' && !p.isSystem) return false;
      if (selectedSourceTypeFilter.value === 'custom' && p.isSystem) return false;

      // Filtro de búsqueda textual
      if (searchQuery.value.trim() !== '') {
        const q = searchQuery.value.toLowerCase();
        const matchName = p.name.toLowerCase().includes(q);
        const matchDataset = p.datasetName.toLowerCase().includes(q);
        const matchEndpoint = p.connection?.endpointUrl.toLowerCase().includes(q) ?? false;
        const matchDesc = p.description.toLowerCase().includes(q);
        if (!matchName && !matchDataset && !matchEndpoint && !matchDesc) return false;
      }

      return true;
    });
  });

  const serviceStats = computed(() => {
    const total = pipelines.value.length;
    const systemCount = pipelines.value.filter((p) => p.isSystem).length;
    const customCount = pipelines.value.filter((p) => !p.isSystem).length;
    const activeCount = pipelines.value.filter((p) => p.status !== 'paused').length;
    const errorCount = pipelines.value.filter((p) => p.status === 'error').length;

    return {
      total,
      systemCount,
      customCount,
      activeCount,
      errorCount,
    };
  });

  // 1. Probar Conexión al Endpoint (Probe & Ping)
  async function testEndpoint(connection: PipelineConnectionConfig, simulatedDelayMs = 600): Promise<ProbeEndpointResult> {
    isTestingEndpoint.value = true;
    lastProbeResult.value = null;

    // Simulación reactiva realista con latencia de red
    const startTime = performance.now();
    if (simulatedDelayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, simulatedDelayMs));
    }
    const latencyMs = Math.round(performance.now() - startTime);

    if (!connection.endpointUrl || !connection.endpointUrl.startsWith('http')) {
      const errorResult: ProbeEndpointResult = {
        success: false,
        statusCode: 400,
        latencyMs: 12,
        contentType: 'text/plain',
        sampleRows: [],
        detectedColumns: [],
        errorMessage: 'URL inválida. Debe comenzar con http:// o https://',
      };
      lastProbeResult.value = errorResult;
      isTestingEndpoint.value = false;
      return errorResult;
    }

    // Generar columnas de muestra según formato y entidad
    const isCsv = connection.dataFormat === 'csv';
    const sampleRows = isCsv
      ? [
          { col_0: 'AAL102', col_1: 'KJFK', col_2: 'KLAX', col_3: '14:20', col_4: '14:32', col_5: '12' },
          { col_0: 'DAL450', col_1: 'KORD', col_2: 'KMIA', col_3: '09:15', col_4: '09:10', col_5: '-5' },
          { col_0: 'UAL789', col_1: 'EGLL', col_2: 'LEMD', col_3: '18:00', col_4: '18:45', col_5: '45' },
        ]
      : [
          { flightId: 'AFR006', origin: 'LFPG', dest: 'KJFK', schedTime: '13:50', delayMin: 0 },
          { flightId: 'IBE310', origin: 'LEMD', dest: 'SAEZ', schedTime: '23:55', delayMin: 18 },
        ];

    const detectedColumns = isCsv
      ? ['flight_id', 'origin_airport', 'dest_airport', 'sched_dep', 'act_dep', 'delay_minutes']
      : ['flightId', 'origin', 'dest', 'schedTime', 'delayMin'];

    const result: ProbeEndpointResult = {
      success: true,
      statusCode: 200,
      latencyMs: latencyMs || 84,
      contentType: isCsv ? 'text/csv; charset=utf-8' : 'application/json; charset=utf-8',
      sampleRows,
      detectedColumns,
      estimatedTotalSize: isCsv ? '~3.8 MB (~48.000 filas)' : '~1.2 MB (~12.500 registros)',
    };

    lastProbeResult.value = result;
    isTestingEndpoint.value = false;
    return result;
  }

  // 2. Crear Nuevo Pipeline
  function createPipeline(data: Partial<EtlPipeline>): EtlPipeline {
    if (data.name !== undefined && !data.name.trim()) {
      throw new Error('El nombre del servicio es obligatorio.');
    }
    if (data.connection?.endpointUrl !== undefined && !data.connection.endpointUrl.trim()) {
      throw new Error('La URL del endpoint no puede estar vacía.');
    }

    const slug = data.name
      ? data.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
      : `pipeline-${Date.now()}`;
    const newId = `custom-${slug}-${Math.random().toString(36).slice(2, 6)}`;

    const newPipeline: EtlPipeline = {
      id: newId,
      name: data.name || 'Servicio de Ingesta Personalizado',
      datasetName: data.datasetName || 'Dataset Externo',
      description: data.description || 'Pipeline personalizado de ingesta aeronáutica.',
      icon: data.icon || 'i-lucide-database',
      status: 'idle',
      progressPercent: 0,
      processedRows: 0,
      totalEstimatedRows: data.totalEstimatedRows || 50000,
      discardedRows: 0,
      lastSyncAt: null,
      nextScheduledSync: data.scheduleConfig?.scheduleDescription || 'Manual / A demanda',
      scheduleDescription: data.scheduleConfig?.scheduleDescription || 'Manual',
      averageSpeedRowsPerSec: 2500,
      currentStepMessage: 'Servicio configurado y listo para sincronización.',
      discardedSamples: [],
      isSystem: false,
      targetEntity: data.targetEntity || 'otp_metrics',
      connection: data.connection || {
        sourceType: 'http_stream',
        endpointUrl: 'https://api.aero-source.org/feed.csv',
        httpMethod: 'GET',
        dataFormat: 'csv',
        csvDelimiter: ',',
        csvHasHeader: true,
      },
      schemaMapping: data.schemaMapping || [],
      scheduleConfig: data.scheduleConfig || {
        cronPreset: 'daily',
        cronExpression: '0 4 * * *',
        scheduleDescription: 'Diario (04:00 UTC)',
        batchSize: 2500,
        concurrency: 4,
        timeoutSeconds: 300,
        maxRetries: 3,
      },
    };

    pipelines.value.unshift(newPipeline);

    toast.add({
      title: 'Servicio creado con éxito',
      description: `"${newPipeline.name}" se registró correctamente en el catálogo ETL.`,
      color: 'success',
      icon: 'i-lucide-check-circle-2',
    });

    return newPipeline;
  }

  // 3. Actualizar Pipeline Existente
  function updatePipeline(id: PipelineId, patch: Partial<EtlPipeline>): boolean {
    const index = pipelines.value.findIndex((p) => p.id === id);
    if (index === -1) return false;

    const existing = pipelines.value[index]!;
    pipelines.value[index] = {
      ...existing,
      ...patch,
      connection: {
        ...existing.connection,
        ...patch.connection,
      } as any,
      scheduleConfig: {
        ...existing.scheduleConfig,
        ...patch.scheduleConfig,
      } as any,
    };

    toast.add({
      title: 'Servicio actualizado',
      description: `La configuración de "${existing.name}" ha sido guardada.`,
      color: 'info',
      icon: 'i-lucide-check',
    });

    return true;
  }

  // 4. Eliminar Pipeline Personalizado (Protección: Prohibido eliminar del sistema)
  function deletePipeline(id: PipelineId): boolean {
    const target = pipelines.value.find((p) => p.id === id);
    if (!target) return false;

    if (target.isSystem) {
      toast.add({
        title: 'Acción bloqueada',
        description: 'Los pipelines nativos del sistema no pueden ser eliminados.',
        color: 'error',
        icon: 'i-lucide-shield-alert',
      });
      return false;
    }

    pipelines.value = pipelines.value.filter((p) => p.id !== id);

    toast.add({
      title: 'Servicio eliminado',
      description: `"${target.name}" ha sido removido del catálogo de ingesta.`,
      color: 'neutral',
      icon: 'i-lucide-trash-2',
    });

    return true;
  }

  // 5. Duplicar Pipeline
  function duplicatePipeline(id: PipelineId): EtlPipeline | null {
    const source = pipelines.value.find((p) => p.id === id);
    if (!source) return null;

    const copyData: Partial<EtlPipeline> = {
      ...JSON.parse(JSON.stringify(source)),
      name: `${source.name} (Copia)`,
      isSystem: false,
    };

    return createPipeline(copyData);
  }

  // 6. Pausar Pipeline
  function pausePipeline(id: PipelineId): boolean {
    const pipeline = pipelines.value.find((p) => p.id === id);
    if (!pipeline) return false;

    if (pipeline.status !== 'paused') {
      pipeline.status = 'paused';
      pipeline.currentStepMessage = 'Servicio pausado manualmente por el operador.';
      toast.add({
        title: 'Servicio pausado',
        description: `Se han congelado las ejecuciones automáticas de "${pipeline.name}".`,
        color: 'warning',
      });
    }
    return true;
  }

  // 7. Reanudar Pipeline
  function resumePipeline(id: PipelineId): boolean {
    const pipeline = pipelines.value.find((p) => p.id === id);
    if (!pipeline) return false;

    if (pipeline.status === 'paused') {
      pipeline.status = 'idle';
      pipeline.currentStepMessage = 'Servicio reactivado — Listo para sincronización.';
      toast.add({
        title: 'Servicio reactivado',
        description: `"${pipeline.name}" volverá a ejecutarse según su cronograma.`,
        color: 'success',
      });
    }
    return true;
  }

  // 8. Alternar Estado (Pausar / Reanudar)
  function togglePipelineStatus(id: PipelineId) {
    const pipeline = pipelines.value.find((p) => p.id === id);
    if (!pipeline) return;

    if (pipeline.status === 'paused') {
      resumePipeline(id);
    } else {
      pausePipeline(id);
    }
  }

  // 9. Restaurar Catálogo a Valores Predeterminados
  function resetToDefaults() {
    pipelines.value = JSON.parse(JSON.stringify(initialPipelines));
    toast.add({
      title: 'Catálogo restaurado',
      description: 'Se han restablecido los servicios predeterminados.',
      color: 'neutral',
    });
  }

  return {
    pipelines,
    filteredServices,
    serviceStats,
    selectedEntityFilter,
    selectedSourceTypeFilter,
    searchQuery,
    isTestingEndpoint,
    lastProbeResult,
    testEndpoint,
    createPipeline,
    updatePipeline,
    deletePipeline,
    duplicatePipeline,
    pausePipeline,
    resumePipeline,
    togglePipelineStatus,
    validatePipeline,
    resetToDefaults,
  };
}
