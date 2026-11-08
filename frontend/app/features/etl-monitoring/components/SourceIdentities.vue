<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useSourceIdentities, type PendingIdentity } from '../composables/useSourceIdentities';
const { identities, options, loading, error, pagina, changePage, load, search, resolve } = useSourceIdentities();
const selected = ref<Record<string, string>>({});
const saving = ref(false);
async function confirm(identity: PendingIdentity) {
  const id = selected.value[`${identity.fuente}:${identity.identificador}`];
  if (!id) return;
  saving.value = true;
  try { await resolve(identity, id); } catch { /* Request reports mutation failures through the shared toast. */ }
  finally { saving.value = false; }
}
onMounted(load);
</script>

<template>
  <UCard>
    <template #header><div class="flex items-center justify-between gap-3"><h2 class="text-base font-semibold">Correspondencias pendientes</h2><UButton variant="ghost" color="neutral" :loading="loading" @click="load">Actualizar</UButton></div></template>
    <p v-if="error" role="alert" class="text-sm text-error">{{ error }}</p>
    <p v-else-if="!identities.length" class="text-sm text-text-muted">{{ pagina === 1 ? 'No hay aeropuertos pendientes de vincular.' : 'No hay correspondencias en esta página.' }} Las coincidencias ambiguas de los catálogos aparecerán aquí.</p>
    <div v-for="identity in identities" :key="`${identity.fuente}:${identity.identificador}`" class="flex flex-wrap items-center gap-3 py-3 border-b border-border-subtle last:border-0">
      <div class="min-w-48 flex-1"><p class="font-medium">{{ identity.observacion.nombre }}</p><p class="text-sm text-text-muted">{{ identity.fuente }} · {{ identity.observacion.iata ?? identity.observacion.icao ?? 'Sin código' }}</p></div>
      <USelectMenu v-model="selected[`${identity.fuente}:${identity.identificador}`]" :items="options" ignore-filter value-key="value" placeholder="Buscar aeropuerto para vincular" class="w-full sm:w-80" @update:search-term="search" />
      <UButton color="neutral" :disabled="!selected[`${identity.fuente}:${identity.identificador}`]" :loading="saving" @click="confirm(identity)">Vincular</UButton>
    </div>
    <div v-if="identities.length || pagina > 1" class="flex items-center justify-end gap-3 mt-4"><span class="text-sm text-text-muted">Página {{ pagina }}</span><UButton color="neutral" variant="ghost" :disabled="pagina === 1 || loading" @click="changePage(-1)">Anterior</UButton><UButton color="neutral" variant="ghost" :disabled="identities.length < 20 || loading" @click="changePage(1)">Siguiente</UButton></div>
  </UCard>
</template>
