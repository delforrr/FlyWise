<script setup lang="ts">
import type { TableColumn } from "@nuxt/ui";
import { useAdministracionCatalogo } from "../composables/useAdministracionCatalogo";
import {
  type DatosOferta,
  type DatosCatalogo,
  type RecursoCatalogo,
  type RegistroCatalogo,
} from "../schemas/catalogos";
import EditorCatalogo from "./EditorCatalogo.vue";
import OfertasRuta from "./OfertasRuta.vue";

const props = defineProps<{ recurso: RecursoCatalogo; titulo: string }>();
const {
  registros,
  total,
  pagina,
  limite,
  busqueda,
  estado,
  cargando,
  guardando,
  error,
  cargar,
  detalle,
  guardar,
  archivar,
  guardarOferta,
  archivarOferta,
} = useAdministracionCatalogo(props.recurso);
const abierto = ref(false);
const editando = ref<RegistroCatalogo | null>(null);
const archivando = ref<RegistroCatalogo | null>(null);
const ofertas = ref<RegistroCatalogo | null>(null);
const errorMutacion = ref("");
let lecturaDetalle: AbortController | undefined;
onScopeDispose(() => lecturaDetalle?.abort());
const columns: TableColumn<RegistroCatalogo>[] = [
  {
    id: "registro",
    header: "Registro",
    meta: { class: { th: "w-[45%]", td: "w-[45%]" } },
  },
  {
    id: "estado",
    header: "Estado",
    meta: { class: { th: "w-1/4 text-center", td: "w-1/4 text-center" } },
  },
  {
    id: "acciones",
    header: "Acciones",
    meta: { class: { th: "w-[30%] text-right", td: "w-[30%] text-right" } },
  },
];
onMounted(cargar);
function nombre(r: RegistroCatalogo) {
  return props.recurso === "rutas"
    ? `${r.origen?.iata ?? r.origen?.nombre} → ${r.destino?.iata ?? r.destino?.nombre}`
    : (r.nombre ?? r.id);
}
function fallo(causa: unknown) {
  errorMutacion.value =
    causa instanceof Error
      ? causa.message
      : "No pudimos completar la operación.";
}
async function editar(r: RegistroCatalogo | null) {
  lecturaDetalle?.abort();
  const actual = new AbortController();
  lecturaDetalle = actual;
  errorMutacion.value = "";
  try {
    const registro = r ? await detalle(r.id, actual.signal) : null;
    if (actual.signal.aborted) return;
    editando.value = registro;
    abierto.value = true;
  } catch (causa) {
    if (!actual.signal.aborted) fallo(causa);
  }
}
async function enviar(datos: DatosCatalogo) {
  errorMutacion.value = "";
  try {
    if (await guardar(datos, editando.value?.id)) abierto.value = false;
  } catch (causa) {
    fallo(causa);
  }
}
async function confirmarArchivo() {
  if (!archivando.value) return;
  errorMutacion.value = "";
  try {
    if (await archivar(archivando.value.id)) archivando.value = null;
  } catch (causa) {
    fallo(causa);
  }
}
async function liberar(r: RegistroCatalogo) {
  errorMutacion.value = "";
  try {
    await guardar({ protegidoManualmente: false }, r.id);
  } catch (causa) {
    fallo(causa);
  }
}
async function verOfertas(r: RegistroCatalogo) {
  lecturaDetalle?.abort();
  const actual = new AbortController();
  lecturaDetalle = actual;
  errorMutacion.value = "";
  try {
    const registro = await detalle(r.id, actual.signal);
    if (!actual.signal.aborted) ofertas.value = registro;
  } catch (causa) {
    if (!actual.signal.aborted) fallo(causa);
  }
}
async function enviarOferta(datos: DatosOferta, id?: string) {
  if (!ofertas.value) return;
  errorMutacion.value = "";
  try {
    if (await guardarOferta(ofertas.value.id, datos, id))
      ofertas.value = await detalle(ofertas.value.id);
  } catch (causa) {
    fallo(causa);
  }
}
async function confirmarArchivoOferta(id: string) {
  if (!ofertas.value) return;
  errorMutacion.value = "";
  try {
    if (await archivarOferta(ofertas.value.id, id))
      ofertas.value = await detalle(ofertas.value.id);
  } catch (causa) {
    fallo(causa);
  }
}
</script>

<template>
  <div class="space-y-6">
    <header class="flex flex-wrap items-center justify-between gap-4">
      <div>
        <h1 class="text-2xl font-semibold">{{ titulo }}</h1>
        <p class="mt-2 text-sm text-text-muted">
          Administrá el catálogo y conservá sus relaciones al archivar
          registros.
        </p>
      </div>
      <UButton icon="i-lucide-plus" :disabled="guardando" @click="editar(null)"
        >Crear registro</UButton
      >
    </header>
    <UAlert
      v-if="errorMutacion && !abierto && !archivando && !ofertas"
      color="error"
      :description="errorMutacion"
      role="alert"
    />
    <UCard>
      <template #header
        ><div class="flex flex-wrap gap-3">
          <UInput
            v-model="busqueda"
            icon="i-lucide-search"
            placeholder="Buscar…"
            aria-label="Buscar registros"
            class="min-w-48 flex-1"
          /><USelect
            v-model="estado"
            aria-label="Estado del catálogo"
            :items="[
              { label: 'Vigentes', value: 'vigentes' },
              { label: 'Archivados', value: 'archivados' },
              { label: 'Todos', value: 'todos' },
            ]"
          /><UButton
            icon="i-lucide-refresh-cw"
            variant="outline"
            color="neutral"
            aria-label="Actualizar catálogo"
            :loading="cargando"
            @click="cargar"
          /></div
      ></template>
      <UAlert v-if="error" color="error" :description="error" role="alert"
        ><template #actions
          ><UButton variant="outline" color="neutral" @click="cargar"
            >Reintentar</UButton
          ></template
        ></UAlert
      >
      <UTable
        v-else
        :data="registros"
        :columns="columns"
        :loading="cargando"
        :ui="{ table: 'w-full table-fixed' }"
      >
        <template #registro-cell="{ row }"
          ><div class="max-w-96 whitespace-normal">
            <p class="font-medium">{{ nombre(row.original) }}</p>
            <p class="mt-1 text-xs text-text-muted">
              {{
                row.original.nombrePais ??
                row.original.pais ??
                row.original.fuente ??
                ""
              }}
            </p>
          </div></template
        >
        <template #estado-cell="{ row }"
          ><UBadge
            :color="row.original.archivadoEn ? 'neutral' : 'success'"
            variant="subtle"
            >{{ row.original.archivadoEn ? "Archivado" : "Vigente" }}</UBadge
          >
          <p
            v-if="row.original.protegidoManualmente"
            class="mt-1 text-xs text-text-muted"
          >
            Edición manual protegida
          </p></template
        >
        <template #acciones-cell="{ row }"
          ><div class="flex flex-wrap justify-end gap-1">
            <UButton
              v-if="recurso === 'rutas'"
              variant="outline"
              color="neutral"
              :disabled="guardando"
              @click="verOfertas(row.original)"
              >Ofertas</UButton
            >
            <UButton
              icon="i-lucide-pencil"
              variant="ghost"
              color="neutral"
              :aria-label="`Editar ${nombre(row.original)}`"
              :disabled="
                guardando ||
                !!row.original.archivadoEn ||
                (recurso === 'rutas' && !!row.original.ofertas?.length)
              "
              @click="editar(row.original)"
            />
            <UButton
              v-if="
                recurso !== 'rutas' &&
                row.original.protegidoManualmente &&
                !row.original.archivadoEn
              "
              variant="ghost"
              color="neutral"
              :disabled="guardando"
              @click="liberar(row.original)"
              >Permitir actualizaciones ETL</UButton
            >
            <UButton
              icon="i-lucide-archive"
              variant="ghost"
              color="neutral"
              :aria-label="`Archivar ${nombre(row.original)}`"
              :disabled="guardando || !!row.original.archivadoEn"
              @click="
                archivando = row.original;
                errorMutacion = '';
              "
            /></div
        ></template>
        <template #empty
          ><UEmpty
            title="Sin registros"
            description="Probá con otra búsqueda o creá un registro."
        /></template>
      </UTable>
      <template #footer
        ><div class="flex flex-wrap items-center justify-between gap-3">
          <span class="text-sm text-text-muted">{{ total }} registros</span
          ><UPagination
            v-model:page="pagina"
            :total="total"
            :items-per-page="limite"
            :disabled="cargando"
          /></div
      ></template>
    </UCard>
    <EditorCatalogo
      v-model:open="abierto"
      :recurso="recurso"
      :registro="editando"
      :guardando="guardando"
      :error="errorMutacion"
      @guardar="enviar"
    />
    <OfertasRuta
      :ruta="ofertas"
      :guardando="guardando"
      :error="errorMutacion"
      @cerrar="ofertas = null"
      @guardar="enviarOferta"
      @archivar="confirmarArchivoOferta"
    />
    <UModal
      :open="!!archivando"
      title="Archivar registro"
      description="Se oculta de las consultas públicas y conserva sus relaciones e historial."
      :dismissible="!guardando"
      :close="!guardando"
      @update:open="
        (valor) => {
          if (!valor) archivando = null;
        }
      "
      ><template #body
        ><p>{{ archivando ? nombre(archivando) : "" }}</p>
        <UAlert
          v-if="errorMutacion"
          class="mt-4"
          color="error"
          :description="errorMutacion"
          role="alert" /></template
      ><template #footer
        ><div class="flex w-full justify-end gap-3">
          <UButton
            color="neutral"
            variant="outline"
            :disabled="guardando"
            @click="archivando = null"
            >Cancelar</UButton
          ><UButton
            color="warning"
            :loading="guardando"
            @click="confirmarArchivo"
            >Archivar</UButton
          >
        </div></template
      ></UModal
    >
  </div>
</template>
