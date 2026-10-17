import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  usePipelineCrud,
  validatePipeline,
} from '../../app/features/etl-monitoring/composables/usePipelineCrud';
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

  it('debe validar estrictamente los datos de ingreso de un pipeline con validatePipeline()', () => {
    // 1. Objeto completamente vacío
    const emptyResult = validatePipeline({});
    expect(emptyResult.isValid).toBe(false);
    expect(emptyResult.errors.name).toBeDefined();
    expect(emptyResult.errors.datasetName).toBeDefined();
    expect(emptyResult.errors.endpointUrl).toBeDefined();
    expect(emptyResult.errors.schemaMapping).toBeDefined();

    // 2. Nombre o dataset demasiado cortos
    const shortResult = validatePipeline({
      name: 'ab',
      datasetName: 'x',
      connection: {
        sourceType: 'http_stream',
        endpointUrl: 'https://valid-url.com/feed.csv',
        httpMethod: 'GET',
        dataFormat: 'csv',
      },
    });
    expect(shortResult.isValid).toBe(false);
    expect(shortResult.errors.name).toContain('al menos 3 caracteres');
    expect(shortResult.errors.datasetName).toContain('al menos 2 caracteres');

    // 3. URL inválida o sin protocolo http/https
    const badUrlResult = validatePipeline({
      name: 'Servicio Valido',
      datasetName: 'Dataset Valido',
      connection: {
        sourceType: 'http_stream',
        endpointUrl: 'ftp://invalido.com',
        httpMethod: 'GET',
        dataFormat: 'csv',
      },
    });
    expect(badUrlResult.isValid).toBe(false);
    expect(badUrlResult.errors.endpointUrl).toContain('http:// o https://');

    // 4. Faltan campos requeridos en el mapeo para airports
    const missingMappingResult = validatePipeline({
      name: 'Catálogo Aeropuertos',
      datasetName: 'OurAirports',
      targetEntity: 'airports',
      connection: {
        sourceType: 'http_stream',
        endpointUrl: 'https://ourairports.com/data.csv',
        httpMethod: 'GET',
        dataFormat: 'csv',
      },
      schemaMapping: [
        { sourceColumn: 'ident', targetField: 'icaoCode', required: true },
        // faltan name, latitude, longitude
      ],
    });
    expect(missingMappingResult.isValid).toBe(false);
    expect(missingMappingResult.errors.schemaMapping).toContain('Faltan mapear los siguientes campos requeridos');

    // 5. Mapeo completo y válido para airports
    const validAirportsResult = validatePipeline({
      name: 'Catálogo Aeropuertos Completo',
      datasetName: 'OurAirports',
      targetEntity: 'airports',
      connection: {
        sourceType: 'http_stream',
        endpointUrl: 'https://ourairports.com/airports.csv',
        httpMethod: 'GET',
        dataFormat: 'csv',
        csvDelimiter: ',',
      },
      schemaMapping: [
        { sourceColumn: 'ident', targetField: 'icaoCode', required: true },
        { sourceColumn: 'name', targetField: 'name', required: true },
        { sourceColumn: 'latitude_deg', targetField: 'latitude', required: true },
        { sourceColumn: 'longitude_deg', targetField: 'longitude', required: true },
      ],
    });
    expect(validAirportsResult.isValid).toBe(true);
    expect(Object.keys(validAirportsResult.errors).length).toBe(0);

    // 6. Cron personalizado inválido
    const badCronResult = validatePipeline({
      name: 'Servicio Cron',
      datasetName: 'Dataset Cron',
      targetEntity: 'otp_metrics',
      connection: {
        sourceType: 'rest_api',
        endpointUrl: 'https://api.vuelos.com/feed.json',
        httpMethod: 'GET',
        dataFormat: 'json',
      },
      schemaMapping: [
        { sourceColumn: 'flight', targetField: 'flightId', required: true },
        { sourceColumn: 'orig', targetField: 'originId', required: true },
        { sourceColumn: 'dest', targetField: 'destinationId', required: true },
        { sourceColumn: 'airline', targetField: 'airlineId', required: true },
        { sourceColumn: 'arr_delay', targetField: 'delayMinutes', required: true },
      ],
      scheduleConfig: {
        cronPreset: 'custom',
        cronExpression: '0 4 *', // solo 3 campos en vez de 5
        scheduleDescription: 'Custom',
        batchSize: 2500,
        concurrency: 4,
        timeoutSeconds: 300,
        maxRetries: 3,
      },
    });
    expect(badCronResult.isValid).toBe(false);
    expect(badCronResult.errors.cronExpression).toContain('5 campos');
  });

  it('debe impedir la creación de pipelines con nombre vacío o URL vacía en createPipeline()', () => {
    const crud = usePipelineCrud();

    expect(() => {
      crud.createPipeline({ name: '' });
    }).toThrow('El nombre del servicio es obligatorio');

    expect(() => {
      crud.createPipeline({ name: '   ' });
    }).toThrow('El nombre del servicio es obligatorio');

    expect(() => {
      crud.createPipeline({
        name: 'Servicio con URL vacía',
        connection: {
          endpointUrl: '',
          sourceType: 'http_stream',
          httpMethod: 'GET',
          dataFormat: 'csv',
        },
      });
    }).toThrow('La URL del endpoint no puede estar vacía');
  });

  it('debe permitir pausar y reanudar servicios de forma explícita con pausePipeline() y resumePipeline()', () => {
    const crud = usePipelineCrud();
    const target = crud.pipelines.value[0]!;
    target.status = 'idle';

    // 1. Pausar
    const pauseSuccess = crud.pausePipeline(target.id);
    expect(pauseSuccess).toBe(true);
    expect(target.status).toBe('paused');
    expect(target.currentStepMessage).toContain('pausado');

    // 2. Reanudar
    const resumeSuccess = crud.resumePipeline(target.id);
    expect(resumeSuccess).toBe(true);
    expect(target.status).toBe('idle');
    expect(target.currentStepMessage).toContain('reactivado');

    // 3. ID inexistente retorna false
    expect(crud.pausePipeline('id-fantasma' as any)).toBe(false);
    expect(crud.resumePipeline('id-fantasma' as any)).toBe(false);
  });
});
