<script setup lang="ts">
import ActividadAnac from "~/features/actividad/ActividadAnac.vue";
import EurocontrolPanel from "~/features/indicadores/components/EurocontrolPanel.vue";

definePageMeta({ layout: "admin", middleware: "administrador" });
useSeoMeta({ title: "FlyWise — Indicadores" });

const fuentes = [
  {
    id: "anac",
    nombre: "ANAC — Actividad aeroportuaria",
    descripcion: "Movimientos mensuales por aeropuerto, operador y clasificación.",
    icono: "i-lucide-plane-landing",
    disponible: true,
  },
  {
    id: "eurocontrol",
    nombre: "EUROCONTROL — Puntualidad",
    descripcion: "Puntualidad publicada por red, país y aeropuerto.",
    icono: "i-lucide-chart-line",
    disponible: true,
  },
  {
    id: "oag",
    nombre: "OAG — Puntualidad por tramo",
    descripcion: "Operaciones programadas y cumplimiento por origen, destino y mes.",
    icono: "i-lucide-calendar-clock",
    disponible: false,
  },
] as const;
</script>

<template>
  <section class="space-y-5">
    <header>
      <h1 class="text-xl font-semibold">Indicadores</h1>
      <p class="text-sm text-text-muted">
        Fuentes de actividad y puntualidad. Expandí una fila para consultar sus
        filtros, datos e historial.
      </p>
    </header>

    <div
      class="divide-y divide-border-subtle overflow-hidden rounded-lg border border-border-subtle bg-surface-card"
    >
      <UCollapsible
        v-for="fuente in fuentes"
        :key="fuente.id"
        :disabled="!fuente.disponible"
        :default-open="fuente.id === 'anac'"
      >
        <template #default="{ open }">
          <button
            type="button"
            class="flex w-full items-center gap-3 px-4 py-4 text-left transition-colors enabled:hover:bg-surface-accent disabled:cursor-not-allowed disabled:opacity-60 sm:px-5"
            :disabled="!fuente.disponible"
          >
            <span
              class="flex size-9 shrink-0 items-center justify-center rounded-md bg-surface-accent text-text-muted"
            >
              <UIcon :name="fuente.icono" class="size-5" />
            </span>
            <span class="min-w-0 flex-1">
              <span class="flex flex-wrap items-center gap-2">
                <span class="font-medium">{{ fuente.nombre }}</span>
                <UBadge
                  v-if="!fuente.disponible"
                  color="neutral"
                  variant="subtle"
                  size="sm"
                >
                  Próximamente
                </UBadge>
              </span>
              <span class="mt-0.5 block text-sm text-text-muted">
                {{ fuente.descripcion }}
              </span>
            </span>
            <UIcon
              v-if="fuente.disponible"
              name="i-lucide-chevron-down"
              class="size-5 shrink-0 text-text-muted transition-transform duration-200"
              :class="open ? 'rotate-180' : ''"
            />
          </button>
        </template>
        <template #content>
          <div class="border-t border-border-subtle px-4 pb-6 pt-5 sm:px-5">
            <ActividadAnac v-if="fuente.id === 'anac'" embedded />
            <EurocontrolPanel v-else-if="fuente.id === 'eurocontrol'" embedded />
          </div>
        </template>
      </UCollapsible>
    </div>
  </section>
</template>
