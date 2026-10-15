import { describe, it, expect, beforeEach } from 'vitest';
import { useEtlMonitoring } from '../../app/features/etl-monitoring/composables/useEtlMonitoring';

describe('useEtlMonitoring — Composable de Telemetría y Monitoreo ETL BullMQ', () => {
  beforeEach(() => {
    (globalThis as any).__clearStateStore?.();
  });

  describe('KPIs y Métricas Globales (globalMetrics)', () => {
    it('calcula métricas consolidadas de registros procesados, descartados y tasa de éxito', () => {
      const etl = useEtlMonitoring();
      const metrics = etl.globalMetrics.value;

      expect(metrics.totalAeroRecords).toBeGreaterThan(0);
      expect(metrics.totalDiscardedCount).toBeGreaterThanOrEqual(0);
      expect(metrics.successRatePercent).toBeGreaterThanOrEqual(0);
      expect(metrics.successRatePercent).toBeLessThanOrEqual(100);
      expect(['optimal', 'syncing', 'attention_needed']).toContain(metrics.systemHealth);
    });

    it('transiciona el estado de salud a "syncing" cuando hay jobs activos en ejecución', () => {
      const etl = useEtlMonitoring();
      etl.pipelines.value.forEach((p) => (p.status = 'idle'));
      expect(etl.globalMetrics.value.systemHealth).toBe('optimal');

      // Activamos un pipeline a 'running'
      etl.pipelines.value[0].status = 'running';
      expect(etl.globalMetrics.value.activeJobsCount).toBe(1);
      expect(etl.globalMetrics.value.systemHealth).toBe('syncing');
    });

    it('transiciona el estado de salud a "attention_needed" cuando algún pipeline presenta error', () => {
      const etl = useEtlMonitoring();
      etl.pipelines.value[0].status = 'error';

      expect(etl.globalMetrics.value.systemHealth).toBe('attention_needed');
    });

    it('garantiza 100% de tasa de éxito cuando no hay registros procesados ni descartados', () => {
      const etl = useEtlMonitoring();
      etl.pipelines.value.forEach((p) => {
        p.processedRows = 0;
        p.discardedRows = 0;
      });

      expect(etl.globalMetrics.value.successRatePercent).toBe(100);
    });
  });

  describe('Control Operativo de Pipelines (trigger, pause, resume, retry)', () => {
    it('triggerSync() inicia la ingesta del pipeline, resetea progreso y registra evento en log', () => {
      const etl = useEtlMonitoring();
      const targetPipeline = etl.pipelines.value[0];
      const initialLogCount = etl.logs.value.length;

      etl.triggerSync({
        pipelineId: targetPipeline.id,
        mode: 'full',
        batchSize: 5000,
        dryRun: false,
      });

      expect(targetPipeline.status).toBe('running');
      expect(targetPipeline.progressPercent).toBe(0);
      expect(targetPipeline.processedRows).toBe(0);
      expect(targetPipeline.currentStepMessage).toContain('Iniciando ingesta');
      expect(etl.logs.value.length).toBe(initialLogCount + 1);
    });

    it('pausePipeline() conmuta el estado a paused y advierte retención de lotes', () => {
      const etl = useEtlMonitoring();
      const targetPipeline = etl.pipelines.value[0];
      targetPipeline.status = 'running';

      etl.pausePipeline(targetPipeline.id);

      expect(targetPipeline.status).toBe('paused');
      expect(targetPipeline.currentStepMessage).toContain('Pausado por el operador');
    });

    it('resumePipeline() reactiva la ejecución de un pipeline pausado', () => {
      const etl = useEtlMonitoring();
      const targetPipeline = etl.pipelines.value[0];
      targetPipeline.status = 'paused';

      etl.resumePipeline(targetPipeline.id);

      expect(targetPipeline.status).toBe('running');
      expect(targetPipeline.currentStepMessage).toContain('Reanudando ingesta');
    });

    it('retryFailed() reinicia el procesamiento de un pipeline con fallos', () => {
      const etl = useEtlMonitoring();
      const targetPipeline = etl.pipelines.value[0];
      targetPipeline.status = 'error';

      etl.retryFailed(targetPipeline.id);

      expect(targetPipeline.status).toBe('running');
      expect(targetPipeline.currentStepMessage).toContain('Reintentando lotes');
    });

    it('syncAll() y pauseAll() coordinan la ejecución masiva de todos los servicios', () => {
      const etl = useEtlMonitoring();

      etl.syncAll();
      expect(etl.pipelines.value.every((p) => p.status === 'running')).toBe(true);

      etl.pauseAll();
      expect(etl.pipelines.value.every((p) => p.status === 'paused')).toBe(true);
    });
  });

  describe('Auditoría y Gestión de Logs y Muestras Descartadas', () => {
    it('clearLogs() vacía el feed de eventos', () => {
      const etl = useEtlMonitoring();
      expect(etl.logs.value.length).toBeGreaterThan(0);

      etl.clearLogs();
      expect(etl.logs.value).toHaveLength(0);
    });

    it('resolveDiscardedSample() marca muestra como resuelta y descuenta contador de descartes', () => {
      const etl = useEtlMonitoring();
      const pipeline = etl.pipelines.value.find((p) => p.discardedSamples && p.discardedSamples.length > 0);

      if (pipeline && pipeline.discardedSamples.length > 0) {
        const sample = pipeline.discardedSamples[0];
        const initialDiscarded = pipeline.discardedRows;

        etl.resolveDiscardedSample(pipeline.id, sample.id);

        expect(sample.resolved).toBe(true);
        expect(pipeline.discardedRows).toBe(initialDiscarded - 1);
      }
    });
  });
});
