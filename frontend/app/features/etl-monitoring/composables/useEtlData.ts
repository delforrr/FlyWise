import { useBackendRequest } from '~/shared/composables/useBackendRequest';
import type { ProcesoEtl, StoredPipeline, EtlJobRecord, EtlLogEntry, DiscardedRowRecord } from '../types/etl';

export function useEtlData() {
  const request = useBackendRequest();
  const pipelines = useState<ProcesoEtl[]>('procesos_etl', () => []);
  const ejecuciones = useState<EtlJobRecord[]>('ejecuciones_etl', () => []);
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
        request<StoredPipeline[]>('/etl/procesos'), request<EtlJobRecord[]>('/etl/historial'),
      ]);
      ejecuciones.value = history;
      pipelines.value = stored.map(p => {
        const job = history.find(j => j.procesoId === p.id);
        const scheduleDescription = p.configuracionProgramacion?.expresionCron ? `${p.configuracionProgramacion.expresionCron} (UTC)` : 'Manual';
        return {
          ...p, icon: 'i-lucide-database', latestJobId: job?.id, intento: job?.intento ?? 0,
          estado: job?.estado === 'running' || job?.estado === 'pending' ? 'running' : p.pausado ? 'pausado' : job?.estado === 'failed' ? 'error' : job?.estado === 'completed' ? 'success' : 'idle',
          filasProcesadas: job?.filasProcesadas ?? 0, filasDescartadas: job?.filasDescartadas ?? 0,
          totalEstimatedRows: job?.filasTotales ?? 0,
          progressPercent: job?.estado === 'completed' ? 100 : 0,
          lastSyncAt: job?.finalizadoEn ?? null, nextScheduledSync: scheduleDescription, scheduleDescription,
          averageSpeedRowsPerSec: job?.durationMs ? Math.round(job.filasProcesadas * 1000 / job.durationMs) : 0,
          currentStepMessage: job?.mensajeError ?? (job?.estado === 'running' ? 'Procesando; total definitivo al finalizar.' : 'Listo para ejecutar.'),
          muestrasDescartadas: [],
        } satisfies ProcesoEtl;
      });
      const recent = history.slice(0, 10);
      logs.value = (await Promise.all(recent.map(async job => {
        const eventos = await request<{ id: string; creadoEn: string; nivel: EtlLogEntry['nivel']; mensaje: string }[]>(`/etl/ejecuciones/${job.id}/eventos`);
        return eventos.map(e => ({ ...e, timestamp: e.creadoEn, procesoId: job.procesoId ?? job.fuente, pipelineName: stored.find(p => p.id === job.procesoId)?.nombre ?? job.fuente }));
      }))).flat().sort((a,b) => b.timestamp.localeCompare(a.timestamp)).slice(0, 100);
      error.value = null;
      latencyMs.value = Math.round(performance.now() - start);
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'No se pudo consultar el ETL';
    } finally { isRefreshing.value = false; }
  }
  async function loadSamples(proceso: ProcesoEtl, intento = proceso.intento ?? 0) {
    if (!proceso.latestJobId) return;
    const samples = await request<(Omit<DiscardedRowRecord, 'timestamp'> & { creadoEn: string; campo: string | null })[]>(`/etl/ejecuciones/${proceso.latestJobId}/muestras`, { query: { intento } });
    proceso.muestrasDescartadas = samples.map(s => ({ ...s, campo: s.campo ?? 'registro', timestamp: s.creadoEn }));
  }
  return { pipelines, ejecuciones, logs, error, isRefreshing, latencyMs, refresh, loadSamples, request };
}
