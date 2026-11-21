<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useSourceIdentities, type PendingIdentity } from '../composables/useSourceIdentities';
const { identities, options, loading, searching, searchTerm, error, pagina, verRechazadas, changePage, load, resolve, reject, rejectAll } = useSourceIdentities();
const selected = ref<Record<string, string>>({});
const saving = ref(false);
const confirmandoMasivo = ref(false);
const notice = ref('');
const clave = (identity: PendingIdentity) => `${identity.fuente}:${identity.identificador}`;
async function confirm(identity: PendingIdentity) {
  const id = selected.value[clave(identity)];
  if (!id) return;
  saving.value = true;
  notice.value = '';
  try {
    await resolve(identity, id);
    delete selected.value[clave(identity)];
    notice.value = 'Correspondencia guardada.';
  } catch { /* Request reports mutation failures through the shared toast. */ }
  finally { saving.value = false; }
}
async function cambiarRechazo(identity: PendingIdentity, rechazado: boolean) {
  saving.value = true;
  notice.value = '';
  try {
    await reject(identity, rechazado);
    delete selected.value[clave(identity)];
    notice.value = rechazado
      ? 'Correspondencia rechazada. No volverá a aparecer como pendiente.'
      : 'Correspondencia restaurada.';
  } catch { /* Request reports mutation failures through the shared toast. */ }
  finally { saving.value = false; }
}
async function toggleVista() {
  verRechazadas.value = !verRechazadas.value;
  pagina.value = 1;
  confirmandoMasivo.value = false;
  notice.value = '';
  await load();
}
async function rechazarTodo() {
  saving.value = true;
  notice.value = '';
  try {
    pagina.value = 1;
    const { rechazadas } = await rejectAll();
    confirmandoMasivo.value = false;
    selected.value = {};
    notice.value = rechazadas
      ? `Se rechazaron ${rechazadas} correspondencias. Podés recuperarlas desde «Ver rechazadas».`
      : 'No había correspondencias pendientes para rechazar.';
  } catch { /* Request reports mutation failures through the shared toast. */ }
  finally { saving.value = false; }
}
onMounted(load);
</script>

<template>
  <UCard>
    <template #header>
      <div class="flex flex-wrap items-center justify-between gap-3">
        <h2 class="text-base font-semibold">
          {{ verRechazadas ? 'Correspondencias rechazadas' : 'Correspondencias pendientes' }}
        </h2>
        <div class="flex flex-wrap items-center gap-2">
          <UButton v-if="!verRechazadas" color="error" variant="outline" :disabled="loading || saving" @click="confirmandoMasivo = true">Rechazar todo</UButton>
          <UButton color="neutral" variant="ghost" :disabled="loading || saving" @click="toggleVista">
            {{ verRechazadas ? 'Ver pendientes' : 'Ver rechazadas' }}
          </UButton>
          <UButton variant="ghost" color="neutral" :loading="loading" @click="load">Actualizar</UButton>
        </div>
      </div>
    </template>
    <p v-if="error" role="alert" class="text-sm text-error">{{ error }}</p>
    <p v-if="notice" role="status" class="text-sm">{{ notice }}</p>
    <p v-else-if="!identities.length" class="text-sm text-text-muted">
      <template v-if="verRechazadas">No hay correspondencias rechazadas.</template>
      <template v-else>
        {{ pagina === 1
          ? 'No hay aeropuertos pendientes de vincular.'
          : 'No hay correspondencias en esta página.' }}
        Las coincidencias ambiguas de los catálogos aparecerán aquí.
      </template>
    </p>
    <div v-if="confirmandoMasivo" role="alertdialog" aria-label="Confirmar rechazo masivo" class="mb-4 rounded-md border border-error/40 bg-error/5 p-3 text-sm">
      <p class="font-medium">¿Rechazar todas las correspondencias pendientes?</p>
      <p class="text-text-muted">
        Se rechazarán todas las identidades pendientes de OurAirports y OpenFlights, no solo las de esta página. Podés restaurarlas después desde «Ver rechazadas».
      </p>
      <div class="mt-3 flex flex-wrap gap-2">
        <UButton color="error" :loading="saving" @click="rechazarTodo">Confirmar rechazo</UButton>
        <UButton color="neutral" variant="ghost" :disabled="saving" @click="confirmandoMasivo = false">Cancelar</UButton>
      </div>
    </div>
    <div v-for="identity in identities" :key="clave(identity)" class="flex flex-wrap items-center gap-3 py-3 border-b border-border-subtle last:border-0">
      <div class="min-w-48 flex-1">
        <p class="font-medium">{{ identity.observacion.nombre }}</p>
        <p class="text-sm text-text-muted">{{ identity.fuente }} · {{ identity.observacion.iata ?? identity.observacion.icao ?? 'Sin código' }}</p>
      </div>
      <template v-if="verRechazadas">
        <UButton color="neutral" variant="outline" :disabled="saving" @click="cambiarRechazo(identity, false)">Restaurar</UButton>
      </template>
      <template v-else>
        <USelectMenu
          v-model="selected[clave(identity)]"
          v-model:search-term="searchTerm"
          :items="options"
          :loading="searching"
          ignore-filter
          value-key="value"
          placeholder="Buscar aeropuerto para vincular"
          class="w-full sm:w-80"
        >
          <template #empty><span class="text-sm text-text-muted">Sin coincidencias. Probá con otro código o nombre.</span></template>
        </USelectMenu>
        <UButton color="neutral" :disabled="!selected[clave(identity)] || saving" :loading="saving" @click="confirm(identity)">Vincular</UButton>
        <UButton color="error" variant="ghost" :disabled="saving" @click="cambiarRechazo(identity, true)">Rechazar</UButton>
      </template>
    </div>
    <div v-if="identities.length || pagina > 1" class="flex items-center justify-end gap-3 mt-4">
      <span class="text-sm text-text-muted">Página {{ pagina }}</span>
      <UButton color="neutral" variant="ghost" :disabled="pagina === 1 || loading" @click="changePage(-1)">Anterior</UButton>
      <UButton color="neutral" variant="ghost" :disabled="identities.length < 20 || loading" @click="changePage(1)">Siguiente</UButton>
    </div>
  </UCard>
</template>
