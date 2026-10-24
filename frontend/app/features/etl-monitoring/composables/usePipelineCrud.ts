import { ref, computed } from 'vue';
import { pipelineSchema } from '../schemas/pipelineSchemas';
export interface PipelineValidationResult {
  isValid: boolean;
  errors: Record<string, string>;
}

export function validatePipeline(data: Partial<EtlPipeline>): PipelineValidationResult {
  const result = pipelineSchema.safeParse(data);
  if (result.success) {
    return {
      isValid: true,
      errors: {},
    };
  }

  const errors: Record<string, string> = {};
  for (const issue of result.error.issues) {
    const key = issue.path[0] ? String(issue.path[0]) : 'general';
    if (!errors[key]) {
      errors[key] = issue.message;
    }
  }

  return {
    isValid: false,
    errors,
  };
}


import { useEtlData } from './useEtlData';
import type { EtlPipeline, PipelineConnectionConfig, ProbeEndpointResult, TargetEntity } from '../types/etl';

function pipelinePayload(data: Partial<EtlPipeline>) {
  const { name, datasetName, description, targetEntity, connection, schemaMapping, scheduleConfig, paused } = data;
  return { name, datasetName, description, targetEntity, connection, schemaMapping, scheduleConfig: scheduleConfig && {
    cronExpression: scheduleConfig.cronExpression, batchSize: scheduleConfig.batchSize,
    timeoutSeconds: scheduleConfig.timeoutSeconds, maxRetries: scheduleConfig.maxRetries,
  }, ...(paused === undefined ? {} : { paused }) };
}
export function usePipelineCrud() {
  const { pipelines, refresh, request } = useEtlData();
  const isTestingEndpoint = ref(false);
  const lastProbeResult = ref<ProbeEndpointResult | null>(null);
  const selectedEntityFilter = ref<'all' | TargetEntity>('all');
  const selectedSourceTypeFilter = ref<'all' | 'system' | 'custom'>('all');
  const searchQuery = ref('');
  const filteredServices = computed(() => pipelines.value.filter(p =>
    (selectedEntityFilter.value === 'all' || p.targetEntity === selectedEntityFilter.value) &&
    (selectedSourceTypeFilter.value === 'all' || Boolean(p.isSystem) === (selectedSourceTypeFilter.value === 'system')) &&
    `${p.name} ${p.datasetName} ${p.description} ${p.connection?.endpointUrl ?? ''}`.toLowerCase().includes(searchQuery.value.trim().toLowerCase())
  ));
  const serviceStats = computed(() => ({
    total: pipelines.value.length, systemCount: pipelines.value.filter(p => p.isSystem).length,
    customCount: pipelines.value.filter(p => !p.isSystem).length,
    activeCount: pipelines.value.filter(p => p.status !== 'paused').length,
    errorCount: pipelines.value.filter(p => p.status === 'error').length,
  }));
  async function testEndpoint(connection: PipelineConnectionConfig) {
    isTestingEndpoint.value = true;
    try { return lastProbeResult.value = await request<ProbeEndpointResult>('/etl/pipelines/probe', { method: 'POST', body: connection }); }
    finally { isTestingEndpoint.value = false; }
  }
  async function createPipeline(data: Partial<EtlPipeline>) {
    const validation = validatePipeline(data);
    if (!validation.isValid) throw new Error(Object.values(validation.errors)[0]);
    const created = await request<EtlPipeline>('/etl/pipelines', { method: 'POST', body: pipelinePayload(data) });
    await refresh(); return created;
  }
  async function updatePipeline(id: string, patch: Partial<EtlPipeline>) {
    const current = pipelines.value.find(p => p.id === id);
    if (!current) return false;
    await request(`/etl/pipelines/${id}`, { method: 'PATCH', body: pipelinePayload({ ...current, ...patch }) });
    await refresh(); return true;
  }
  async function deletePipeline(id: string) {
    await request(`/etl/pipelines/${id}`, { method: 'DELETE' }); await refresh(); return true;
  }
  async function duplicatePipeline(id: string) {
    const source = pipelines.value.find(p => p.id === id);
    return source ? createPipeline({ ...source, name: `${source.name} (Copia)` }) : null;
  }
  async function togglePipelineStatus(id: string) {
    const source = pipelines.value.find(p => p.id === id);
    if (source) await updatePipeline(id, { paused: !source.paused });
  }
  return { pipelines, filteredServices, serviceStats, selectedEntityFilter, selectedSourceTypeFilter, searchQuery,
    validatePipeline, isTestingEndpoint, lastProbeResult, testEndpoint, createPipeline, updatePipeline, deletePipeline, duplicatePipeline, togglePipelineStatus };
}
