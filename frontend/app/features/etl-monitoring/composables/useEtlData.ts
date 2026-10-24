import { useBackendRequest } from '~/shared/composables/useBackendRequest';
import type { EtlPipeline, StoredPipeline, EtlJobRecord, EtlLogEntry, DiscardedRowRecord } from '../types/etl';

export function useEtlData() {
  const request = useBackendRequest();
  const pipelines = useState<EtlPipeline[]>('etl_pipelines', () => []);
  const jobs = useState<EtlJobRecord[]>('etl_jobs', () => []);
  const logs = useState<EtlLogEntry[]>('etl_logs', () => []);
  const error = useState<string | null>('etl_error', () => null);
  const isRefreshing = useState('etl_is_refreshing', () => false);
  const latencyMs = useState('etl_latency', () => 0);

  async function refresh() {
    if (isRefreshing.value) return;
    isRefreshing.value = true;
    const start = performance.now();
    try {
      const [stored, history] = await Promise.all([
        request<StoredPipeline[]>('/etl/pipelines'), request<EtlJobRecord[]>('/etl/history'),
      ]);
      jobs.value = history;
      pipelines.value = stored.map(p => {
        const job = history.find(j => j.pipelineId === p.id);
        const scheduleDescription = p.scheduleConfig?.cronExpression ? `${p.scheduleConfig.cronExpression} (UTC)` : 'Manual';
        return {
          ...p, icon: 'i-lucide-database', latestJobId: job?.id,
          status: job?.status === 'running' || job?.status === 'pending' ? 'running' : p.paused ? 'paused' : job?.status === 'failed' ? 'error' : job?.status === 'completed' ? 'success' : 'idle',
          processedRows: job?.processedRows ?? 0, discardedRows: job?.discardedRows ?? 0,
          totalEstimatedRows: job?.totalRows ?? 0,
          progressPercent: job?.status === 'completed' ? 100 : 0,
          lastSyncAt: job?.finishedAt ?? null, nextScheduledSync: scheduleDescription, scheduleDescription,
          averageSpeedRowsPerSec: job?.durationMs ? Math.round(job.processedRows * 1000 / job.durationMs) : 0,
          currentStepMessage: job?.errorMessage ?? (job?.status === 'running' ? 'Procesando; total definitivo al finalizar.' : 'Listo para ejecutar.'),
          discardedSamples: [],
        } satisfies EtlPipeline;
      });
      const recent = history.slice(0, 10);
      logs.value = (await Promise.all(recent.map(async job => {
        const events = await request<{ id: string; createdAt: string; level: EtlLogEntry['level']; message: string }[]>(`/etl/jobs/${job.id}/events`);
        return events.map(e => ({ ...e, timestamp: e.createdAt, pipelineId: job.pipelineId ?? job.source, pipelineName: stored.find(p => p.id === job.pipelineId)?.name ?? job.source }));
      }))).flat().sort((a,b) => b.timestamp.localeCompare(a.timestamp)).slice(0, 100);
      error.value = null;
      latencyMs.value = Math.round(performance.now() - start);
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'No se pudo consultar el ETL';
    } finally { isRefreshing.value = false; }
  }
  async function loadSamples(pipeline: EtlPipeline) {
    if (!pipeline.latestJobId) return;
    const samples = await request<(Omit<DiscardedRowRecord, 'timestamp'> & { createdAt: string; field: string | null })[]>(`/etl/jobs/${pipeline.latestJobId}/samples`);
    pipeline.discardedSamples = samples.map(s => ({ ...s, field: s.field ?? 'registro', timestamp: s.createdAt }));
  }
  return { pipelines, jobs, logs, error, isRefreshing, latencyMs, refresh, loadSamples, request };
}
