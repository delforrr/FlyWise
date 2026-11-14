<script setup lang="ts">
import AirportSelectInput from '~/features/route-audit/components/search/AirportSelectInput.vue';
import { useOagAdmin } from '../composables/useOagAdmin';

const { config, guardada, jobs, busy, error, notice, valid, canRun, airportName, refresh, save, run } = useOagAdmin();
const estados = { pending: 'En cola', running: 'En curso', completed: 'Completada', failed: 'Fallida' };
const numero = new Intl.NumberFormat('es-AR');
</script>

<template>
  <section class="space-y-6" :aria-busy="busy">
    <header>
      <h1 class="text-2xl font-semibold">Carga de OTP con OAG</h1>
      <p class="mt-1 text-sm text-text-muted">Importá operaciones de un tramo y mes para calcular la puntualidad.</p>
    </header>

    <p v-if="error" role="alert" class="text-sm text-error">{{ error }}</p>
    <p v-if="notice" role="status" class="text-sm">{{ notice }}</p>

    <UCard v-if="guardada">
      <form aria-label="Configurar OAG" class="space-y-4" @submit.prevent="save">
        <div class="grid gap-4 sm:grid-cols-2">
          <UFormField label="Origen" required>
            <AirportSelectInput v-model="config.origenId" mode="drawer" placeholder="Seleccioná el origen" :disabled="busy" />
          </UFormField>
          <UFormField label="Destino" required>
            <AirportSelectInput v-model="config.destinoId" mode="drawer" placeholder="Seleccioná el destino" :disabled="busy" />
          </UFormField>
          <UFormField label="Mes observado" required>
            <UInput v-model="config.periodo" type="month" placeholder="AAAA-MM" class="w-full" :disabled="busy" required />
          </UFormField>
          <UFormField label="Cobertura mínima (%)" required>
            <UInput v-model.number="config.coberturaMinimaPct" type="number" min="1" max="100" class="w-full" :disabled="busy" required />
          </UFormField>
        </div>
        <USwitch v-model="config.pausado" label="Ingesta pausada" :disabled="busy" />
        <div class="flex flex-wrap gap-2">
          <UButton type="submit" color="neutral" variant="outline" :disabled="busy || !valid">Guardar configuración</UButton>
          <UButton type="button" icon="i-lucide-download" :disabled="busy || !canRun" @click="run">Ejecutar carga</UButton>
        </div>
      </form>
    </UCard>

    <section aria-labelledby="oag-jobs">
      <div class="flex flex-wrap items-center justify-between gap-4">
        <h2 id="oag-jobs" class="text-lg font-semibold">Últimas ejecuciones</h2>
        <UButton color="neutral" variant="outline" :disabled="busy" @click="refresh">Actualizar</UButton>
      </div>
      <p v-if="!jobs.length && guardada" class="py-4 text-sm text-text-muted">Aún no se registraron ejecuciones.</p>
      <ul v-else class="divide-y divide-border-subtle">
        <li v-for="job in jobs" :key="job.id" class="space-y-1 py-3">
          <p class="break-words">
            <strong>{{ job.origenCodigo ?? airportName(job.origenId) }} → {{ job.destinoCodigo ?? airportName(job.destinoId) }}</strong>
            · {{ job.periodo }} · {{ estados[job.estado] }}
          </p>
          <p class="text-sm text-text-muted tabular-nums">
            {{ numero.format(job.filasProcesadas) }} / {{ numero.format(job.filasTotales) }} procesadas
            · {{ numero.format(job.filasDescartadas) }} descartadas
          </p>
          <p v-if="job.mensajeError" class="text-sm text-error">{{ job.mensajeError }}</p>
        </li>
      </ul>
    </section>
  </section>
</template>
