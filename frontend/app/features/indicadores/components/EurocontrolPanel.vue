<script setup lang="ts">
import { ref, onMounted } from "vue";
import { useBackendRequest } from "~/shared/composables/useBackendRequest";
interface Indicador {
  instantaneaId: string;
  producto: string;
  atribucion: string;
  aviso: string;
  metodologia: string[][];
  uri: string;
  actualizadoEn: string;
  ambito: string;
  entidad: string;
  nombre: string;
  granularidad: string;
  desde: string;
  hasta: string;
  valores: Record<string, number | null>;
}
interface Fuente {
  producto: string;
  pausado: boolean;
  programacionUtc: string;
  ultimaEjecucion: {
    id: string;
    estado: string;
    mensaje_error: string | null;
    filas_procesadas: number;
    filas_descartadas: number;
  } | null;
}
interface Instantanea {
  id: string;
  producto: string;
  actualizadoEn: string;
}
const request = useBackendRequest();
const producto = ref("network"),
  ambito = ref(""),
  granularidad = ref("DY"),
  mes = ref(""),
  entidad = ref(""),
  instantaneaId = ref(""),
  pagina = ref(1);
const datos = ref<Indicador[]>([]),
  total = ref(0),
  fuentes = ref<Fuente[]>([]),
  instantaneas = ref<Instantanea[]>([]),
  loading = ref(false),
  error = ref(""),
  message = ref("");
async function load(reset = false) {
  if (reset) pagina.value = 1;
  loading.value = true;
  error.value = "";
  try {
    const result = await request<{ datos: Indicador[]; total: number }>(
      "/administracion/indicadores/eurocontrol",
      {
        query: {
          producto: producto.value,
          ambito: ambito.value || undefined,
          granularidad: granularidad.value || undefined,
          mes: mes.value || undefined,
          entidad: entidad.value || undefined,
          instantaneaId: instantaneaId.value || undefined,
          pagina: pagina.value,
          limite: 20,
        },
      },
    );
    datos.value = result.datos;
    total.value = result.total;
  } catch (cause) {
    error.value =
      cause instanceof Error
        ? cause.message
        : "No se pudieron consultar los indicadores";
  } finally {
    loading.value = false;
  }
}
async function refresh() {
  try {
    [fuentes.value, instantaneas.value] = await Promise.all([
      request<Fuente[]>("/administracion/indicadores/eurocontrol/fuentes"),
      request<Instantanea[]>(
        "/administracion/indicadores/eurocontrol/instantaneas",
        { query: { producto: producto.value } },
      ),
    ]);
    await load();
  } catch (cause) {
    error.value =
      cause instanceof Error
        ? cause.message
        : "No se pudo consultar la programación";
  }
}
async function changeProduct() {
  ambito.value = "";
  instantaneaId.value = "";
  pagina.value = 1;
  await refresh();
}
async function action(source: Fuente, kind: "run" | "pause" | "retry") {
  error.value = "";
  message.value = "";
  try {
    const path =
      kind === "retry"
        ? `ejecuciones/${source.ultimaEjecucion?.id}/reintentar`
        : `fuentes/${source.producto}${kind === "run" ? "/ejecutar" : ""}`;
    await request(`/administracion/indicadores/eurocontrol/${path}`, {
      method: kind === "pause" ? "PATCH" : "POST",
      ...(kind === "pause" ? { body: { pausado: !source.pausado } } : {}),
    });
    message.value =
      kind === "pause"
        ? "Programación actualizada"
        : "Ejecución encolada. Actualiza para consultar su resultado.";
    await refresh();
  } catch (cause) {
    error.value =
      cause instanceof Error ? cause.message : "No se pudo completar la acción";
  }
}
function percentage(value: number | null | undefined) {
  return value == null
    ? "—"
    : `${(value * 100).toLocaleString("es-AR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} %`;
}
function count(row: Indicador, key: string) {
  return row.valores[key] ?? row.valores[`${key}_FLIGHTS`] ?? "—";
}
onMounted(refresh);
</script>

<template>
  <section class="space-y-5" aria-labelledby="eurocontrol-title">
    <div class="flex flex-wrap justify-between gap-3 items-center">
      <div>
        <h1 id="eurocontrol-title" class="text-xl font-semibold">
          Indicadores EUROCONTROL
        </h1>
        <p class="text-sm text-text-muted">
          Puntualidad europea publicada por red, país y aeropuerto. Son
          indicadores nativos; no colorean rutas FlyWise.
        </p>
      </div>
      <button
        type="button"
        class="border border-border-subtle rounded px-3 py-2 text-sm"
        :disabled="loading"
        @click="refresh"
      >
        Actualizar
      </button>
    </div>
    <p v-if="error" role="alert" class="text-error">{{ error }}</p>
    <p v-if="message" role="status" class="text-sm">{{ message }}</p>
    <div class="overflow-x-auto border border-border-subtle rounded">
      <table class="w-full text-sm">
        <caption class="text-left p-3 font-medium">
          Cargas mensuales — primer día del mes, 04:00 UTC
        </caption>
        <thead>
          <tr class="border-y border-border-subtle">
            <th class="p-2 text-left">Fuente</th>
            <th class="p-2 text-left">Programación</th>
            <th class="p-2 text-left">Última ejecución</th>
            <th class="p-2 text-left">Acciones</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="source in fuentes"
            :key="source.producto"
            class="border-b border-border-subtle"
          >
            <td class="p-2">
              {{
                source.producto === "network"
                  ? "Red europea"
                  : "Países y aeropuertos"
              }}
            </td>
            <td class="p-2">
              {{ source.pausado ? "Pausada" : "Mensual UTC" }}
            </td>
            <td class="p-2">
              {{ source.ultimaEjecucion?.estado ?? "Sin ejecuciones"
              }}<span
                v-if="source.ultimaEjecucion"
                class="block text-xs text-text-muted"
                >{{ source.ultimaEjecucion.filas_procesadas }} indicadores ·
                {{ source.ultimaEjecucion.filas_descartadas }} descartes</span
              ><span
                v-if="source.ultimaEjecucion?.mensaje_error"
                class="block text-error"
                >{{ source.ultimaEjecucion.mensaje_error }}</span
              >
            </td>
            <td class="p-2">
              <div class="flex flex-wrap gap-2">
                <button
                  type="button"
                  class="underline"
                  @click="action(source, 'run')"
                >
                  Importar ahora</button
                ><button
                  type="button"
                  class="underline"
                  @click="action(source, 'pause')"
                >
                  {{ source.pausado ? "Programar" : "Pausar" }}</button
                ><button
                  v-if="source.ultimaEjecucion?.estado === 'failed'"
                  type="button"
                  class="underline"
                  @click="action(source, 'retry')"
                >
                  Reintentar
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <form class="flex flex-wrap items-end gap-3" @submit.prevent="load(true)">
      <label class="text-sm"
        >Producto<select
          v-model="producto"
          aria-label="Producto"
          class="block border border-border-subtle rounded bg-surface-card p-2"
          @change="changeProduct"
        >
          <option value="network">Red europea</option>
          <option value="stakeholder">Países y aeropuertos</option>
        </select></label
      >
      <label class="text-sm"
        >Ámbito<select
          v-model="ambito"
          aria-label="Ámbito"
          class="block border border-border-subtle rounded bg-surface-card p-2"
        >
          <option value="">Todos</option>
          <option v-if="producto === 'network'" value="NETWORK">Red</option>
          <template v-else
            ><option value="COUNTRY">País</option>
            <option value="AIRPORT">Aeropuerto</option></template
          >
        </select></label
      >
      <label class="text-sm"
        >Período<select
          v-model="granularidad"
          aria-label="Granularidad"
          class="block border border-border-subtle rounded bg-surface-card p-2"
        >
          <option value="">Todos</option>
          <option value="DY">Diario (DY)</option>
          <option value="WK">Semana móvil (WK)</option>
          <option v-if="producto === 'stakeholder'" value="Y2D">
            Acumulado anual (Y2D)
          </option>
        </select></label
      >
      <label class="text-sm"
        >Mes de cierre<input
          v-model="mes"
          type="month"
          aria-label="Mes de cierre"
          class="block border border-border-subtle rounded bg-surface-card p-2"
      /></label>
      <label class="text-sm"
        >Entidad nativa<input
          v-model="entidad"
          aria-label="Entidad nativa"
          placeholder="Código ICAO o país exacto"
          class="block border border-border-subtle rounded bg-surface-card p-2"
      /></label>
      <label class="text-sm"
        >Instantánea<select
          v-model="instantaneaId"
          aria-label="Instantánea"
          class="block border border-border-subtle rounded bg-surface-card p-2 max-w-64"
        >
          <option value="">Última completa</option>
          <option
            v-for="snapshot in instantaneas"
            :key="snapshot.id"
            :value="snapshot.id"
          >
            {{ snapshot.actualizadoEn }}
          </option>
        </select></label
      >
      <button
        type="submit"
        class="border border-border-subtle rounded px-3 py-2 text-sm"
        :disabled="loading"
      >
        Consultar
      </button>
    </form>
    <p class="text-sm text-text-muted">
      Cada bloque DY/WK/Y2D conserva su propia entidad y período.
      «Programaciones no operadas» es el contador nativo MISSING_SCHED_FLIGHTS.
      No son cancelaciones.
    </p>
    <p v-if="loading" role="status">Consultando indicadores…</p>
    <div v-else class="overflow-x-auto border border-border-subtle rounded">
      <table class="w-full text-sm">
        <thead>
          <tr class="border-b border-border-subtle">
            <th class="p-2 text-left">Entidad</th>
            <th class="p-2 text-left">Período observado</th>
            <th class="p-2 text-right">Llegada puntual</th>
            <th class="p-2 text-right">Salida puntual</th>
            <th class="p-2 text-right">Arribos puntuales</th>
            <th class="p-2 text-right">Arribos programados</th>
            <th class="p-2 text-right">Programaciones no operadas</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="row in datos"
            :key="`${row.instantaneaId}-${row.ambito}-${row.entidad}-${row.granularidad}-${row.hasta}`"
            class="border-b border-border-subtle"
          >
            <td class="p-2">
              {{ row.nombre
              }}<span class="block text-xs text-text-muted"
                >{{ row.entidad }} · {{ row.ambito
                }}<template v-if="row.valores.RANK != null">
                  · Puesto {{ row.valores.RANK }}</template
                ></span
              >
            </td>
            <td class="p-2 whitespace-nowrap">
              {{ row.granularidad }} · {{ row.desde }} — {{ row.hasta }}
            </td>
            <td class="p-2 text-right tabular-nums">
              {{ percentage(row.valores.ARR_PUN) }}
            </td>
            <td class="p-2 text-right tabular-nums">
              {{ percentage(row.valores.DEP_PUN) }}
            </td>
            <td class="p-2 text-right tabular-nums">
              {{ count(row, "ARR_PUNCTUAL") }}
            </td>
            <td class="p-2 text-right tabular-nums">
              {{ count(row, "ARR_SCHED") }}
            </td>
            <td class="p-2 text-right tabular-nums">
              {{ count(row, "MISSING_SCHED") }}
            </td>
          </tr>
          <tr v-if="!datos.length">
            <td colspan="7" class="p-8 text-center text-text-muted">
              No hay indicadores completos para estos filtros.
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <div class="flex justify-between text-sm items-center">
      <p>{{ total }} indicadores · Página {{ pagina }}</p>
      <div class="flex gap-3">
        <button
          type="button"
          :disabled="pagina <= 1 || loading"
          @click="
            pagina--;
            load();
          "
        >
          Anterior</button
        ><button
          type="button"
          :disabled="pagina * 20 >= total || loading"
          @click="
            pagina++;
            load();
          "
        >
          Siguiente
        </button>
      </div>
    </div>
    <details v-if="datos[0]" class="border-t border-border-subtle pt-3 text-sm">
      <summary class="cursor-pointer">
        EUROCONTROL — atribución, metodología y contadores nativos
      </summary>
      <p class="py-2">
        {{ datos[0].atribucion }} · Actualizado {{ datos[0].actualizadoEn }}
      </p>
      <a
        :href="datos[0].uri"
        target="_blank"
        rel="noopener noreferrer"
        class="underline"
        >Archivo oficial</a
      >
      <p class="whitespace-pre-wrap py-3">{{ datos[0].aviso }}</p>
      <ul class="space-y-1">
        <li v-for="(row, index) in datos[0].metodologia" :key="index">
          {{ row.join(" — ") }}
        </li>
      </ul>
      <details
        v-for="row in datos"
        :key="`${row.entidad}-${row.granularidad}-${row.hasta}`"
        class="mt-2"
      >
        <summary>
          {{ row.entidad }} · {{ row.granularidad }} · {{ row.hasta }} — valores
          publicados
        </summary>
        <dl class="grid grid-cols-2 gap-x-4">
          <template v-for="(value, key) in row.valores" :key="key"
            ><dt>{{ key }}</dt>
            <dd class="text-right tabular-nums">
              {{ value ?? "—" }}
            </dd></template
          >
        </dl>
      </details>
    </details>
  </section>
</template>
