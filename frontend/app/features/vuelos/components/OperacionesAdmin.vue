<script setup lang="ts">
import { useBackendRequest } from "~/shared/composables/useBackendRequest";
import SelectorCatalogo from "~/features/catalogos/components/SelectorCatalogo.vue";
import {
  operacionSchema,
  type Vuelo,
  type DatosOperacion,
  type HistorialOperacion,
  type MetricaOperacion,
  type Pagina,
} from "../operaciones";

const request = useBackendRequest();
const registros = ref<Vuelo[]>([]),
  total = ref(0),
  pagina = ref(1);
const filtros = reactive({
  periodo: new Date().toISOString().slice(0, 7),
  archivo: "vigentes",
  origenId: null as string | null,
  destinoId: null as string | null,
  aerolineaId: null as string | null,
  resultado: "",
  fuente: "",
});
const error = ref(""),
  errorDetalle = ref(""),
  cargando = ref(false),
  guardando = ref(false),
  cargandoDetalle = ref(false);
const seleccion = ref<Vuelo | null>(null),
  editor = ref(false),
  historial = ref<HistorialOperacion[]>([]),
  paginaHistorial = ref(1),
  totalHistorial = ref(0),
  metrica = ref<MetricaOperacion | null>(null);
const datos = reactive({
  fechaVuelo: new Date().toISOString().slice(0, 10),
  numeroVuelo: "",
  origenId: null as string | null,
  destinoId: null as string | null,
  aerolineaId: null as string | null,
  estado: "ARRIVED" as DatosOperacion["estado"],
  demoraLlegadaMinutos: null as number | null,
});
const estados = [
  { label: "Llegó", value: "ARRIVED" },
  { label: "Cancelado", value: "CANCELLED" },
  { label: "Desviado", value: "DIVERTED" },
];
let lectura: AbortController | undefined;
onScopeDispose(() => lectura?.abort());
function mensaje(causa: unknown) {
  return causa instanceof Error
    ? causa.message
    : "No pudimos completar la operación.";
}
async function cargar() {
  cargando.value = true;
  error.value = "";
  try {
    const respuesta = await request<Pagina<Vuelo>>("/administracion/vuelos", {
      query: {
        periodo: filtros.periodo || undefined,
        archivo: filtros.archivo,
        origenId: filtros.origenId ?? undefined,
        destinoId: filtros.destinoId ?? undefined,
        aerolineaId: filtros.aerolineaId ?? undefined,
        resultado: filtros.resultado || undefined,
        fuente: filtros.fuente || undefined,
        pagina: pagina.value,
        limite: 20,
      },
    });
    registros.value = respuesta.datos;
    total.value = respuesta.total;
  } catch (causa) {
    error.value = mensaje(causa);
  } finally {
    cargando.value = false;
  }
}
async function buscar() {
  pagina.value = 1;
  await cargar();
}
async function cargarHistoria() {
  if (!seleccion.value) return;
  const respuesta = await request<Pagina<HistorialOperacion>>(
    `/administracion/vuelos/${seleccion.value.id}/historial`,
    {
      query: { pagina: paginaHistorial.value, limite: 20 },
      signal: lectura?.signal,
    },
  );
  historial.value = respuesta.datos;
  totalHistorial.value = respuesta.total;
}
async function abrir(vuelo: Vuelo | null) {
  lectura?.abort();
  const actual = new AbortController();
  lectura = actual;
  errorDetalle.value = "";
  editor.value = true;
  seleccion.value = null;
  historial.value = [];
  metrica.value = null;
  paginaHistorial.value = 1;
  Object.assign(datos, {
    fechaVuelo: new Date().toISOString().slice(0, 10),
    numeroVuelo: "",
    origenId: null,
    destinoId: null,
    aerolineaId: null,
    estado: "ARRIVED",
    demoraLlegadaMinutos: null,
  });
  cargandoDetalle.value = false;
  if (!vuelo) return;
  cargandoDetalle.value = true;
  try {
    const registro = await request<Vuelo>(
      `/administracion/vuelos/${vuelo.id}`,
      { signal: actual.signal },
    );
    if (actual.signal.aborted) return;
    seleccion.value = registro;
    Object.assign(datos, {
      fechaVuelo: registro.fechaVuelo,
      numeroVuelo: registro.numeroVuelo,
      origenId: registro.origenId,
      destinoId: registro.destinoId,
      aerolineaId: registro.aerolineaId,
      estado: registro.estado,
      demoraLlegadaMinutos: registro.demoraLlegadaMinutos,
    });
    const [respuesta] = await Promise.all([
      request<Pagina<MetricaOperacion>>("/metricas/rutas", {
        query: {
          periodo: registro.fechaVuelo.slice(0, 7),
          origenId: registro.origenId,
          destinoId: registro.destinoId,
          aerolineaId: registro.aerolineaId,
        },
        signal: actual.signal,
      }),
      cargarHistoria(),
    ]);
    if (!actual.signal.aborted) metrica.value = respuesta.datos[0] ?? null;
  } catch (causa) {
    if (!actual.signal.aborted) errorDetalle.value = mensaje(causa);
  } finally {
    if (!actual.signal.aborted) cargandoDetalle.value = false;
  }
}
async function guardar() {
  const resultado = operacionSchema.safeParse({
    ...datos,
    demoraLlegadaMinutos:
      datos.estado === "ARRIVED" ? datos.demoraLlegadaMinutos : null,
  });
  if (!resultado.success) {
    errorDetalle.value =
      resultado.error.issues[0]?.message ?? "Revisá los datos.";
    return;
  }
  guardando.value = true;
  errorDetalle.value = "";
  try {
    const vuelo = await request<Vuelo>(
      `/administracion/vuelos${seleccion.value ? "/" + seleccion.value.id : ""}`,
      {
        method: seleccion.value ? "PATCH" : "POST",
        body: {
          ...resultado.data,
          ...(seleccion.value ? { version: seleccion.value.version } : {}),
        },
      },
    );
    await cargar();
    await abrir(vuelo);
  } catch (causa) {
    errorDetalle.value = mensaje(causa);
  } finally {
    guardando.value = false;
  }
}
async function accion(nombre: "archivar" | "restaurar" | "restablecer-fuente") {
  if (!seleccion.value) return;
  guardando.value = true;
  errorDetalle.value = "";
  try {
    const vuelo = await request<Vuelo>(
      `/administracion/vuelos/${seleccion.value.id}/${nombre}`,
      { method: "POST", body: { version: seleccion.value.version } },
    );
    await cargar();
    await abrir(vuelo);
  } catch (causa) {
    errorDetalle.value = mensaje(causa);
  } finally {
    guardando.value = false;
  }
}
async function paginarHistoria(cambio: number) {
  paginaHistorial.value += cambio;
  try {
    await cargarHistoria();
  } catch (causa) {
    errorDetalle.value = mensaje(causa);
  }
}
onMounted(cargar);
</script>

<template>
  <section class="space-y-5" aria-labelledby="operaciones-titulo">
    <header class="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 id="operaciones-titulo" class="text-2xl font-semibold">
          Operaciones de vuelo
        </h1>
        <p class="text-sm text-text-muted">
          Resultados finalizados, correcciones protegidas y OTP mensual.
        </p>
      </div>
      <UButton color="neutral" :disabled="guardando" @click="abrir(null)"
        >Crear operación</UButton
      >
    </header>
    <form class="flex flex-wrap items-end gap-3" @submit.prevent="buscar">
      <label class="text-sm"
        >Mes UTC<UInput
          v-model="filtros.periodo"
          type="month"
          aria-label="Filtrar por mes UTC"
      /></label>
      <label class="text-sm"
        >Archivo<USelect
          v-model="filtros.archivo"
          aria-label="Estado de archivo"
          :items="[
            { label: 'Vigentes', value: 'vigentes' },
            { label: 'Archivadas', value: 'archivados' },
            { label: 'Todas', value: 'todos' },
          ]"
      /></label>
      <UButton
        type="submit"
        color="neutral"
        variant="outline"
        :loading="cargando"
        >Buscar</UButton
      >
      <details class="w-full">
        <summary class="cursor-pointer text-sm">Más filtros</summary>
        <div class="grid gap-3 mt-3 sm:grid-cols-3">
          <SelectorCatalogo
            v-model="filtros.origenId"
            recurso="aeropuertos"
            label="Filtrar origen"
          />
          <SelectorCatalogo
            v-model="filtros.destinoId"
            recurso="aeropuertos"
            label="Filtrar destino"
          />
          <SelectorCatalogo
            v-model="filtros.aerolineaId"
            recurso="aerolineas"
            label="Filtrar aerolínea"
          />
          <USelect
            v-model="filtros.resultado"
            aria-label="Filtrar resultado"
            :items="[{ label: 'Todos los resultados', value: '' }, ...estados]"
          />
          <UInput
            v-model="filtros.fuente"
            aria-label="Filtrar fuente"
            placeholder="Fuente, p. ej. BTS"
          />
        </div>
      </details>
    </form>
    <p v-if="error" role="alert" class="text-error">
      {{ error }}
      <UButton color="neutral" variant="link" @click="cargar"
        >Reintentar</UButton
      >
    </p>
    <div
      class="overflow-x-auto border border-border-subtle rounded-lg"
      :aria-busy="cargando"
    >
      <table class="w-full text-sm text-left">
        <caption class="text-left p-3 text-text-muted">
          {{
            total
          }}
          operaciones ·
          {{
            cargando ? "Actualizando…" : "Resultados de la consulta"
          }}
        </caption>
        <thead class="text-text-muted">
          <tr>
            <th class="p-3 font-medium">Operación</th>
            <th class="p-3 font-medium">Ruta y operador</th>
            <th class="p-3 font-medium">Resultado</th>
            <th class="p-3 font-medium text-right">Demora</th>
            <th class="p-3 font-medium">Procedencia</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="vuelo in registros"
            :key="vuelo.id"
            class="border-t border-border-subtle"
          >
            <td class="p-3">
              <UButton
                color="neutral"
                variant="link"
                :aria-label="`Ver operación ${vuelo.numeroVuelo}`"
                :disabled="guardando"
                @click="abrir(vuelo)"
                >{{ vuelo.numeroVuelo }}</UButton
              >
              <p>{{ vuelo.fechaVuelo }}</p>
            </td>
            <td class="p-3">
              {{ vuelo.origen.iata ?? vuelo.origen.nombre }} →
              {{ vuelo.destino.iata ?? vuelo.destino.nombre }}
              <p class="text-text-muted">{{ vuelo.aerolinea.nombre }}</p>
            </td>
            <td class="p-3">
              {{ estados.find((e) => e.value === vuelo.estado)?.label }}
              <p v-if="vuelo.archivadoEn" class="text-text-muted">Archivada</p>
            </td>
            <td class="p-3 text-right tabular-nums">
              {{
                vuelo.demoraLlegadaMinutos === null
                  ? "—"
                  : `${vuelo.demoraLlegadaMinutos} min`
              }}
            </td>
            <td class="p-3">
              {{ vuelo.fuente }}
              <p v-if="vuelo.protegidoManualmente" class="text-text-muted">
                Protegida
              </p>
            </td>
          </tr>
          <tr v-if="!registros.length">
            <td colspan="5" class="p-6 text-text-muted">
              {{
                cargando
                  ? "Cargando operaciones…"
                  : "No hay operaciones para estos filtros."
              }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <nav
      class="flex justify-between items-center"
      aria-label="Páginas de operaciones"
    >
      <UButton
        color="neutral"
        variant="outline"
        :disabled="pagina === 1 || cargando"
        @click="
          pagina--;
          cargar();
        "
        >Anterior</UButton
      ><span class="text-sm">Página {{ pagina }}</span
      ><UButton
        color="neutral"
        variant="outline"
        :disabled="pagina * 20 >= total || cargando"
        @click="
          pagina++;
          cargar();
        "
        >Siguiente</UButton
      >
    </nav>
    <section
      v-if="editor"
      class="border border-border-subtle bg-surface-card rounded-lg p-4 sm:p-6 space-y-4"
      aria-labelledby="detalle-titulo"
      :aria-busy="cargandoDetalle"
    >
      <div class="flex justify-between items-center gap-3">
        <h2 id="detalle-titulo" class="text-lg font-semibold">
          {{
            seleccion
              ? `Operación ${seleccion.numeroVuelo} · versión ${seleccion.version}`
              : "Nueva operación"
          }}
        </h2>
        <UButton
          color="neutral"
          variant="ghost"
          :disabled="guardando"
          @click="
            lectura?.abort();
            editor = false;
          "
          >Cerrar</UButton
        >
      </div>
      <p v-if="errorDetalle" role="alert" class="text-error">
        {{ errorDetalle }}
        <UButton
          v-if="seleccion"
          color="neutral"
          variant="link"
          @click="abrir(seleccion)"
          >Volver a cargar</UButton
        >
      </p>
      <p v-if="cargandoDetalle" role="status">Cargando operación…</p>
      <form v-else class="space-y-4" @submit.prevent="guardar">
        <fieldset
          :disabled="guardando || !!seleccion?.archivadoEn"
          class="grid gap-4 sm:grid-cols-3"
        >
          <label class="text-sm"
            >Fecha UTC<UInput
              v-model="datos.fechaVuelo"
              type="date"
              aria-label="Fecha de vuelo UTC"
              required
          /></label>
          <label class="text-sm"
            >Número de vuelo<UInput
              v-model="datos.numeroVuelo"
              aria-label="Número de vuelo"
              maxlength="30"
              required
          /></label>
          <label class="text-sm"
            >Resultado<USelect
              v-model="datos.estado"
              :items="estados"
              aria-label="Resultado final"
          /></label>
          <label class="text-sm"
            >Origen<SelectorCatalogo
              v-model="datos.origenId"
              recurso="aeropuertos"
              :referencia="seleccion?.origen"
              label="Aeropuerto de origen"
              :disabled="guardando || !!seleccion?.archivadoEn"
          /></label>
          <label class="text-sm"
            >Destino<SelectorCatalogo
              v-model="datos.destinoId"
              recurso="aeropuertos"
              :referencia="seleccion?.destino"
              label="Aeropuerto de destino"
              :disabled="guardando || !!seleccion?.archivadoEn"
          /></label>
          <label class="text-sm"
            >Aerolínea<SelectorCatalogo
              v-model="datos.aerolineaId"
              recurso="aerolineas"
              :referencia="seleccion?.aerolinea"
              label="Aerolínea operadora"
              :disabled="guardando || !!seleccion?.archivadoEn"
          /></label>
          <label v-if="datos.estado === 'ARRIVED'" class="text-sm"
            >Demora de llegada (min)<UInput
              v-model.number="datos.demoraLlegadaMinutos"
              type="number"
              step="1"
              aria-label="Demora de llegada en minutos"
              required
            /><span class="text-text-muted"
              >Los anticipos son negativos.</span
            ></label
          >
        </fieldset>
        <p class="text-sm text-text-muted">
          Las correcciones manuales se conservan frente a futuras importaciones.
        </p>
        <div class="flex flex-wrap gap-3">
          <UButton
            v-if="!seleccion?.archivadoEn"
            type="submit"
            color="neutral"
            :loading="guardando"
            >Guardar operación</UButton
          >
          <template v-if="seleccion"
            ><UButton
              :data-action="seleccion.archivadoEn ? 'restaurar' : 'archivar'"
              color="neutral"
              variant="outline"
              :disabled="guardando"
              @click="accion(seleccion.archivadoEn ? 'restaurar' : 'archivar')"
              >{{ seleccion.archivadoEn ? "Restaurar" : "Archivar" }}</UButton
            >
            <UButton
              v-if="seleccion.ultimaObservacion && !seleccion.archivadoEn"
              color="neutral"
              variant="outline"
              :disabled="guardando"
              @click="accion('restablecer-fuente')"
              >Volver a la última fuente y liberar protección</UButton
            ></template
          >
        </div>
      </form>
      <section
        v-if="seleccion"
        class="border-t border-border-subtle pt-4 space-y-3"
        aria-labelledby="otp-titulo"
      >
        <div class="flex justify-between items-center">
          <h3 id="otp-titulo" class="font-semibold">
            OTP de esta ruta y aerolínea ·
            {{ seleccion.fechaVuelo.slice(0, 7) }}
          </h3>
          <UButton
            color="neutral"
            variant="ghost"
            :disabled="guardando || cargandoDetalle"
            @click="abrir(seleccion)"
            >Actualizar</UButton
          >
        </div>
        <template v-if="metrica"
          ><p class="text-2xl tabular-nums">
            {{
              metrica.otp15 === null
                ? "Sin denominador"
                : `${Math.round(metrica.otp15 * 100) / 100}%`
            }}
          </p>
          <p>
            {{ metrica.vuelosTotales }} operaciones ·
            {{ metrica.vuelosPuntuales }} puntuales ·
            {{ metrica.vuelosCancelados }} canceladas ·
            {{ metrica.vuelosDesviados }} desviadas
          </p>
          <p v-if="metrica.pendiente" role="status">
            Actualización pendiente. Se conserva el último cálculo válido.
          </p>
          <p v-if="metrica.errorActualizacion" role="alert">
            {{ metrica.errorActualizacion }}
          </p>
          <p class="text-sm text-text-muted">
            Fuentes:
            {{ metrica.fuentes.join(", ") || "Sin operaciones vigentes" }} ·
            Último cálculo:
            {{
              metrica.actualizadoEn
                ? metrica.actualizadoEn + " UTC"
                : "Todavía no publicado"
            }}
          </p>
        </template>
        <p v-else class="text-sm text-text-muted">
          Sin cálculo publicado todavía.
        </p>
      </section>
      <section
        v-if="seleccion"
        class="border-t border-border-subtle pt-4 space-y-3"
        aria-labelledby="historial-titulo"
      >
        <h3 id="historial-titulo" class="font-semibold">
          Historial · {{ totalHistorial }} versiones
        </h3>
        <ol class="space-y-3">
          <li v-for="item in historial" :key="item.version">
            <details>
              <summary class="cursor-pointer text-sm">
                Versión {{ item.version }} · {{ item.accion }} ·
                {{ item.creadoEn }} UTC · {{ item.actorId ?? "Fuente" }}
              </summary>
              <pre class="text-xs whitespace-pre-wrap break-all p-3">{{
                JSON.stringify(item.instantanea, null, 2)
              }}</pre>
            </details>
          </li>
        </ol>
        <div class="flex justify-between">
          <UButton
            color="neutral"
            variant="ghost"
            :disabled="paginaHistorial === 1 || guardando"
            @click="paginarHistoria(-1)"
            >Historial anterior</UButton
          ><UButton
            color="neutral"
            variant="ghost"
            :disabled="paginaHistorial * 20 >= totalHistorial || guardando"
            @click="paginarHistoria(1)"
            >Más historial</UButton
          >
        </div>
      </section>
    </section>
  </section>
</template>
