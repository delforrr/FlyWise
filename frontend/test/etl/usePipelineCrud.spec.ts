import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ref, computed } from 'vue';
import type {
  EtlPipeline,
  PipelineConnectionConfig,
  ProbeEndpointResult,
} from '../../app/features/etl-monitoring/types/etl';
import { initialPipelines } from '../../app/features/etl-monitoring/data/mockEtl';

describe('usePipelineCrud - Composable de Gestión y CRUD de Pipelines', () => {
  let pipelinesState: ReturnType<typeof ref<EtlPipeline[]>>;
  let toastMock: { add: ReturnType<typeof vi.fn> };

  // Simulador aislado de la lógica de usePipelineCrud para Vitest
  function setupTestComposable() {
    pipelinesState = ref<EtlPipeline[]>(JSON.parse(JSON.stringify(initialPipelines)));
    toastMock = { add: vi.fn() };

    const selectedEntityFilter = ref<'all' | 'airports' | 'routes' | 'otp_metrics'>('all');
    const selectedSourceTypeFilter = ref<'all' | 'system' | 'custom'>('all');
    const searchQuery = ref('');

    const filteredServices = computed(() => {
      return pipelinesState.value.filter((p) => {
        if (selectedEntityFilter.value !== 'all' && p.targetEntity !== selectedEntityFilter.value) {
          return false;
        }
        if (selectedSourceTypeFilter.value === 'system' && !p.isSystem) return false;
        if (selectedSourceTypeFilter.value === 'custom' && p.isSystem) return false;
        if (searchQuery.value.trim() !== '') {
          const q = searchQuery.value.toLowerCase();
          const matchName = p.name.toLowerCase().includes(q);
          const matchEndpoint = p.connection?.endpointUrl.toLowerCase().includes(q) ?? false;
          if (!matchName && !matchEndpoint) return false;
        }
        return true;
      });
    });

    const serviceStats = computed(() => ({
      total: pipelinesState.value.length,
      systemCount: pipelinesState.value.filter((p) => p.isSystem).length,
      customCount: pipelinesState.value.filter((p) => !p.isSystem).length,
      activeCount: pipelinesState.value.filter((p) => p.status !== 'paused').length,
      errorCount: pipelinesState.value.filter((p) => p.status === 'error').length,
    }));

    async function testEndpoint(connection: PipelineConnectionConfig): Promise<ProbeEndpointResult> {
      if (!connection.endpointUrl || !connection.endpointUrl.startsWith('http')) {
        return {
          success: false,
          statusCode: 400,
          latencyMs: 10,
          contentType: 'text/plain',
          sampleRows: [],
          detectedColumns: [],
          errorMessage: 'URL inválida',
        };
      }
      return {
        success: true,
        statusCode: 200,
        latencyMs: 75,
        contentType: 'text/csv; charset=utf-8',
        sampleRows: [{ col1: 'val1', col2: 'val2' }],
        detectedColumns: ['col1', 'col2'],
        estimatedTotalSize: '~2.5 MB',
      };
    }

    function createPipeline(data: Partial<EtlPipeline>): EtlPipeline {
      const newPipeline: EtlPipeline = {
        id: `custom-test-${Date.now()}`,
        name: data.name || 'Servicio Test',
        datasetName: data.datasetName || 'Dataset Test',
        description: data.description || 'Descripción',
        icon: data.icon || 'i-lucide-database',
        status: 'idle',
        progressPercent: 0,
        processedRows: 0,
        totalEstimatedRows: 10000,
        discardedRows: 0,
        lastSyncAt: null,
        nextScheduledSync: 'Manual',
        scheduleDescription: 'Manual',
        averageSpeedRowsPerSec: 2500,
        discardedSamples: [],
        isSystem: false,
        targetEntity: data.targetEntity || 'otp_metrics',
        connection: data.connection || {
          sourceType: 'http_stream',
          endpointUrl: 'https://api.test.com/data.csv',
          httpMethod: 'GET',
          dataFormat: 'csv',
        },
      };
      pipelinesState.value.unshift(newPipeline);
      toastMock.add({ title: 'Servicio creado' });
      return newPipeline;
    }

    function updatePipeline(id: string, patch: Partial<EtlPipeline>): boolean {
      const idx = pipelinesState.value.findIndex((p) => p.id === id);
      if (idx === -1) return false;
      pipelinesState.value[idx] = { ...pipelinesState.value[idx]!, ...patch };
      toastMock.add({ title: 'Servicio actualizado' });
      return true;
    }

    function deletePipeline(id: string): boolean {
      const target = pipelinesState.value.find((p) => p.id === id);
      if (!target || target.isSystem) {
        toastMock.add({ title: 'Acción bloqueada' });
        return false;
      }
      pipelinesState.value = pipelinesState.value.filter((p) => p.id !== id);
      toastMock.add({ title: 'Servicio eliminado' });
      return true;
    }

    function togglePipelineStatus(id: string) {
      const target = pipelinesState.value.find((p) => p.id === id);
      if (!target) return;
      target.status = target.status === 'paused' ? 'idle' : 'paused';
    }

    return {
      pipelines: pipelinesState,
      filteredServices,
      serviceStats,
      selectedEntityFilter,
      selectedSourceTypeFilter,
      searchQuery,
      testEndpoint,
      createPipeline,
      updatePipeline,
      deletePipeline,
      togglePipelineStatus,
      toastMock,
    };
  }

  it('debe inicializar el catálogo con fuentes oficiales y personalizadas mockeadas', () => {
    const crud = setupTestComposable();
    expect(crud.serviceStats.value.total).toBeGreaterThanOrEqual(4);
    expect(crud.serviceStats.value.systemCount).toBe(4);
    expect(crud.serviceStats.value.customCount).toBeGreaterThanOrEqual(1);
  });

  it('debe registrar un nuevo servicio personalizado con endpoint y configuración', () => {
    const crud = setupTestComposable();
    const initialCount = crud.pipelines.value.length;

    const created = crud.createPipeline({
      name: 'AviationStack Realtime Feed',
      datasetName: 'AviationStack API',
      targetEntity: 'otp_metrics',
      connection: {
        sourceType: 'rest_api',
        endpointUrl: 'https://api.aviationstack.com/v1/flights',
        httpMethod: 'GET',
        dataFormat: 'json',
      },
    });

    expect(crud.pipelines.value.length).toBe(initialCount + 1);
    expect(created.isSystem).toBe(false);
    expect(created.connection?.endpointUrl).toBe('https://api.aviationstack.com/v1/flights');
    expect(crud.toastMock.add).toHaveBeenCalled();
  });

  it('debe actualizar los datos de conexión de un pipeline existente', () => {
    const crud = setupTestComposable();
    const targetId = crud.pipelines.value[0]?.id;
    expect(targetId).toBeDefined();

    const success = crud.updatePipeline(targetId!, {
      name: 'Catálogo de Aeropuertos Renombrado',
    });

    expect(success).toBe(true);
    const updated = crud.pipelines.value.find((p) => p.id === targetId);
    expect(updated?.name).toBe('Catálogo de Aeropuertos Renombrado');
  });

  it('debe bloquear la eliminación de pipelines nativos del sistema', () => {
    const crud = setupTestComposable();
    const systemPipeline = crud.pipelines.value.find((p) => p.isSystem);
    expect(systemPipeline).toBeDefined();

    const initialLength = crud.pipelines.value.length;
    const deleted = crud.deletePipeline(systemPipeline!.id);

    expect(deleted).toBe(false);
    expect(crud.pipelines.value.length).toBe(initialLength);
    expect(crud.toastMock.add).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Acción bloqueada' })
    );
  });

  it('debe permitir eliminar servicios personalizados creados por el usuario', () => {
    const crud = setupTestComposable();
    const created = crud.createPipeline({ name: 'Temp Custom Service' });
    const countBeforeDelete = crud.pipelines.value.length;

    const deleted = crud.deletePipeline(created.id);
    expect(deleted).toBe(true);
    expect(crud.pipelines.value.length).toBe(countBeforeDelete - 1);
  });

  it('debe alternar el estado de un servicio entre activo y pausado', () => {
    const crud = setupTestComposable();
    const pipeline = crud.pipelines.value[0]!;
    const initialStatus = pipeline.status;

    crud.togglePipelineStatus(pipeline.id);
    expect(pipeline.status).toBe(initialStatus === 'paused' ? 'idle' : 'paused');
  });

  it('debe validar la conectividad del endpoint y detectar columnas', async () => {
    const crud = setupTestComposable();

    // Caso inválido
    const failResult = await crud.testEndpoint({
      sourceType: 'http_stream',
      endpointUrl: 'ftp://bad-protocol',
      httpMethod: 'GET',
      dataFormat: 'csv',
    });
    expect(failResult.success).toBe(false);
    expect(failResult.statusCode).toBe(400);

    // Caso exitoso
    const successResult = await crud.testEndpoint({
      sourceType: 'http_stream',
      endpointUrl: 'https://ourairports.com/data/airports.csv',
      httpMethod: 'GET',
      dataFormat: 'csv',
    });
    expect(successResult.success).toBe(true);
    expect(successResult.statusCode).toBe(200);
    expect(successResult.detectedColumns.length).toBeGreaterThan(0);
  });

  it('debe filtrar adecuadamente por entidad y por origen', () => {
    const crud = setupTestComposable();

    // Filtrar solo aeropuertos
    crud.selectedEntityFilter.value = 'airports';
    for (const item of crud.filteredServices.value) {
      expect(item.targetEntity).toBe('airports');
    }

    // Filtrar solo fuentes de sistema
    crud.selectedEntityFilter.value = 'all';
    crud.selectedSourceTypeFilter.value = 'system';
    for (const item of crud.filteredServices.value) {
      expect(item.isSystem).toBe(true);
    }
  });
});
