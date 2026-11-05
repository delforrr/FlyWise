import { computed, getCurrentInstance, onMounted, onUnmounted } from 'vue';
import { useEtlData } from './useEtlData';
import type { EtlGlobalMetrics, TriggerSyncOptions } from '../types/etl';

export function useEtlMonitoring() {
  const data = useEtlData();
  const { pipelines, ejecuciones, logs, request, refresh } = data;
  const refreshInterval = useState('etl_refresh_interval', () => 5000);
  let timer: ReturnType<typeof setTimeout> | undefined;
  let mounted = false;
  async function tick() {
    await refresh();
    if (mounted && refreshInterval.value > 0) timer = setTimeout(tick, refreshInterval.value);
  }
  const globalMetrics = computed<EtlGlobalMetrics>(() => {
    const totalRecords = ejecuciones.value.reduce((sum,j) => sum + j.filasProcesadas, 0);
    const totalDiscarded = ejecuciones.value.reduce((sum,j) => sum + j.filasDescartadas, 0);
    const activa = ejecuciones.value.filter(j => j.estado === 'running' || j.estado === 'pending').length;
    return { totalAeroRecords: totalRecords, totalDiscardedCount: totalDiscarded, activeJobsCount: activa,
      successRatePercent: totalRecords + totalDiscarded ? 100 * totalRecords / (totalRecords + totalDiscarded) : 0,
      systemHealth: data.error.value || ejecuciones.value.some(j => j.estado === 'failed') ? 'attention_needed' : activa ? 'syncing' : 'optimal',
      lastGlobalSync: ejecuciones.value.find(j => j.finalizadoEn)?.finalizadoEn ?? 'Sin ejecuciones',
    };
  });
  async function triggerSync(options: TriggerSyncOptions | string) {
    const id = typeof options === 'string' ? options : options.procesoId;
    await request(`/etl/procesos/${id}/ejecutar`, { method: 'POST' }); await refresh();
  }
  async function setPaused(id: string, pausado: boolean) {
    await request(`/etl/procesos/${id}`, { method: 'PATCH', body: { pausado } }); await refresh();
  }
  async function retryFailed(id: string) {
    const ejecucionId = pipelines.value.find(p => p.id === id)?.latestJobId;
    if (ejecucionId) { await request(`/etl/ejecuciones/${ejecucionId}/reintentar`, { method: 'POST' }); await refresh(); }
  }
  async function syncAll() { for (const p of pipelines.value.filter(p => !p.pausado && p.entidadDestino !== 'otp_metrics').sort((a,b) => ['paises','aeropuertos','aerolineas','rutas'].indexOf(a.entidadDestino ?? '') - ['paises','aeropuertos','aerolineas','rutas'].indexOf(b.entidadDestino ?? ''))) await triggerSync(p.id); }
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
