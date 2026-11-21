<script setup lang="ts">
import { computed, onMounted, onScopeDispose, ref } from "vue";
import SelectorCatalogo from "~/features/catalogos/components/SelectorCatalogo.vue";
import { useBackendRequest } from "~/shared/composables/useBackendRequest";

const emit = defineEmits<{ cerrar: []; completada: [periodo: string] }>();
const api = "/administracion/cargas-vuelos";
const request = useBackendRequest({ notificarError: false });
const opciones = ref<{ ultimoMesCerrado: string; coberturaMensual: string }>();
const alcance = ref<"mensual" | "tramo">("tramo");
const periodo = ref("");
const origenId = ref<string | null>(null);
const destinoId = ref<string | null>(null);
const ejecucion = ref<{ ejecucionId: string; periodo: string }>();
const estado = ref<{ estado: string; filasProcesadas: number; mensajeError: string | null }>();
const ocupado = ref(false);
const error = ref("");
const activa = computed(() => !!ejecucion.value && (!estado.value || ["pending", "running"].includes(estado.value.estado)));
const vigente = new AbortController();
let consulta: ReturnType<typeof setTimeout>;
onScopeDispose(() => {
  vigente.abort();
  clearTimeout(consulta);
});

function mensaje(causa: unknown, fallback: string) {
  const data = (causa as { data?: { message?: unknown } } | null)?.data;
  if (!vigente.signal.aborted) error.value = typeof data?.message === "string" ? data.message : fallback;
}

async function consultar() {
  const actual = ejecucion.value;
  if (!actual || vigente.signal.aborted) return;
  try {
    estado.value = await request<NonNullable<typeof estado.value>>(`/etl/ejecuciones/${actual.ejecucionId}`, { signal: vigente.signal });
    if (estado.value.estado === "completed") emit("completada", actual.periodo);
    else if (activa.value) consulta = setTimeout(consultar, 2000);
  } catch (causa) {
    mensaje(causa, "No pudimos consultar el estado de la carga.");
  }
}

async function ejecutar() {
  if (ocupado.value || activa.value || !opciones.value) return;
  if (alcance.value === "tramo" && (!origenId.value || !destinoId.value || origenId.value === destinoId.value)) {
    error.value = "Seleccioná dos aeropuertos distintos.";
    return;
  }
  ocupado.value = true;
  error.value = "";
  try {
    ejecucion.value = await request<NonNullable<typeof ejecucion.value>>(api, {
      method: "POST",
      signal: vigente.signal,
      body: {
        alcance: alcance.value,
        ...(periodo.value && { periodo: periodo.value }),
        ...(alcance.value === "tramo" && { origenId: origenId.value, destinoId: destinoId.value }),
      },
    });
    estado.value = undefined;
    await consultar();
  } catch (causa) {
    mensaje(causa, "No pudimos iniciar la carga.");
  } finally {
    ocupado.value = false;
  }
}

onMounted(async () => {
  try {
    opciones.value = await request<NonNullable<typeof opciones.value>>(api, { signal: vigente.signal });
  } catch (causa) {
    mensaje(causa, "No pudimos consultar las opciones de carga.");
  }
});
</script>

<template>
  <UModal :open="true" title="Cargar vuelos y puntualidad" @update:open="open => { if (!open) emit('cerrar') }">
    <template #body>
      <form v-if="opciones" aria-label="Cargar vuelos y puntualidad" class="space-y-4" @submit.prevent="ejecutar">
        <UFormField label="Alcance">
          <USelect v-model="alcance" :disabled="ocupado || activa" class="w-full" :items="[
            { label: 'Por tramo', value: 'tramo' },
            { label: opciones.coberturaMensual, value: 'mensual' },
          ]" />
        </UFormField>
        <div v-if="alcance === 'tramo'" class="grid gap-4 sm:grid-cols-2">
          <UFormField label="Origen" required>
            <SelectorCatalogo v-model="origenId" recurso="aeropuertos" label="Origen de la carga" :disabled="ocupado || activa" />
          </UFormField>
          <UFormField label="Destino" required>
            <SelectorCatalogo v-model="destinoId" recurso="aeropuertos" label="Destino de la carga" :disabled="ocupado || activa" />
          </UFormField>
        </div>
        <UFormField label="Mes" :description="`Vacío usa el último mes cerrado (${opciones.ultimoMesCerrado}).`">
          <UInput v-model="periodo" type="month" aria-label="Mes de la carga" :max="opciones.ultimoMesCerrado" :disabled="ocupado || activa" />
        </UFormField>
        <UButton type="submit" :loading="ocupado" :disabled="activa">Iniciar carga</UButton>
      </form>
      <p v-if="activa && !error" role="status" class="mt-3">Carga en curso.</p>
      <p v-if="estado?.estado === 'completed'" role="status" class="mt-3">
        {{ estado.filasProcesadas ? `Carga completada. ${estado.filasProcesadas} operaciones procesadas.` : 'Carga completada sin cobertura nueva.' }}
      </p>
      <p v-if="error || estado?.estado === 'failed'" role="alert" class="mt-3 text-error">
        {{ error || estado?.mensajeError || 'La carga falló.' }}
        <UButton v-if="error && activa" type="button" variant="link" @click="error = ''; consultar()">Consultar estado</UButton>
      </p>
    </template>
  </UModal>
</template>
