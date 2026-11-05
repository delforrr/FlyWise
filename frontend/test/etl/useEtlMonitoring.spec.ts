import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useEtlMonitoring } from '../../app/features/etl-monitoring/composables/useEtlMonitoring';

const fetcher = vi.fn();
const proceso = { id: 'p1', nombre: 'Routes', nombreConjunto: 'OpenFlights', descripcion: '', entidadDestino: 'rutas', pausado: false, configuracionProgramacion: { expresionCron: '', tamanoLote: 2000, maximoReintentos: 2, tiempoLimiteSegundos: 300 } };
const job = { id: 'j1', procesoId: 'p1', fuente: 'rutas', estado: 'completed', filasTotales: 10, filasProcesadas: 8, filasInsertadas: 2, filasDescartadas: 2, iniciadoEn: '2026-10-24T00:00:00Z', finalizadoEn: '2026-10-24T00:00:02Z', durationMs: 2000, mensajeError: null };
beforeEach(() => {
  fetcher.mockReset();
  fetcher.mockImplementation(async (url: string) => url === '/api/etl/procesos' ? [proceso] : url === '/api/etl/historial' ? [job] : []);
  vi.stubGlobal('$fetch', fetcher);
});
describe('Real ETL monitoring', () => {
  it('requests samples from the current intento or an explicitly selected previous intento', async () => {
    fetcher.mockImplementation(async (url: string) => url === '/api/etl/procesos' ? [proceso] : url === '/api/etl/historial' ? [{ ...job, intento: 2 }] : []);
    const monitor = useEtlMonitoring();
    await monitor.refresh();
    const current = monitor.pipelines.value[0]!;
    await monitor.loadSamples(current);
    expect(fetcher).toHaveBeenLastCalledWith('/api/etl/ejecuciones/j1/muestras', expect.objectContaining({ query: { intento: 2 } }));
    await monitor.loadSamples(current, 1);
    expect(fetcher).toHaveBeenLastCalledWith('/api/etl/ejecuciones/j1/muestras', expect.objectContaining({ query: { intento: 1 } }));
  });
  it('derives metricas from persisted executions and does not generate progress', async () => {
    const monitor = useEtlMonitoring();
    expect(monitor.pipelines.value).toEqual([]);
    await monitor.refresh();
    expect(monitor.globalMetrics.value).toMatchObject({ totalAeroRecords: 8, totalDiscardedCount: 2, successRatePercent: 80, activeJobsCount: 0 });
    expect(monitor.pipelines.value[0]).toMatchObject({ progressPercent: 100, averageSpeedRowsPerSec: 4, latestJobId: 'j1' });
  });
  it('reports unknown totals while running and preserves pausado scheduling', async () => {
    fetcher.mockImplementation(async (url: string) => url === '/api/etl/procesos' ? [{ ...proceso, pausado: true }] : url === '/api/etl/historial' ? [{ ...job, estado: 'running', finalizadoEn: null, durationMs: null }] : []);
    const monitor = useEtlMonitoring(); await monitor.refresh();
    expect(monitor.pipelines.value[0]).toMatchObject({ estado: 'running', progressPercent: 0 });
    expect(monitor.globalMetrics.value.systemHealth).toBe('syncing');
  });
  it('triggers full ejecuciones, pauses future runs and retries a whole execution', async () => {
    const monitor = useEtlMonitoring(); await monitor.refresh();
    await monitor.triggerSync('p1'); await monitor.pausePipeline('p1'); await monitor.resumePipeline('p1'); await monitor.retryFailed('p1');
    expect(fetcher).toHaveBeenCalledWith('/api/etl/procesos/p1/ejecutar', expect.objectContaining({ method: 'POST' }));
    expect(fetcher).toHaveBeenCalledWith('/api/etl/procesos/p1', expect.objectContaining({ method: 'PATCH', body: { pausado: true } }));
    expect(fetcher).toHaveBeenCalledWith('/api/etl/procesos/p1', expect.objectContaining({ method: 'PATCH', body: { pausado: false } }));
    expect(fetcher).toHaveBeenCalledWith('/api/etl/ejecuciones/j1/reintentar', expect.objectContaining({ method: 'POST' }));
  });
  it('loads persisted samples without changing immutable discard totals', async () => {
    const monitor = useEtlMonitoring(); await monitor.refresh();
    fetcher.mockResolvedValueOnce([{ id: 's1', numeroFila: 2, campo: null, motivo: 'unresolved', muestraOriginal: '{}', creadoEn: '2026-10-24T00:00:00Z' }]);
    await monitor.loadSamples(monitor.pipelines.value[0]!);
    expect(monitor.pipelines.value[0]?.muestrasDescartadas[0]?.campo).toBe('registro');
    expect(monitor.pipelines.value[0]?.filasDescartadas).toBe(2);
  });
  it('surfaces network errors and recovers without inventing successful state', async () => {
    const monitor = useEtlMonitoring(); fetcher.mockRejectedValueOnce(new Error('offline')); await monitor.refresh();
    expect(monitor.error.value).toBe('offline'); expect(monitor.globalMetrics.value.systemHealth).toBe('attention_needed');
    await monitor.refresh(); expect(monitor.error.value).toBeNull();
    monitor.setRefreshInterval(0); expect(monitor.refreshInterval.value).toBe(0);
  });
});
