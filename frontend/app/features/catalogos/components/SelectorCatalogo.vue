<script setup lang="ts">
import { useBackendRequest } from "~/shared/composables/useBackendRequest";
import type { ReferenciaCatalogo } from "../schemas/catalogos";

const props = defineProps<{
  recurso: "paises" | "aeropuertos" | "aerolineas";
  referencia?: ReferenciaCatalogo | null;
  disabled?: boolean;
  label: string;
}>();
const modelo = defineModel<string | null>();
const buscar = ref("");
const opciones = ref<ReferenciaCatalogo[]>([]);
const cargando = ref(false);
const error = ref("");
const request = useBackendRequest();
const items = computed(() => {
  const registros =
    props.referencia &&
    !opciones.value.some((r) => r.id === props.referencia?.id)
      ? [props.referencia, ...opciones.value]
      : opciones.value;
  return registros.map((r) => ({
    value: r.id,
    label: [r.iata, r.nombre].filter(Boolean).join(" · "),
  }));
});
watch(
  [() => props.recurso, buscar],
  async (_valor, _anterior, limpiar) => {
    if (props.recurso === "paises" && opciones.value.length) return;
    const controller = new AbortController();
    limpiar(() => controller.abort());
    cargando.value = true;
    error.value = "";
    try {
      if (props.recurso === "paises")
        opciones.value = await request<ReferenciaCatalogo[]>("/paises", {
          signal: controller.signal,
        });
      else {
        const pagina = await request<{ datos: ReferenciaCatalogo[] }>(
          `/administracion/${props.recurso}`,
          {
            query: { busqueda: buscar.value, limite: 20, estado: "vigentes" },
            signal: controller.signal,
          },
        );
        opciones.value = pagina.datos;
      }
    } catch {
      if (!controller.signal.aborted)
        error.value = "No pudimos cargar las opciones.";
    } finally {
      if (!controller.signal.aborted) cargando.value = false;
    }
  },
  { immediate: true },
);
</script>

<template>
  <USelectMenu
    v-model="modelo"
    v-model:search-term="buscar"
    :items="items"
    value-key="value"
    :aria-label="label"
    :loading="cargando"
    :disabled="disabled"
    :ignore-filter="recurso !== 'paises'"
    placeholder="Seleccionar…"
    class="w-full"
    clear
  />
  <p v-if="error" role="alert" class="mt-1 text-sm text-error">{{ error }}</p>
</template>
