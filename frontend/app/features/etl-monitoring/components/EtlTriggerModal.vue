<script setup lang="ts">
import { ref, watch } from 'vue';
import { triggerSyncSchema } from '../schemas/pipelineSchemas';
import { useEtlData } from '../composables/useEtlData';
import type { PoblacionOperacion, ProcesoEtl, TriggerSyncOptions } from '../types/etl';

const props = defineProps<{
  isOpen: boolean; proceso: ProcesoEtl | null; busy?: boolean; conflictoActivo?: string;
}>();
const emit = defineEmits<{ close: []; confirm: [options: TriggerSyncOptions] }>();
const { request } = useEtlData();

type Cambio = PoblacionOperacion & {
  origen: { nombre: string; iata: string | null };
  destino: { nombre: string; iata: string | null };
  aerolinea: { nombre: string };
  ejecucionEtl: { fuente: string } | null;
  fuentes: unknown;
};

const cambios = ref<Cambio[]>([]);
const autorizadas = ref(new Map<string, PoblacionOperacion>());
const cargando = ref(false);
const error = ref(false);
const pagina = ref(1);
const limite = 10;
const clave = ({ origenId, destinoId, aerolineaId }: PoblacionOperacion) =>
  JSON.stringify([origenId, destinoId, aerolineaId]);
const fuenteActual = ({ ejecucionEtl, fuentes }: Cambio) =>
  ejecucionEtl?.fuente || (Array.isArray(fuentes) && fuentes.join(', ')) || 'Fuente histórica';

watch(() => [props.isOpen, props.proceso?.id] as const, () => {
  cambios.value = [];
  autorizadas.value.clear();
  error.value = false;
  pagina.value = 1;
});

async function cargar(paginaNueva: number) {
  const id = props.proceso?.id;
  if (!id) return;
  cargando.value = true;
  error.value = false;
  try {
    const result = await request<Cambio[]>(`/etl/procesos/${id}/cambios-de-fuente`, {
      query: { pagina: paginaNueva, limite },
    });
    if (props.proceso?.id === id && props.isOpen) {
      pagina.value = paginaNueva;
      cambios.value = result;
    }
  } catch {
    error.value = true;
  } finally {
    cargando.value = false;
  }
}

function seleccionar({ origenId, destinoId, aerolineaId }: Cambio, activa: boolean) {
  const poblacion = { origenId, destinoId, aerolineaId };
  if (activa) autorizadas.value.set(clave(poblacion), poblacion);
  else autorizadas.value.delete(clave(poblacion));
}

function confirm() {
  const result = triggerSyncSchema.safeParse({ procesoId: props.proceso?.id });
  if (result.success) {
    emit('confirm', {
      ...result.data,
      ...(autorizadas.value.size && { autorizarCambioFuente: [...autorizadas.value.values()] }),
    });
  }
}
</script>

<template>
  <UModal :open="isOpen" :title="`Sincronizar ${proceso?.nombre ?? ''}`" @update:open="val => { if (!val) emit('close') }">
    <template #body>
      <div v-if="proceso?.operacion" class="space-y-3">
        <p class="text-sm text-text-muted">Carga de {{ proceso.operacion.proveedor }} para {{ proceso.operacion.periodo }}.</p>
        <UButton variant="outline" color="neutral" size="sm" :loading="cargando" @click="cargar(1)">Revisar cambios de fuente</UButton>
        <p v-if="error" role="alert">No se pudieron consultar las publicaciones vigentes.</p>
        <UCheckbox
          v-for="cambio in cambios"
          :key="clave(cambio)"
          :model-value="autorizadas.has(clave(cambio))"
          :label="`Autorizar ${cambio.origen.iata || cambio.origen.nombre} → ${cambio.destino.iata || cambio.destino.nombre} · ${cambio.aerolinea.nombre} · ${fuenteActual(cambio)} → ${proceso.operacion.proveedor}`"
          @update:model-value="valor => seleccionar(cambio, valor === true)"
        />
        <div v-if="pagina > 1 || cambios.length === limite" class="flex gap-2">
          <UButton size="sm" variant="ghost" :disabled="pagina === 1 || cargando" @click="cargar(pagina - 1)">Anterior</UButton>
          <UButton size="sm" variant="ghost" :disabled="cambios.length < limite || cargando" @click="cargar(pagina + 1)">Siguiente</UButton>
        </div>
        <p v-if="autorizadas.size" role="status">{{ autorizadas.size }} cambios autorizados para esta ejecución.</p>
      </div>
      <p v-else class="text-sm text-text-muted">La ejecución usará el mapeo y tamaño de lote guardados. Los errores quedarán en el historial.</p>
      <p v-if="conflictoActivo" role="alert" class="mt-2 break-words text-error">Ingesta activa {{ conflictoActivo }}</p>
    </template>
    <template #footer>
      <UButton color="neutral" variant="outline" @click="emit('close')">Cancelar</UButton>
      <UButton :disabled="!proceso || proceso.estado === 'running' || proceso.pausado"
        :loading="busy" @click="confirm">Ejecutar sincronización</UButton>
    </template>
  </UModal>
</template>
