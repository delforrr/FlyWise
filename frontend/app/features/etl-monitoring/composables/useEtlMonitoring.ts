import { computed, getCurrentInstance, onMounted, onUnmounted } from 'vue';
import { useEtlData } from './useEtlData';
import type { EtlGlobalMetrics, TriggerSyncOptions } from '../types/etl';

export function useEtlMonitoring() {
  const data = useEtlData();
  const { pipelines, jobs, logs, request, refresh } = data;
  const refreshInterval = useState('etl_refresh_interval', () => 5000);
  let timer: ReturnType<typeof setTimeout> | undefined;
  let mounted = false;
  async function tick() {
    await refresh();
    if (mounted && refreshInterval.value > 0) timer = setTimeout(tick, refreshInterval.value);
  }
  const globalMetrics = computed<EtlGlobalMetrics>(() => {
    const totalRecords = jobs.value.reduce((sum,j) => sum + j.processedRows, 0);
    const totalDiscarded = jobs.value.reduce((sum,j) => sum + j.discardedRows, 0);
    const active = jobs.value.filter(j => j.status === 'running' || j.status === 'pending').length;
    return { totalAeroRecords: totalRecords, totalDiscardedCount: totalDiscarded, activeJobsCount: active,
      successRatePercent: totalRecords + totalDiscarded ? 100 * totalRecords / (totalRecords + totalDiscarded) : 0,
      systemHealth: data.error.value || jobs.value.some(j => j.status === 'failed') ? 'attention_needed' : active ? 'syncing' : 'optimal',
      lastGlobalSync: jobs.value.find(j => j.finishedAt)?.finishedAt ?? 'Sin ejecuciones',
    };
  });
  async function triggerSync(options: TriggerSyncOptions | string) {
    const id = typeof options === 'string' ? options : options.pipelineId;
    await request(`/etl/pipelines/${id}/run`, { method: 'POST' }); await refresh();
  }
  async function setPaused(id: string, paused: boolean) {
    await request(`/etl/pipelines/${id}`, { method: 'PATCH', body: { paused } }); await refresh();
  }
  async function retryFailed(id: string) {
    const jobId = pipelines.value.find(p => p.id === id)?.latestJobId;
    if (jobId) { await request(`/etl/jobs/${jobId}/retry`, { method: 'POST' }); await refresh(); }
  }
  async function syncAll() { for (const p of pipelines.value.filter(p => !p.paused && p.targetEntity !== 'otp_metrics').sort((a,b) => ['countries','airports','airlines','routes'].indexOf(a.targetEntity ?? '') - ['countries','airports','airlines','routes'].indexOf(b.targetEntity ?? ''))) await triggerSync(p.id); }
  async function pauseAll() { for (const p of pipelines.value) await setPaused(p.id, true); }
  function setRefreshInterval(ms: number) {
    refreshInterval.value = ms; clearTimeout(timer);
    if (mounted && ms > 0) timer = setTimeout(tick, ms);
  }
  if (getCurrentInstance()) {
    onMounted(() => { mounted = true; void tick(); });
    onUnmounted(() => { mounted = false; clearTimeout(timer); });
  }
  return { ...data, globalMetrics, refreshInterval, setRefreshInterval, triggerManualRefresh: refresh,
    triggerSync, pausePipeline: (id: string) => setPaused(id, true), resumePipeline: (id: string) => setPaused(id, false),
    retryFailed, syncAll, pauseAll, clearLogs: () => { logs.value = []; } };
}
