import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useEtlMonitoring } from '../../app/features/etl-monitoring/composables/useEtlMonitoring';

const fetcher = vi.fn();
const pipeline = { id: 'p1', name: 'Routes', datasetName: 'OpenFlights', description: '', targetEntity: 'routes', paused: false, scheduleConfig: { cronExpression: '', batchSize: 2000, maxRetries: 2, timeoutSeconds: 300 } };
const job = { id: 'j1', pipelineId: 'p1', source: 'routes', status: 'completed', totalRows: 10, processedRows: 8, insertedRows: 2, discardedRows: 2, startedAt: '2026-10-24T00:00:00Z', finishedAt: '2026-10-24T00:00:02Z', durationMs: 2000, errorMessage: null };
beforeEach(() => {
  fetcher.mockReset();
  fetcher.mockImplementation(async (url: string) => url === '/api/etl/pipelines' ? [pipeline] : url === '/api/etl/history' ? [job] : []);
  vi.stubGlobal('$fetch', fetcher);
});
describe('Real ETL monitoring', () => {
  it('requests samples from the current attempt or an explicitly selected previous attempt', async () => {
    fetcher.mockImplementation(async (url: string) => url === '/api/etl/pipelines' ? [pipeline] : url === '/api/etl/history' ? [{ ...job, attempt: 2 }] : []);
    const monitor = useEtlMonitoring();
    await monitor.refresh();
    const current = monitor.pipelines.value[0]!;
    await monitor.loadSamples(current);
    expect(fetcher).toHaveBeenLastCalledWith('/api/etl/jobs/j1/samples', expect.objectContaining({ query: { attempt: 2 } }));
    await monitor.loadSamples(current, 1);
    expect(fetcher).toHaveBeenLastCalledWith('/api/etl/jobs/j1/samples', expect.objectContaining({ query: { attempt: 1 } }));
  });
  it('derives metrics from persisted executions and does not generate progress', async () => {
    const monitor = useEtlMonitoring();
    expect(monitor.pipelines.value).toEqual([]);
    await monitor.refresh();
    expect(monitor.globalMetrics.value).toMatchObject({ totalAeroRecords: 8, totalDiscardedCount: 2, successRatePercent: 80, activeJobsCount: 0 });
    expect(monitor.pipelines.value[0]).toMatchObject({ progressPercent: 100, averageSpeedRowsPerSec: 4, latestJobId: 'j1' });
  });
  it('reports unknown totals while running and preserves paused scheduling', async () => {
    fetcher.mockImplementation(async (url: string) => url === '/api/etl/pipelines' ? [{ ...pipeline, paused: true }] : url === '/api/etl/history' ? [{ ...job, status: 'running', finishedAt: null, durationMs: null }] : []);
    const monitor = useEtlMonitoring(); await monitor.refresh();
    expect(monitor.pipelines.value[0]).toMatchObject({ status: 'running', progressPercent: 0 });
    expect(monitor.globalMetrics.value.systemHealth).toBe('syncing');
  });
  it('triggers full jobs, pauses future runs and retries a whole execution', async () => {
    const monitor = useEtlMonitoring(); await monitor.refresh();
    await monitor.triggerSync('p1'); await monitor.pausePipeline('p1'); await monitor.resumePipeline('p1'); await monitor.retryFailed('p1');
    expect(fetcher).toHaveBeenCalledWith('/api/etl/pipelines/p1/run', expect.objectContaining({ method: 'POST' }));
    expect(fetcher).toHaveBeenCalledWith('/api/etl/pipelines/p1', expect.objectContaining({ method: 'PATCH', body: { paused: true } }));
    expect(fetcher).toHaveBeenCalledWith('/api/etl/pipelines/p1', expect.objectContaining({ method: 'PATCH', body: { paused: false } }));
    expect(fetcher).toHaveBeenCalledWith('/api/etl/jobs/j1/retry', expect.objectContaining({ method: 'POST' }));
  });
  it('loads persisted samples without changing immutable discard totals', async () => {
    const monitor = useEtlMonitoring(); await monitor.refresh();
    fetcher.mockResolvedValueOnce([{ id: 's1', rowIndex: 2, field: null, reason: 'unresolved', rawSample: '{}', createdAt: '2026-10-24T00:00:00Z' }]);
    await monitor.loadSamples(monitor.pipelines.value[0]!);
    expect(monitor.pipelines.value[0]?.discardedSamples[0]?.field).toBe('registro');
    expect(monitor.pipelines.value[0]?.discardedRows).toBe(2);
  });
  it('surfaces network errors and recovers without inventing successful state', async () => {
    const monitor = useEtlMonitoring(); fetcher.mockRejectedValueOnce(new Error('offline')); await monitor.refresh();
    expect(monitor.error.value).toBe('offline'); expect(monitor.globalMetrics.value.systemHealth).toBe('attention_needed');
    await monitor.refresh(); expect(monitor.error.value).toBeNull();
    monitor.setRefreshInterval(0); expect(monitor.refreshInterval.value).toBe(0);
  });
});
