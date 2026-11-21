<script setup lang="ts">
import { computed, ref } from 'vue';
import AirportSelectInput from '~/features/route-audit/components/search/AirportSelectInput.vue';
import { mapCatalogAirport, useCatalog, type CatalogAirport } from '~/shared/composables/useCatalog';
import { useEtlData } from '../composables/useEtlData';
import type { ProcesoEtl, ServicioOperaciones } from '../types/etl';

const props = defineProps<{ servicio: ProcesoEtl | null }>();
const emit = defineEmits<{ close: [] }>();
const { request, refresh } = useEtlData();
const { rememberAirport } = useCatalog();
const nombre = ref(props.servicio?.nombre ?? '');
const pausado = ref(props.servicio?.pausado ?? true);
const cron = ref(props.servicio?.configuracionProgramacion?.expresionCron ?? '');
const config = ref<ServicioOperaciones>({
  proveedor: 'OAG',
  periodo: '',
  coberturaMinimaPct: 90,
  ...props.servicio?.operacion,
});
let siguienteTramo = 0;
const tramos = ref(
  (config.value.tramos ?? [{ origenId: config.value.origenId, destinoId: config.value.destinoId }])
    .map((tramo) => ({ ...tramo, id: siguienteTramo++ })),
);
const guardando = ref(false);
const valido = computed(() => {
  const { proveedor, periodo, coberturaMinimaPct } = config.value;
  return Boolean(nombre.value.trim() && periodo && (proveedor === 'BTS' ||
    (coberturaMinimaPct && tramos.value.every(({ origenId, destinoId }) => origenId && destinoId && origenId !== destinoId))));
});

for (const id of new Set(tramos.value.flatMap(({ origenId, destinoId }) => [origenId, destinoId]))) {
  if (id) void request<Omit<CatalogAirport, 'cantidadRutas'>>(`/administracion/aeropuertos/${id}`)
    .then((airport) => rememberAirport(mapCatalogAirport({ ...airport, cantidadRutas: 0 })))
    .catch(() => undefined);
}

async function guardar() {
  if (guardando.value || !valido.value) return;
  guardando.value = true;
  try {
    const { proveedor, periodo, coberturaMinimaPct } = config.value;
    const id = props.servicio?.id;
    await request(`/etl/procesos/operaciones${id ? `/${id}` : ''}`, {
      method: id ? 'PATCH' : 'POST',
      body: {
        nombre: nombre.value,
        pausado: pausado.value,
        proveedor,
        periodo,
        ...(config.value.programable && { expresionCron: cron.value }),
        ...(proveedor === 'OAG' && {
          tramos: tramos.value.map(({ origenId, destinoId }) => ({ origenId, destinoId })),
          coberturaMinimaPct,
        }),
      },
    });
    emit('close');
    await refresh();
  } catch {
    // useBackendRequest muestra el error y el formulario conserva los valores.
  } finally {
    guardando.value = false;
  }
}
</script>

<template>
  <UModal :open="true" :title="servicio ? 'Editar servicio de operaciones' : 'Nuevo servicio de operaciones'"
    @update:open="open => { if (!open) emit('close') }">
    <template #body>
      <form class="space-y-4" @submit.prevent="guardar">
        <UFormField label="Nombre" required>
          <UInput v-model="nombre" maxlength="120" class="w-full" required />
        </UFormField>
        <UFormField label="Proveedor" required>
          <USelect v-model="config.proveedor" :disabled="servicio?.esSistema" :items="[
            { label: 'OAG · Operaciones por tramo', value: 'OAG' },
            { label: 'BTS · Operaciones de EE. UU. por mes', value: 'BTS' },
          ]" class="w-full" />
        </UFormField>
        <UFormField label="Mes cerrado" required>
          <UInput v-model="config.periodo" type="month" class="w-full" required />
        </UFormField>
        <template v-if="config.proveedor === 'OAG'">
          <fieldset v-for="(tramo, indice) in tramos" :key="tramo.id" class="grid gap-2 sm:grid-cols-2">
            <legend class="mb-1 text-sm font-medium">Tramo {{ indice + 1 }}</legend>
            <UFormField label="Origen" required>
              <AirportSelectInput v-model="tramo.origenId" mode="drawer" placeholder="Seleccioná el origen" />
            </UFormField>
            <UFormField label="Destino" required>
              <AirportSelectInput v-model="tramo.destinoId" mode="drawer" placeholder="Seleccioná el destino" />
            </UFormField>
            <UButton v-if="tramos.length > 1" type="button" size="sm" color="error" variant="ghost"
              @click="tramos.splice(indice, 1)">Quitar tramo {{ indice + 1 }}</UButton>
          </fieldset>
          <UButton type="button" variant="outline" color="neutral" :disabled="tramos.length >= 20"
            icon="i-lucide-plus" @click="tramos.push({ id: siguienteTramo++, origenId: undefined, destinoId: undefined })">Agregar tramo</UButton>
          <UFormField label="Cobertura mínima (%)" required>
            <UInput v-model.number="config.coberturaMinimaPct" type="number" min="1" max="100" required />
          </UFormField>
        </template>
        <UFormField v-if="config.programable" label="Cron mensual (UTC)"
          description="Usa el último mes cerrado del mapa. Vacío deja habilitada solo la carga manual.">
          <UInput v-model="cron" placeholder="0 4 15 * *" maxlength="100" class="w-full" />
        </UFormField>
        <USwitch v-model="pausado" label="Pausado" />
        <div class="flex flex-wrap justify-end gap-2">
          <UButton type="button" color="neutral" variant="outline" @click="emit('close')">Cancelar</UButton>
          <UButton type="submit" :loading="guardando" :disabled="!valido">Guardar</UButton>
        </div>
      </form>
    </template>
  </UModal>
</template>
