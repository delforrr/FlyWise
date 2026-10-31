import { describe, it, expect, vi, beforeEach } from 'vitest';
import { validatePipeline, usePipelineCrud } from '../../app/features/etl-monitoring/composables/usePipelineCrud';
import { useEtlData } from '../../app/features/etl-monitoring/composables/useEtlData';
import type { StoredPipeline } from '../../app/features/etl-monitoring/types/etl';

const stored: StoredPipeline = { id: 'proceso-1', nombre: 'Airports', nombreConjunto: 'OpenFlights', descripcion: '', entidadDestino: 'aeropuertos', esSistema: false, pausado: false, conexion: { tipoFuente: 'http_stream', urlEndpoint: 'https://raw.githubusercontent.com/data', metodoHttp: 'GET', formatoDatos: 'csv' }, mapeoEsquema: ['idOpenflights', 'nombre', 'latitud', 'longitud'].map((campoDestino, i) => ({ columnaOrigen: String(i), campoDestino })), configuracionProgramacion: { expresionCron: '', tamanoLote: 2000, tiempoLimiteSegundos: 300, maximoReintentos: 2 } };
const fetcher = vi.fn();
beforeEach(() => {
  fetcher.mockReset();
  fetcher.mockImplementation(async (url: string) => url === '/api/etl/procesos' ? [stored] : []);
  vi.stubGlobal('$fetch', fetcher);
});
describe('Persisted proceso CRUD', () => {
  it('validates the current catalogue fields without requiring optional IATA or ICAO codes', () => {
    expect(validatePipeline(stored).isValid).toBe(true);
    expect(validatePipeline({ ...stored, nombre: '' }).errors).toHaveProperty('nombre');
    expect(validatePipeline({ ...stored, mapeoEsquema: [] }).errors).toHaveProperty('mapeoEsquema');
  });
  it('starts empty and loads actual configurations instead of fixtures', async () => {
    const crud = usePipelineCrud();
    expect(crud.pipelines.value).toEqual([]);
    await useEtlData().refresh();
    expect(crud.serviceStats.value).toMatchObject({ total: 1, customCount: 1 });
    expect(crud.pipelines.value[0]?.filasProcesadas).toBe(0);
  });
  it('sends supported configuration fields and refreshes server state after creating', async () => {
    const crud = usePipelineCrud();
    await crud.createPipeline({ ...stored, icon: 'presentation-only' });
    const call = fetcher.mock.calls.find(([, options]) => options?.method === 'POST');
    expect(call?.[0]).toBe('/api/etl/procesos');
    expect(call?.[1].body).not.toHaveProperty('icon');
    expect(call?.[1].body.configuracionProgramacion).toEqual(stored.configuracionProgramacion);
    expect(crud.pipelines.value).toHaveLength(1);
  });
  it('uses a real probe response and clears loading state on network failures', async () => {
    const crud = usePipelineCrud();
    const result = { success: true, statusCode: 200, latencyMs: 4, contentType: 'text/csv', sampleRows: [{ '0': '42' }], detectedColumns: ['0'] };
    fetcher.mockResolvedValueOnce(result);
    expect(await crud.testEndpoint(stored.conexion!)).toEqual(result);
    fetcher.mockRejectedValueOnce(new Error('offline'));
    await expect(crud.testEndpoint(stored.conexion!)).rejects.toThrow('offline');
    expect(crud.isTestingEndpoint.value).toBe(false);
  });
  it('updates, pauses and archives through the API', async () => {
    await useEtlData().refresh(); const crud = usePipelineCrud();
    expect(await crud.updatePipeline('missing', { nombre: 'x' })).toBe(false);
    await crud.updatePipeline(stored.id, { nombre: 'Updated' });
    expect(fetcher).toHaveBeenCalledWith('/api/etl/procesos/proceso-1', expect.objectContaining({ method: 'PATCH', body: expect.objectContaining({ nombre: 'Updated' }) }));
    await crud.togglePipelineStatus(stored.id);
    expect(fetcher).toHaveBeenCalledWith('/api/etl/procesos/proceso-1', expect.objectContaining({ method: 'PATCH', body: expect.objectContaining({ pausado: true }) }));
    await crud.deletePipeline(stored.id);
    expect(fetcher).toHaveBeenCalledWith('/api/etl/procesos/proceso-1', expect.objectContaining({ method: 'DELETE' }));
  });
  it('filters the real list and copies configuration without generating client identities', async () => {
    await useEtlData().refresh(); const crud = usePipelineCrud();
    crud.searchQuery.value = 'missing'; expect(crud.filteredServices.value).toEqual([]);
    crud.searchQuery.value = 'airports'; expect(crud.filteredServices.value).toHaveLength(1);
    await crud.duplicatePipeline(stored.id);
    expect(fetcher).toHaveBeenCalledWith('/api/etl/procesos', expect.objectContaining({ method: 'POST', body: expect.objectContaining({ nombre: 'Airports (Copia)' }) }));
    const call = fetcher.mock.calls.find(([, options]) => options?.method === 'POST');
    expect(call?.[1].body).not.toHaveProperty('id');
  });
  it('does not report a successful local mutation when saving fails', async () => {
    const crud = usePipelineCrud(); fetcher.mockRejectedValueOnce(new Error('Forbidden'));
    await expect(crud.createPipeline(stored)).rejects.toThrow('Forbidden');
    expect(crud.pipelines.value).toEqual([]);
  });
});
