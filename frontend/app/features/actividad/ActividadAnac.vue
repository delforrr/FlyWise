<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useBackendRequest } from "~/shared/composables/useBackendRequest";

interface Movimiento {
  numeroFila?: number;
  fechaUtc?: string;
  movimiento?: string;
  aeropuerto?: string;
  origen: string;
  destino: string;
  operador: string;
  clasificacion: string;
  pasajeros: number | null;
  pax?: number | null;
  calidad?: string;
  movimientosSalida?: number;
}
interface Resumen {
  clasificacion: string;
  movimientos: number;
  despegues: number;
  aterrizajes: number;
  pasajeros: number | null;
  pax: number | null;
  movimientosConPasajeros: number;
  movimientosConPax: number;
}
interface Revision {
  id?: string;
  revisionId?: string;
  estado: string;
  actualizadoEn: string;
  filasProcesadas: number;
  filasDescartadas?: number;
  uri: string;
  checksum?: string;
  vigente?: boolean;
}
interface Resultado {
  datos: Movimiento[];
  total: number;
  resumen: Resumen[];
  cobertura: Revision | null;
  fuente: string;
}
interface Ejecucion {
  id: string;
  estado: string;
  iniciadoEn: string | null;
  filasProcesadas: number;
  filasDescartadas: number;
  mensajeError: string | null;
  intento: number;
  instantaneaConfiguracion: { conexion: { periodo: string } };
}
interface Identidad {
  codigo: string;
  aeropuertoId: string | null;
  nombre: string | null;
}
interface Muestra {
  numeroFila: number;
  motivo: string;
  muestraOriginal: string;
}
interface Configuracion {
  fichaUrl: string;
  expresionCron: string;
  pausado: boolean;
}
const request = useBackendRequest();
const base = "/administracion/actividad-anac";
const today = new Date();
const periodo = ref(
  new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - 1, 1))
    .toISOString()
    .slice(0, 7),
);
const aeropuerto = ref(""),
  operador = ref(""),
  clasificacion = ref(""),
  calidad = ref(""),
  movimiento = ref("todos");
const vistaConectividad = ref(false),
  periodoConsultado = ref(periodo.value);
const conectividad = ref(false),
  pagina = ref(1),
  paginaIdentidades = ref(1);
const resultado = ref<Resultado | null>(null),
  revisiones = ref<Revision[]>([]),
  ejecuciones = ref<Ejecucion[]>([]),
  identidades = ref<Identidad[]>([]);
const config = ref<Configuracion | null>(null),
  selected = ref<Record<string, string>>({}),
  options = ref<{ label: string; value: string }[]>([]);
const loading = ref(false),
  saving = ref(false),
  error = ref(""),
  notice = ref(""),
  muestras = ref<Muestra[]>([]);
const ejecucionMuestras = ref<Ejecucion | null>(null);
const intentoMuestras = ref(1);
const totalPaginas = computed(() =>
  Math.max(1, Math.ceil((resultado.value?.total ?? 0) / 20)),
);
const quantity = (value: number | null | undefined) =>
  value == null ? "Sin dato" : value.toLocaleString("es-AR");
let loadVersion = 0,
  searchVersion = 0,
  muestrasVersion = 0;
async function cargar() {
  const version = ++loadVersion;
  const modoSolicitado = conectividad.value,
    mesSolicitado = periodo.value;
  loading.value = true;
  error.value = "";
  resultado.value = null;
  revisiones.value = [];
  identidades.value = [];
  muestras.value = [];
  ejecucionMuestras.value = null;
  muestrasVersion++;
  try {
    const [data, revisions, jobs, identities] = await Promise.all([
      request<Resultado>(`${base}${modoSolicitado ? "/conectividad" : ""}`, {
        query: {
          periodo: mesSolicitado,
          aeropuerto: aeropuerto.value || undefined,
          operador: operador.value || undefined,
          clasificacion: clasificacion.value || undefined,
          calidad: calidad.value || undefined,
          movimiento: movimiento.value === "todos" ? undefined : movimiento.value,
          pagina: pagina.value,
          limite: 20,
        },
      }),
      request<Revision[]>(`${base}/revisiones`, {
        query: { periodo: mesSolicitado },
      }),
      request<Ejecucion[]>(`${base}/ejecuciones`),
      request<Identidad[]>(`${base}/correspondencias`, {
        query: {
          periodo: mesSolicitado,
          pagina: paginaIdentidades.value,
          limite: 20,
        },
      }),
    ]);
    if (version === loadVersion) {
      resultado.value = data;
      vistaConectividad.value = modoSolicitado;
      periodoConsultado.value = mesSolicitado;
      revisiones.value = revisions;
      ejecuciones.value = jobs;
      identidades.value = identities;
    }
  } catch {
    if (version === loadVersion)
      error.value =
        "No pudimos consultar la actividad ANAC. Revisá el mes y volvé a intentar.";
  } finally {
    if (version === loadVersion) loading.value = false;
  }
}
async function consultar() {
  pagina.value = 1;
  paginaIdentidades.value = 1;
  await cargar();
}
async function cambiarPagina(delta: number) {
  pagina.value += delta;
  await cargar();
}
async function cambiarCorrespondencias(delta: number) {
  paginaIdentidades.value += delta;
  await cargar();
}
async function guardar() {
  if (!config.value) return;
  saving.value = true;
  error.value = "";
  notice.value = "";
  try {
    config.value = await request<Configuracion>(`${base}/configuracion`, {
      method: "PATCH",
      body: config.value,
    });
    notice.value =
      "Configuración guardada. La programación usa UTC e importa el mes anterior.";
  } catch {
    error.value = "No se pudo guardar la configuración ANAC.";
  } finally {
    saving.value = false;
  }
}
async function ejecutar(id?: string) {
  saving.value = true;
  error.value = "";
  notice.value = "";
  try {
    await request(
      id ? `${base}/ejecuciones/${id}/reintentar` : `${base}/ejecutar`,
      { method: "POST", body: id ? undefined : { periodo: periodo.value } },
    );
    notice.value =
      "Carga encolada. Actualizá para consultar el resultado y los descartes.";
    await cargar();
  } catch {
    error.value = "No se pudo solicitar la carga ANAC.";
  } finally {
    saving.value = false;
  }
}
async function verMuestras(job?: Ejecucion) {
  if (job) {
    ejecucionMuestras.value = job;
    intentoMuestras.value = job.intento;
  }
  if (!ejecucionMuestras.value) return;
  const version = ++muestrasVersion;
  error.value = "";
  notice.value = "";
  muestras.value = [];
  try {
    const rows = await request<Muestra[]>(
      `${base}/ejecuciones/${ejecucionMuestras.value.id}/muestras`,
      { query: { intento: intentoMuestras.value } },
    );
    if (version !== muestrasVersion) return;
    muestras.value = rows;
    if (!rows.length)
      notice.value = "Este intento no tiene muestras rechazadas.";
  } catch {
    if (version === muestrasVersion)
      error.value = "No se pudieron consultar las muestras rechazadas.";
  }
}
async function buscarAeropuerto(q: string) {
  const version = ++searchVersion;
  if (q.trim().length < 2) {
    options.value = [];
    return;
  }
  try {
    const rows = await request<
      { id: string; nombre: string; iata: string | null; icao: string | null }[]
    >("/aeropuertos/buscar", { query: { q, limit: 20 } });
    if (version === searchVersion)
      options.value = rows.map((a) => ({
        value: a.id,
        label: `${a.iata ?? a.icao ?? "Sin código"} · ${a.nombre}`,
      }));
  } catch {
    if (version === searchVersion)
      error.value = "No se pudieron buscar aeropuertos.";
  }
}
async function vincular(codigo: string) {
  saving.value = true;
  error.value = "";
  try {
    await request(`${base}/correspondencias`, {
      method: "PATCH",
      body: { codigo, aeropuertoId: selected.value[codigo] },
    });
    await cargar();
  } catch {
    error.value = "No se pudo guardar la correspondencia ANAC.";
  } finally {
    saving.value = false;
  }
}
onMounted(async () => {
  await cargar();
  try {
    config.value = await request<Configuracion>(`${base}/configuracion`);
  } catch {
    error.value = "No se pudo consultar la configuración ANAC.";
  }
});
</script>

<template>
  <section class="space-y-6">
    <div class="flex flex-wrap justify-between items-start gap-4">
      <div>
        <h1 class="text-2xl font-semibold">Actividad ANAC</h1>
        <p class="text-sm text-text-muted mt-1">
          ANAC — CC BY 4.0
        </p>
      </div>
      <div class="flex gap-2">
        <UButton
          color="neutral"
          variant="outline"
          :loading="loading"
          @click="cargar"
          >Actualizar</UButton
        ><UButton
          color="neutral"
          :disabled="saving || loading"
          @click="ejecutar()"
          >Importar mes</UButton
        >
      </div>
    </div>
    <p v-if="error" role="alert" class="text-error">{{ error }}</p>
    <p v-if="notice" role="status" class="text-sm">{{ notice }}</p>
    <form aria-label="Consultar actividad" class="rounded-lg bg-surface-card p-4 sm:p-5 space-y-4" @submit.prevent="consultar">
      <div class="grid grid-cols-2 gap-4 lg:grid-cols-3">
        <UFormField label="Mes UTC" class="col-span-2 sm:col-span-1"><UInput class="w-full" v-model="periodo" type="month" required min="1900-01" max="2099-12" /></UFormField>
        <UFormField label="Aeropuerto ANAC"><UInput class="w-full" v-model="aeropuerto" placeholder="Código, p. ej. AER" /></UFormField>
        <UFormField label="Operador"><UInput class="w-full" v-model="operador" placeholder="Nombre en la fuente" /></UFormField>
        <UFormField label="Clasificación"><UInput class="w-full" v-model="clasificacion" placeholder="Doméstico" /></UFormField>
        <UFormField label="Calidad"><UInput class="w-full" v-model="calidad" placeholder="PROVISORIO" /></UFormField>
        <UFormField label="Movimiento" class="col-span-2 sm:col-span-1"><USelect class="w-full" v-model="movimiento" :items="[{ label: 'Todos', value: 'todos' }, { label: 'Despegue', value: 'DESPEGUE' }, { label: 'Aterrizaje', value: 'ATERRIZAJE' }]" /></UFormField>
      </div>
      <div class="flex flex-wrap items-center justify-between gap-3 border-t border-border-subtle pt-4">
        <UCheckbox v-model="conectividad" label="Conectividad · solo despegues" />
        <UButton type="submit" icon="i-lucide-search" color="neutral" :loading="loading">Consultar</UButton>
      </div>
    </form>
    <div v-if="loading" role="status" class="py-6">
      Consultando movimientos…
    </div>
    <template v-else-if="resultado">
      <p v-if="resultado.cobertura" class="text-sm text-text-muted">
        Pasajeros por movimiento y tarjetas de embarque (PAX) se leen por separado.
      </p>
      <div v-if="resultado.cobertura" class="text-sm border-y border-border-subtle py-3">
        <p>
          Mes publicado ·
          {{ quantity(resultado.cobertura.filasProcesadas) }} movimientos ·
          Actualización: {{ resultado.cobertura.actualizadoEn }} ·
          <a
            :href="resultado.cobertura.uri"
            class="underline"
            target="_blank"
            rel="noopener noreferrer"
            >CSV de origen</a
          >
        </p>
      </div>
      <UEmpty v-else variant="subtle" icon="i-lucide-calendar"
        :title="`Sin publicación para ${periodoConsultado}`"
        description="Importá el mes para consultar sus movimientos." />
      <div v-if="resultado.resumen.length" class="overflow-x-auto">
        <table class="w-full text-sm">
          <caption class="text-left font-semibold mb-3">
            Resumen por clasificación
          </caption>
          <thead>
            <tr class="border-b border-border-subtle">
              <th class="text-left p-2">Clasificación</th>
              <th class="text-right p-2">Movimientos</th>
              <th class="text-right p-2">Despegues</th>
              <th class="text-right p-2">Aterrizajes</th>
              <th class="text-right p-2">Pasajeros</th>
              <th class="text-right p-2">PAX</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="r in resultado.resumen"
              :key="r.clasificacion"
              class="border-b border-border-subtle"
            >
              <td class="p-2">{{ r.clasificacion }}</td>
              <td class="text-right p-2">{{ quantity(r.movimientos) }}</td>
              <td class="text-right p-2">{{ quantity(r.despegues) }}</td>
              <td class="text-right p-2">{{ quantity(r.aterrizajes) }}</td>
              <td class="text-right p-2">
                {{ quantity(r.pasajeros)
                }}<small class="block text-text-muted"
                  >{{ r.movimientosConPasajeros }} movimientos conocidos</small
                >
              </td>
              <td class="text-right p-2">
                {{ quantity(r.pax)
                }}<small class="block text-text-muted"
                  >{{ r.movimientosConPax }} movimientos conocidos</small
                >
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div v-if="resultado.datos.length" class="overflow-x-auto">
        <table class="w-full text-sm">
          <caption class="text-left font-semibold mb-3">
            {{
              vistaConectividad
                ? "Conectividad desde despegues"
                : "Movimientos del mes"
            }}
            ·
            {{
              quantity(resultado.total)
            }}
            resultados
          </caption>
          <thead>
            <tr class="border-b border-border-subtle">
              <th class="text-left p-2">
                {{ vistaConectividad ? "Salidas" : "Fecha UTC / movimiento" }}
              </th>
              <th class="text-left p-2">Origen → destino (ANAC)</th>
              <th class="text-left p-2">Operador / clasificación</th>
              <th class="text-right p-2">Pasajeros</th>
              <th v-if="!vistaConectividad" class="text-right p-2">PAX</th>
              <th v-if="!vistaConectividad" class="text-left p-2">Calidad</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="(row, i) in resultado.datos"
              :key="row.numeroFila ?? i"
              class="border-b border-border-subtle"
            >
              <td class="p-2">
                {{
                  vistaConectividad
                    ? quantity(row.movimientosSalida)
                    : `${row.fechaUtc} · ${row.movimiento}`
                }}
              </td>
              <td class="p-2 whitespace-nowrap">
                {{ row.origen }} → {{ row.destino }}
              </td>
              <td class="p-2">
                {{ row.operador
                }}<small class="block text-text-muted">{{
                  row.clasificacion
                }}</small>
              </td>
              <td class="p-2 text-right">{{ quantity(row.pasajeros) }}</td>
              <td v-if="!vistaConectividad" class="p-2 text-right">
                {{ quantity(row.pax) }}
              </td>
              <td v-if="!vistaConectividad" class="p-2">{{ row.calidad }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <UEmpty v-else-if="resultado.cobertura" variant="subtle" title="Sin movimientos para estos filtros" />
      <div v-if="totalPaginas > 1" class="flex justify-end items-center gap-3 text-sm">
        <UButton
          color="neutral"
          variant="ghost"
          :disabled="pagina === 1 || loading"
          @click="cambiarPagina(-1)"
          >Anterior</UButton
        ><span>Página {{ pagina }} de {{ totalPaginas }}</span
        ><UButton
          color="neutral"
          variant="ghost"
          :disabled="pagina >= totalPaginas || loading"
          @click="cambiarPagina(1)"
          >Siguiente</UButton
        >
      </div>
    </template>
    <UCollapsible class="border-t border-border-subtle pt-3">
      <UButton variant="ghost" color="neutral" trailing-icon="i-lucide-chevron-down" class="group"
        :ui="{ trailingIcon: 'group-data-[state=open]:rotate-180' }">Programación mensual y ficha de origen</UButton>
      <template #content>
      <form v-if="config" class="mt-3 space-y-4 rounded-lg bg-surface-card p-4 sm:p-5" @submit.prevent="guardar">
        <div class="grid gap-4 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <UFormField label="Ficha anual de ANAC" help="Elegí la ficha del año que vas a importar.">
            <UInput v-model="config.fichaUrl" type="url" required class="w-full" />
          </UFormField>
          <UFormField label="Programación mensual UTC" help="La carga programada consulta el mes anterior.">
            <UInput v-model="config.expresionCron" placeholder="0 4 1 * *" required class="w-full" />
          </UFormField>
        </div>
        <div class="flex flex-wrap items-center justify-between gap-3 border-t border-border-subtle pt-4">
          <USwitch v-model="config.pausado" label="Pausada" />
          <UButton type="submit" color="neutral" :loading="saving">Guardar configuración</UButton>
        </div>
      </form>
      </template>
    </UCollapsible>
    <UCollapsible class="border-t border-border-subtle pt-3" :default-open="true">
      <UButton variant="ghost" color="neutral" trailing-icon="i-lucide-chevron-down" class="group"
        :ui="{ trailingIcon: 'group-data-[state=open]:rotate-180' }">Ejecuciones, descartes y revisiones</UButton>
      <template #content>
      <div
        v-for="job in ejecuciones"
        :key="job.id"
        class="flex flex-wrap gap-3 py-3 border-b border-border-subtle text-sm items-center"
      >
        <span class="flex-1"
          >{{ job.instantaneaConfiguracion?.conexion.periodo }} ·
          {{ job.estado }} · Intento {{ job.intento }} ·
          {{ quantity(job.filasProcesadas) }} procesados /
          {{ quantity(job.filasDescartadas) }} descartados
          <span v-if="job.mensajeError" class="block text-error">{{
            job.mensajeError
          }}</span></span
        ><UButton
          v-if="job.filasDescartadas || job.intento > 1"
          color="neutral"
          variant="ghost"
          @click="verMuestras(job)"
          >Ver descartes</UButton
        ><UButton
          v-if="job.estado === 'failed' || job.estado === 'completed'"
          color="neutral"
          variant="outline"
          :disabled="saving"
          @click="ejecutar(job.id)"
          >Reintentar</UButton
        >
      </div>
      <p v-if="!ejecuciones.length" class="py-3 text-sm text-text-muted">
        Todavía no hay ejecuciones ANAC.
      </p>
      <UFormField v-if="ejecucionMuestras" label="Intento de descartes" class="py-3">
        <USelect v-model="intentoMuestras" aria-label="Intento de descartes"
          :items="Array.from({ length: ejecucionMuestras.intento }, (_, index) => index + 1)"
          @update:model-value="verMuestras()" />
      </UFormField>
      <ul v-if="muestras.length" class="text-sm space-y-2 py-3">
        <li v-for="sample in muestras" :key="sample.numeroFila">
          Fila {{ sample.numeroFila }}: {{ sample.motivo }}
          <pre class="overflow-x-auto text-xs mt-1">{{
            sample.muestraOriginal
          }}</pre>
        </li>
      </ul>
      <p v-for="revision in revisiones" :key="revision.id" class="text-sm py-2">
        {{ revision.actualizadoEn }} · {{ revision.estado
        }}{{ revision.vigente ? " · vigente" : "" }} ·
        {{ quantity(revision.filasProcesadas) }} movimientos ·
        {{ quantity(revision.filasDescartadas) }} descartes<span
          v-if="revision.checksum"
          class="block text-xs break-all text-text-muted"
          >SHA-256 {{ revision.checksum }}</span
        >
      </p>
      <p class="text-sm text-text-muted">
        Una carga fallida o con descartes conserva la última publicación
        completa. Las revisiones no se acumulan como movimientos nuevos.
      </p>
      </template>
    </UCollapsible>
    <UCollapsible class="border-t border-border-subtle pt-3">
      <UButton variant="ghost" color="neutral" trailing-icon="i-lucide-chevron-down" class="group"
        :ui="{ trailingIcon: 'group-data-[state=open]:rotate-180' }">Correspondencias de aeropuertos ANAC</UButton>
      <template #content>
      <p class="text-sm text-text-muted my-3">
        Los códigos FAA/OACI se conservan como los publica ANAC. La vinculación
        es explícita; no se equiparan a códigos IATA.
      </p>
      <div
        v-for="identity in identidades"
        :key="identity.codigo"
        class="flex flex-wrap items-center gap-3 py-3 border-b border-border-subtle"
      >
        <span class="min-w-32 text-sm"
          >{{ identity.codigo }} · {{ identity.nombre ?? "Sin vincular" }}</span
        ><USelectMenu
          v-model="selected[identity.codigo]"
          :items="options"
          ignore-filter
          value-key="value"
          placeholder="Buscar aeropuerto para vincular"
          class="w-full sm:w-80"
          @update:search-term="buscarAeropuerto"
        /><UButton
          color="neutral"
          :disabled="!selected[identity.codigo] || saving"
          @click="vincular(identity.codigo)"
          >Vincular</UButton
        >
      </div>
      <div class="flex gap-3 justify-end mt-3">
        <UButton
          color="neutral"
          variant="ghost"
          :disabled="paginaIdentidades === 1 || loading"
          @click="cambiarCorrespondencias(-1)"
          >Anteriores</UButton
        ><span class="text-sm self-center">Página {{ paginaIdentidades }}</span
        ><UButton
          color="neutral"
          variant="ghost"
          :disabled="identidades.length < 20 || loading"
          @click="cambiarCorrespondencias(1)"
          >Siguientes</UButton
        >
      </div>
      </template>
    </UCollapsible>
  </section>
</template>
