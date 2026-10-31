import { ref, computed } from 'vue';
import { pipelineSchema } from '../schemas/pipelineSchemas';
export interface PipelineValidationResult {
  isValid: boolean;
  errors: Record<string, string>;
}

export function validatePipeline(data: Partial<ProcesoEtl>): PipelineValidationResult {
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
import type { ProcesoEtl, PipelineConnectionConfig, ProbeEndpointResult, TargetEntity } from '../types/etl';

function pipelinePayload(data: Partial<ProcesoEtl>) {
  const { nombre, nombreConjunto, descripcion, entidadDestino, conexion, mapeoEsquema, configuracionProgramacion, pausado } = data;
  return { nombre, nombreConjunto, descripcion, entidadDestino, conexion, mapeoEsquema, configuracionProgramacion: configuracionProgramacion && {
    expresionCron: configuracionProgramacion.expresionCron, tamanoLote: configuracionProgramacion.tamanoLote,
    tiempoLimiteSegundos: configuracionProgramacion.tiempoLimiteSegundos, maximoReintentos: configuracionProgramacion.maximoReintentos,
  }, ...(pausado === undefined ? {} : { pausado }) };
}
export function usePipelineCrud() {
  const { pipelines, refresh, request } = useEtlData();
  const isTestingEndpoint = ref(false);
  const lastProbeResult = ref<ProbeEndpointResult | null>(null);
  const selectedEntityFilter = ref<'all' | TargetEntity>('all');
  const selectedSourceTypeFilter = ref<'all' | 'system' | 'custom'>('all');
  const searchQuery = ref('');
  const filteredServices = computed(() => pipelines.value.filter(p =>
    (selectedEntityFilter.value === 'all' || p.entidadDestino === selectedEntityFilter.value) &&
    (selectedSourceTypeFilter.value === 'all' || Boolean(p.esSistema) === (selectedSourceTypeFilter.value === 'system')) &&
    `${p.nombre} ${p.nombreConjunto} ${p.descripcion} ${p.conexion?.urlEndpoint ?? ''}`.toLowerCase().includes(searchQuery.value.trim().toLowerCase())
  ));
  const serviceStats = computed(() => ({
    total: pipelines.value.length, systemCount: pipelines.value.filter(p => p.esSistema).length,
    customCount: pipelines.value.filter(p => !p.esSistema).length,
    activeCount: pipelines.value.filter(p => p.estado !== 'pausado').length,
    errorCount: pipelines.value.filter(p => p.estado === 'error').length,
  }));
  async function testEndpoint(conexion: PipelineConnectionConfig) {
    isTestingEndpoint.value = true;
    try { return lastProbeResult.value = await request<ProbeEndpointResult>('/etl/procesos/probar', { method: 'POST', body: conexion }); }
    finally { isTestingEndpoint.value = false; }
  }
  async function createPipeline(data: Partial<ProcesoEtl>) {
    const validation = validatePipeline(data);
    if (!validation.isValid) throw new Error(Object.values(validation.errors)[0]);
    const created = await request<ProcesoEtl>('/etl/procesos', { method: 'POST', body: pipelinePayload(data) });
    await refresh(); return created;
  }
  async function updatePipeline(id: string, patch: Partial<ProcesoEtl>) {
    const current = pipelines.value.find(p => p.id === id);
    if (!current) return false;
    await request(`/etl/procesos/${id}`, { method: 'PATCH', body: pipelinePayload({ ...current, ...patch }) });
    await refresh(); return true;
  }
  async function deletePipeline(id: string) {
    await request(`/etl/procesos/${id}`, { method: 'DELETE' }); await refresh(); return true;
  }
  async function duplicatePipeline(id: string) {
    const fuente = pipelines.value.find(p => p.id === id);
    return fuente ? createPipeline({ ...fuente, nombre: `${fuente.nombre} (Copia)` }) : null;
  }
  async function togglePipelineStatus(id: string) {
    const fuente = pipelines.value.find(p => p.id === id);
    if (fuente) await updatePipeline(id, { pausado: !fuente.pausado });
  }
  return { pipelines, filteredServices, serviceStats, selectedEntityFilter, selectedSourceTypeFilter, searchQuery,
    validatePipeline, isTestingEndpoint, lastProbeResult, testEndpoint, createPipeline, updatePipeline, deletePipeline, duplicatePipeline, togglePipelineStatus };
}
