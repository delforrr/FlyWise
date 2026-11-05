<script setup lang="ts">
import type { FormSubmitEvent } from "@nuxt/ui";
import {
  aeropuertoSchema,
  aerolineaSchema,
  rutaSchema,
  type DatosCatalogo,
  type RecursoCatalogo,
  type RegistroCatalogo,
} from "../schemas/catalogos";
import SelectorCatalogo from "./SelectorCatalogo.vue";

const props = defineProps<{
  open: boolean;
  recurso: RecursoCatalogo;
  registro: RegistroCatalogo | null;
  guardando: boolean;
  error: string;
}>();
const emit = defineEmits<{
  "update:open": [valor: boolean];
  guardar: [datos: DatosCatalogo];
}>();
const estado = reactive({
  nombre: "",
  ciudad: "",
  paisId: null as string | null,
  iata: "",
  icao: "",
  latitud: 0,
  longitud: 0,
  actividad: "desconocida",
  origenId: null as string | null,
  destinoId: null as string | null,
});
const schema = computed(() =>
  props.recurso === "aeropuertos"
    ? aeropuertoSchema
    : props.recurso === "aerolineas"
      ? aerolineaSchema
      : rutaSchema,
);
const singular = computed(
  () =>
    ({ aeropuertos: "aeropuerto", aerolineas: "aerolínea", rutas: "ruta" })[
      props.recurso
    ],
);
watch([() => props.open, () => props.registro], ([abierta]) => {
  if (!abierta) return;
  const r = props.registro;
  Object.assign(estado, {
    nombre: r?.nombre ?? "",
    ciudad: r?.ciudad ?? "",
    paisId: r?.paisId ?? null,
    iata: r?.iata ?? "",
    icao: r?.icao ?? "",
    latitud: r?.latitud ?? 0,
    longitud: r?.longitud ?? 0,
    actividad:
      r?.activa == null ? "desconocida" : r.activa ? "activa" : "inactiva",
    origenId: r?.origenId ?? null,
    destinoId: r?.destinoId ?? null,
  });
});
function enviar(evento: FormSubmitEvent<DatosCatalogo>) {
  emit("guardar", evento.data);
}
</script>

<template>
  <UModal
    :open="open"
    :title="`${registro ? 'Editar' : 'Crear'} ${singular}`"
    description="Los cambios manuales se conservan durante las importaciones."
    :dismissible="!guardando"
    :close="!guardando"
    @update:open="emit('update:open', $event)"
  >
    <template #body>
      <UForm
        :schema="schema"
        :state="estado"
        class="space-y-4"
        @submit="enviar"
      >
        <UAlert v-if="error" color="error" :description="error" role="alert" />
        <template v-if="recurso === 'rutas'">
          <UFormField label="Origen" name="origenId" required
            ><SelectorCatalogo
              v-model="estado.origenId"
              recurso="aeropuertos"
              :referencia="registro?.origen"
              label="Aeropuerto de origen"
              :disabled="guardando || !!registro?.ofertas?.length"
          /></UFormField>
          <UFormField label="Destino" name="destinoId" required
            ><SelectorCatalogo
              v-model="estado.destinoId"
              recurso="aeropuertos"
              :referencia="registro?.destino"
              label="Aeropuerto de destino"
              :disabled="guardando || !!registro?.ofertas?.length"
          /></UFormField>
          <UAlert
            v-if="registro?.ofertas?.length"
            color="info"
            description="Esta ruta tiene ofertas: sus aeropuertos no pueden modificarse."
          />
        </template>
        <template v-else>
          <UFormField label="Nombre" name="nombre" required
            ><UInput
              v-model="estado.nombre"
              class="w-full"
              :disabled="guardando"
          /></UFormField>
          <UFormField
            v-if="recurso === 'aeropuertos'"
            label="Ciudad"
            name="ciudad"
            ><UInput
              v-model="estado.ciudad"
              class="w-full"
              :disabled="guardando"
          /></UFormField>
          <UFormField
            label="País"
            name="paisId"
            :required="recurso === 'aeropuertos'"
            ><SelectorCatalogo
              v-model="estado.paisId"
              recurso="paises"
              label="País"
              :disabled="guardando"
          /></UFormField>
          <div class="grid grid-cols-2 gap-4">
            <UFormField label="IATA" name="iata"
              ><UInput
                v-model="estado.iata"
                class="w-full"
                :disabled="guardando"
            /></UFormField>
            <UFormField label="ICAO" name="icao"
              ><UInput
                v-model="estado.icao"
                class="w-full"
                :disabled="guardando"
            /></UFormField>
          </div>
          <div v-if="recurso === 'aeropuertos'" class="grid grid-cols-2 gap-4">
            <UFormField label="Latitud" name="latitud" required
              ><UInputNumber
                v-model="estado.latitud"
                :min="-90"
                :max="90"
                :step="0.0001"
                :format-options="{ maximumFractionDigits: 7 }"
                :disabled="guardando"
                class="w-full"
            /></UFormField>
            <UFormField label="Longitud" name="longitud" required
              ><UInputNumber
                v-model="estado.longitud"
                :min="-180"
                :max="180"
                :step="0.0001"
                :format-options="{ maximumFractionDigits: 7 }"
                :disabled="guardando"
                class="w-full"
            /></UFormField>
          </div>
          <UFormField v-else label="Actividad" name="actividad"
            ><USelect
              v-model="estado.actividad"
              :items="[
                { label: 'Desconocida', value: 'desconocida' },
                { label: 'Activa', value: 'activa' },
                { label: 'Inactiva', value: 'inactiva' },
              ]"
              :disabled="guardando"
              class="w-full"
          /></UFormField>
        </template>
        <div class="flex justify-end gap-3">
          <UButton
            color="neutral"
            variant="outline"
            :disabled="guardando"
            @click="emit('update:open', false)"
            >Cancelar</UButton
          ><UButton type="submit" :loading="guardando">Guardar</UButton>
        </div>
      </UForm>
    </template>
  </UModal>
</template>
