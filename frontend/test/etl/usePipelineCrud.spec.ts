import { describe, it, expect, vi, beforeEach } from 'vitest';
import { usePipelineCrud } from '../../app/features/etl-monitoring/composables/usePipelineCrud';
import type { PipelineConnectionConfig } from '../../app/features/etl-monitoring/types/etl';

describe('usePipelineCrud — Composable Real de Gestión y CRUD de Pipelines', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('debe inicializar el catálogo con fuentes oficiales y personalizadas', () => {
    const crud = usePipelineCrud();
    expect(crud.serviceStats.value.total).toBeGreaterThanOrEqual(4);
    expect(crud.serviceStats.value.systemCount).toBe(4);
    expect(crud.serviceStats.value.customCount).toBeGreaterThanOrEqual(1);
    expect(crud.serviceStats.value.activeCount).toBeGreaterThan(0);
  });

  it('debe registrar un nuevo servicio personalizado con endpoint y configuración', () => {
    const crud = usePipelineCrud();
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
    expect(created.name).toBe('AviationStack Realtime Feed');
    expect(created.connection?.endpointUrl).toBe('https://api.aviationstack.com/v1/flights');
    expect(crud.pipelines.value[0].id).toBe(created.id);
  });

  it('debe actualizar los datos de configuración de un pipeline existente', () => {
    const crud = usePipelineCrud();
    const targetId = crud.pipelines.value[0]?.id;
    expect(targetId).toBeDefined();

    const success = crud.updatePipeline(targetId!, {
      name: 'Catálogo de Aeropuertos Renombrado',
    });

    expect(success).toBe(true);
    const updated = crud.pipelines.value.find((p) => p.id === targetId);
    expect(updated?.name).toBe('Catálogo de Aeropuertos Renombrado');

    // Retorna false si el id no existe
    const fail = crud.updatePipeline('non-existent-id' as any, { name: 'X' });
    expect(fail).toBe(false);
  });

  it('debe bloquear la eliminación de pipelines nativos del sistema', () => {
    const crud = usePipelineCrud();
    const systemPipeline = crud.pipelines.value.find((p) => p.isSystem);
    expect(systemPipeline).toBeDefined();

    const initialLength = crud.pipelines.value.length;
    const deleted = crud.deletePipeline(systemPipeline!.id);

    expect(deleted).toBe(false);
    expect(crud.pipelines.value.length).toBe(initialLength);
  });

  it('debe permitir eliminar servicios personalizados creados por el usuario', () => {
    const crud = usePipelineCrud();
    const created = crud.createPipeline({ name: 'Temp Custom Service' });
    const countBeforeDelete = crud.pipelines.value.length;

    const deleted = crud.deletePipeline(created.id);
    expect(deleted).toBe(true);
    expect(crud.pipelines.value.length).toBe(countBeforeDelete - 1);

    // Retorna false si no existe
    expect(crud.deletePipeline('non-existent' as any)).toBe(false);
  });

  it('debe duplicar un pipeline existente asignando sufijo (Copia) y marcándolo como no-sistema', () => {
    const crud = usePipelineCrud();
    const target = crud.pipelines.value[0]!;
    const duplicated = crud.duplicatePipeline(target.id);

    expect(duplicated).not.toBeNull();
    expect(duplicated?.name).toBe(`${target.name} (Copia)`);
    expect(duplicated?.isSystem).toBe(false);
    expect(crud.pipelines.value.some((p) => p.id === duplicated?.id)).toBe(true);

    // Retorna null si el id no existe
    expect(crud.duplicatePipeline('invalid-id' as any)).toBeNull();
  });

  it('debe alternar el estado de un servicio entre activo y pausado', () => {
    const crud = usePipelineCrud();
    const pipeline = crud.pipelines.value[0]!;
    pipeline.status = 'idle';

    crud.togglePipelineStatus(pipeline.id);
    expect(pipeline.status).toBe('paused');

    // Alternar de vuelta
    crud.togglePipelineStatus(pipeline.id);
    expect(pipeline.status).toBe('idle');

    // No lanza error si el id no existe
    expect(() => crud.togglePipelineStatus('inexistente' as any)).not.toThrow();
  });

  it('debe restaurar el catálogo a los valores iniciales con resetToDefaults()', () => {
    const crud = usePipelineCrud();
    crud.createPipeline({ name: 'Disposable Service' });
    expect(crud.pipelines.value.some((p) => p.name === 'Disposable Service')).toBe(true);

    crud.resetToDefaults();
    expect(crud.pipelines.value.some((p) => p.name === 'Disposable Service')).toBe(false);
  });

  it('debe validar la conectividad del endpoint y detectar columnas con testEndpoint()', async () => {
    const crud = usePipelineCrud();

    // Caso inválido: URL sin http
    const failResult = await crud.testEndpoint(
      {
        sourceType: 'http_stream',
        endpointUrl: 'ftp://bad-protocol',
        httpMethod: 'GET',
        dataFormat: 'csv',
      },
      0
    );
    expect(failResult.success).toBe(false);
    expect(failResult.statusCode).toBe(400);
    expect(failResult.errorMessage).toContain('URL inválida');

    // Caso exitoso con CSV
    const csvResult = await crud.testEndpoint(
      {
        sourceType: 'http_stream',
        endpointUrl: 'https://ourairports.com/data/airports.csv',
        httpMethod: 'GET',
        dataFormat: 'csv',
      },
      0
    );
    expect(csvResult.success).toBe(true);
    expect(csvResult.statusCode).toBe(200);
    expect(csvResult.contentType).toContain('csv');
    expect(csvResult.detectedColumns.length).toBeGreaterThan(0);

    // Caso exitoso con JSON
    const jsonResult = await crud.testEndpoint(
      {
        sourceType: 'rest_api',
        endpointUrl: 'https://api.aviation.org/data',
        httpMethod: 'GET',
        dataFormat: 'json',
      },
      0
    );
    expect(jsonResult.success).toBe(true);
    expect(jsonResult.contentType).toContain('json');
  });

  it('debe filtrar adecuadamente por entidad, origen y búsqueda de texto', () => {
    const crud = usePipelineCrud();

    // 1. Filtrar solo aeropuertos
    crud.selectedEntityFilter.value = 'airports';
    for (const item of crud.filteredServices.value) {
      expect(item.targetEntity).toBe('airports');
    }

    // 2. Filtrar solo fuentes de sistema
    crud.selectedEntityFilter.value = 'all';
    crud.selectedSourceTypeFilter.value = 'system';
    for (const item of crud.filteredServices.value) {
      expect(item.isSystem).toBe(true);
    }

    // 3. Filtrar solo fuentes personalizadas
    crud.selectedSourceTypeFilter.value = 'custom';
    for (const item of crud.filteredServices.value) {
      expect(item.isSystem).toBe(false);
    }

    // 4. Búsqueda por texto en nombre
    crud.selectedSourceTypeFilter.value = 'all';
    crud.searchQuery.value = 'ourairports';
    expect(crud.filteredServices.value.length).toBeGreaterThan(0);
    for (const item of crud.filteredServices.value) {
      const match =
        item.name.toLowerCase().includes('ourairports') ||
        item.datasetName.toLowerCase().includes('ourairports') ||
        item.description.toLowerCase().includes('ourairports') ||
        (item.connection?.endpointUrl.toLowerCase().includes('ourairports') ?? false);
      expect(match).toBe(true);
    }
  });
});
