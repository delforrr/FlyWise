<script setup lang="ts">
import { MAP_CONTINENTS, type GlobalMapFilter } from '../composables/useGlobalMap';

const emit = defineEmits<{ apply: [filter: GlobalMapFilter] }>();
const { filter, isOpen, paises, countriesLoading, countriesError, loadCountries } = useGlobalMap();
const draft = ref<GlobalMapFilter>({ ...filter.value });
const modes = [
  { value: 'global', label: 'Todo el mundo', descripcion: 'Explora la red global.', icon: 'i-lucide-globe-2' },
  { value: 'domestic', label: 'Dentro de un país', descripcion: 'Conexiones nacionales.', icon: 'i-lucide-map-pin' },
  { value: 'paises', label: 'Entre países', descripcion: 'Elige origen y destino.', icon: 'i-lucide-route' },
  { value: 'continents', label: 'Entre continentes', descripcion: 'Conecta dos regiones.', icon: 'i-lucide-earth' },
];
const limits = [10, 20, 50, 100].map(value => ({ value, label: `Top ${value}` }));
const valid = computed(() => {
  const d = draft.value;
  if (d.mode === 'domestic') return Boolean(d.paisOrigenId);
  if (d.mode === 'paises') return Boolean(d.paisOrigenId && d.paisDestinoId && d.paisOrigenId !== d.paisDestinoId);
  if (d.mode === 'continents') return Boolean(d.continenteOrigen && d.continenteDestino && d.continenteOrigen !== d.continenteDestino);
  return true;
});
watch(isOpen, (open) => {
  if (!open) return;
  draft.value = { ...filter.value };
  void loadCountries();
}, { immediate: true });

function apply() {
  if (!valid.value) return;
  const { mode, limit, paisOrigenId, paisDestinoId, continenteOrigen, continenteDestino } = draft.value;
  emit('apply', {
    mode, limit,
    ...(mode === 'domestic' || mode === 'paises' ? { paisOrigenId } : {}),
    ...(mode === 'paises' ? { paisDestinoId } : {}),
    ...(mode === 'continents' ? { continenteOrigen, continenteDestino } : {}),
  });
}
</script>

<template>
  <UModal v-model:open="isOpen" title="Configura tu exploración"
    description="Elige una zona y cuántas conexiones quieres ver en el mapa."
    :ui="{ content: 'bg-surface-card text-text-main rounded-2xl ring-1 ring-border-subtle sm:max-w-xl', header: 'border-b border-border-subtle', body: 'space-y-6', footer: 'flex-col-reverse sm:flex-row sm:justify-end gap-3 border-t border-border-subtle bg-surface-accent/50' }">
    <template #body>
      <fieldset>
        <legend class="mb-3 text-sm font-semibold">Zona de búsqueda</legend>
        <div class="grid grid-cols-1 min-[360px]:grid-cols-2 gap-3">
          <label v-for="mode in modes" :key="mode.value" class="relative cursor-pointer">
            <input v-model="draft.mode" type="radio" name="map-zone" :value="mode.value" class="peer sr-only" :aria-label="mode.label" :aria-describedby="`map-zone-${mode.value}-help`" />
            <span class="flex h-full flex-col gap-2 rounded-xl border border-border-subtle bg-surface-accent/40 p-3 text-text-main transition-colors motion-reduce:transition-none hover:border-primary/60 peer-checked:border-primary peer-checked:bg-primary/10 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-primary">
              <span class="flex items-center justify-between">
                <UIcon :name="mode.icon" class="size-5 text-primary" aria-hidden="true" />
                <UIcon name="i-lucide-circle-check" class="size-4 text-primary" :class="draft.mode === mode.value ? 'opacity-100' : 'opacity-0'" aria-hidden="true" />
              </span>
              <span class="min-w-0">
                <span class="block text-sm font-semibold">{{ mode.label }}</span>
                <span :id="`map-zone-${mode.value}-help`" class="mt-1 block text-xs leading-relaxed text-text-muted">{{ mode.descripcion }}</span>
              </span>
            </span>
          </label>
        </div>
      </fieldset>
      <div v-if="draft.mode === 'domestic' || draft.mode === 'paises'" class="grid grid-cols-1 sm:grid-cols-2 gap-4 rounded-xl border border-border-subtle bg-surface-accent/40 p-4">
        <UFormField :label="draft.mode === 'domestic' ? 'País' : 'País de origen'" name="originCountry" required>
          <USelectMenu v-model="draft.paisOrigenId" :items="paises" value-key="id" label-key="nombre"
            :loading="countriesLoading" placeholder="Buscar país" size="lg" icon="i-lucide-map-pin" class="w-full" />
        </UFormField>
        <UFormField v-if="draft.mode === 'paises'" label="País de destino" name="destinationCountry" required>
          <USelectMenu v-model="draft.paisDestinoId" :items="paises.filter(c => c.id !== draft.paisOrigenId)" value-key="id" label-key="nombre"
            :loading="countriesLoading" placeholder="Buscar país" size="lg" icon="i-lucide-map-pin" class="w-full" />
        </UFormField>
        <div v-if="countriesError" role="alert" class="sm:col-span-2 text-sm text-error">
          <p>{{ countriesError }}</p>
          <UButton label="Reintentar países" variant="ghost" color="neutral" @click="loadCountries" />
        </div>
      </div>
      <div v-if="draft.mode === 'continents'" class="grid grid-cols-1 sm:grid-cols-2 gap-4 rounded-xl border border-border-subtle bg-surface-accent/40 p-4">
        <UFormField label="Continente de origen" name="continenteOrigen" required>
          <USelectMenu v-model="draft.continenteOrigen" :items="MAP_CONTINENTS" value-key="value" placeholder="Buscar continente" size="lg" class="w-full" />
        </UFormField>
        <UFormField label="Continente de destino" name="continenteDestino" required>
          <USelectMenu v-model="draft.continenteDestino" :items="MAP_CONTINENTS.filter(c => c.value !== draft.continenteOrigen)" value-key="value" placeholder="Buscar continente" size="lg" class="w-full" />
        </UFormField>
        <p class="sm:col-span-2 text-xs leading-relaxed text-text-muted">América del Norte incluye Centroamérica y el Caribe.</p>
      </div>
      <p v-if="draft.mode === 'paises' || draft.mode === 'continents'" class="text-xs leading-relaxed text-text-muted">
        Mostramos conexiones desde el origen hacia el destino. Al abrirlas podrás consultar sus aerolíneas y la vuelta, si está disponible.
      </p>
      <fieldset aria-describedby="map-limit-help" class="border-t border-border-subtle pt-5">
        <legend class="pr-3 text-sm font-semibold">Cantidad de conexiones</legend>
        <div class="grid grid-cols-4 gap-2">
          <label v-for="limit in limits" :key="limit.value" class="cursor-pointer">
            <input v-model="draft.limit" type="radio" name="map-limit" :value="limit.value" class="peer sr-only" />
            <span class="flex min-h-11 items-center justify-center rounded-lg border border-border-subtle text-sm font-semibold tabular-nums transition-colors motion-reduce:transition-none hover:border-primary/60 peer-checked:border-primary peer-checked:bg-primary peer-checked:text-on-primary peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-primary">{{ limit.label }}</span>
          </label>
        </div>
        <p id="map-limit-help" class="mt-3 text-xs leading-relaxed text-text-muted">Hasta {{ draft.limit }} conexiones, ordenadas por conectividad de sus aeropuertos, no por cantidad de vuelos. Solo verás los aeropuertos de esas conexiones.</p>
      </fieldset>
      <p v-if="!valid" role="status" class="text-sm text-text-muted">{{ draft.mode === 'domestic' ? 'Selecciona un país para explorar sus conexiones nacionales.' : 'Completa el origen y el destino con ubicaciones diferentes para aplicar los filtros.' }}</p>
    </template>
    <template #footer>
      <UButton label="Cancelar" color="neutral" variant="ghost" class="min-h-11 w-full justify-center sm:w-auto" @click="isOpen = false" />
      <UButton label="Aplicar filtros" icon="i-lucide-check" color="primary" class="min-h-11 w-full justify-center sm:w-auto" :disabled="!valid" @click="apply" />
    </template>
  </UModal>
</template>
