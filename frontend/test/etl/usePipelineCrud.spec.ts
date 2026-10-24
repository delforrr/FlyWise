import { describe, it, expect, vi, beforeEach } from 'vitest';
import { validatePipeline, usePipelineCrud } from '../../app/features/etl-monitoring/composables/usePipelineCrud';
import { useEtlData } from '../../app/features/etl-monitoring/composables/useEtlData';
import type { StoredPipeline } from '../../app/features/etl-monitoring/types/etl';

const stored: StoredPipeline = { id: 'pipeline-1', name: 'Airports', datasetName: 'OpenFlights', description: '', targetEntity: 'airports', isSystem: false, paused: false, connection: { sourceType: 'http_stream', endpointUrl: 'https://raw.githubusercontent.com/data', httpMethod: 'GET', dataFormat: 'csv' }, schemaMapping: ['openflightsId', 'name', 'latitude', 'longitude'].map((targetField, i) => ({ sourceColumn: String(i), targetField })), scheduleConfig: { cronExpression: '', batchSize: 2000, timeoutSeconds: 300, maxRetries: 2 } };
const fetcher = vi.fn();
beforeEach(() => {
  fetcher.mockReset();
  fetcher.mockImplementation(async (url: string) => url === '/api/etl/pipelines' ? [stored] : []);
  vi.stubGlobal('$fetch', fetcher);
});
describe('Persisted pipeline CRUD', () => {
  it('validates the current catalogue fields without requiring optional IATA or ICAO codes', () => {
    expect(validatePipeline(stored).isValid).toBe(true);
    expect(validatePipeline({ ...stored, name: '' }).errors).toHaveProperty('name');
    expect(validatePipeline({ ...stored, schemaMapping: [] }).errors).toHaveProperty('schemaMapping');
  });
  it('starts empty and loads actual configurations instead of fixtures', async () => {
    const crud = usePipelineCrud();
    expect(crud.pipelines.value).toEqual([]);
    await useEtlData().refresh();
    expect(crud.serviceStats.value).toMatchObject({ total: 1, customCount: 1 });
    expect(crud.pipelines.value[0]?.processedRows).toBe(0);
  });
  it('sends supported configuration fields and refreshes server state after creating', async () => {
    const crud = usePipelineCrud();
    await crud.createPipeline({ ...stored, icon: 'presentation-only' });
    const call = fetcher.mock.calls.find(([, options]) => options?.method === 'POST');
    expect(call?.[0]).toBe('/api/etl/pipelines');
    expect(call?.[1].body).not.toHaveProperty('icon');
    expect(call?.[1].body.scheduleConfig).toEqual(stored.scheduleConfig);
    expect(crud.pipelines.value).toHaveLength(1);
  });
  it('uses a real probe response and clears loading state on network failures', async () => {
    const crud = usePipelineCrud();
    const result = { success: true, statusCode: 200, latencyMs: 4, contentType: 'text/csv', sampleRows: [{ '0': '42' }], detectedColumns: ['0'] };
    fetcher.mockResolvedValueOnce(result);
    expect(await crud.testEndpoint(stored.connection!)).toEqual(result);
    fetcher.mockRejectedValueOnce(new Error('offline'));
    await expect(crud.testEndpoint(stored.connection!)).rejects.toThrow('offline');
    expect(crud.isTestingEndpoint.value).toBe(false);
  });
  it('updates, pauses and archives through the API', async () => {
    await useEtlData().refresh(); const crud = usePipelineCrud();
    expect(await crud.updatePipeline('missing', { name: 'x' })).toBe(false);
    await crud.updatePipeline(stored.id, { name: 'Updated' });
    expect(fetcher).toHaveBeenCalledWith('/api/etl/pipelines/pipeline-1', expect.objectContaining({ method: 'PATCH', body: expect.objectContaining({ name: 'Updated' }) }));
    await crud.togglePipelineStatus(stored.id);
    expect(fetcher).toHaveBeenCalledWith('/api/etl/pipelines/pipeline-1', expect.objectContaining({ method: 'PATCH', body: expect.objectContaining({ paused: true }) }));
    await crud.deletePipeline(stored.id);
    expect(fetcher).toHaveBeenCalledWith('/api/etl/pipelines/pipeline-1', expect.objectContaining({ method: 'DELETE' }));
  });
  it('filters the real list and copies configuration without generating client identities', async () => {
    await useEtlData().refresh(); const crud = usePipelineCrud();
    crud.searchQuery.value = 'missing'; expect(crud.filteredServices.value).toEqual([]);
    crud.searchQuery.value = 'airports'; expect(crud.filteredServices.value).toHaveLength(1);
    await crud.duplicatePipeline(stored.id);
    expect(fetcher).toHaveBeenCalledWith('/api/etl/pipelines', expect.objectContaining({ method: 'POST', body: expect.objectContaining({ name: 'Airports (Copia)' }) }));
    const call = fetcher.mock.calls.find(([, options]) => options?.method === 'POST');
    expect(call?.[1].body).not.toHaveProperty('id');
  });
  it('does not report a successful local mutation when saving fails', async () => {
    const crud = usePipelineCrud(); fetcher.mockRejectedValueOnce(new Error('Forbidden'));
    await expect(crud.createPipeline(stored)).rejects.toThrow('Forbidden');
    expect(crud.pipelines.value).toEqual([]);
  });
});
