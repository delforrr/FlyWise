<script setup lang="ts">
import type { FormSubmitEvent } from "@nuxt/ui";
import {
  ofertaRutaSchema,
  type RegistroCatalogo,
  type DatosOferta,
} from "../schemas/catalogos";
import type { z } from "zod";
import SelectorCatalogo from "./SelectorCatalogo.vue";

const props = defineProps<{
  ruta: RegistroCatalogo | null;
  guardando: boolean;
  error: string;
}>();
const emit = defineEmits<{
  cerrar: [];
  guardar: [datos: DatosOferta, id?: string];
  archivar: [id: string];
}>();
const editando = ref<RegistroCatalogo | null>(null);
const archivando = ref<RegistroCatalogo | null>(null);
const estado = reactive({
  aerolineaId: null as string | null,
  codigoAerolinea: "",
  codigoCompartido: false,
  escalas: 0,
});
function editar(oferta: RegistroCatalogo | null) {
  editando.value = oferta;
  Object.assign(estado, {
    aerolineaId: oferta?.aerolineaId ?? null,
    codigoAerolinea: oferta?.codigoAerolinea ?? "",
    codigoCompartido: oferta?.codigoCompartido ?? false,
    escalas: oferta?.escalas ?? 0,
  });
}
watch(
  () => props.ruta,
  () => {
    editar(null);
    archivando.value = null;
  },
);
function guardar(evento: FormSubmitEvent<z.output<typeof ofertaRutaSchema>>) {
  emit("guardar", evento.data, editando.value?.id);
}
</script>

<template>
  <UModal
    :open="!!ruta"
    title="Ofertas de la ruta"
    description="Cada oferta registra una aerolínea y sus condiciones. Archivarla conserva su historial."
    :dismissible="!guardando"
    :close="!guardando"
    @update:open="
      (valor) => {
        if (!valor) emit('cerrar');
      }
    "
  >
    <template #body>
      <div class="space-y-5">
        <p class="font-medium">
          {{ ruta?.origen?.nombre }} → {{ ruta?.destino?.nombre }}
        </p>
        <UAlert v-if="error" color="error" :description="error" role="alert" />
        <UEmpty
          v-if="!ruta?.ofertas?.length"
          title="Sin ofertas"
          description="Agregá una aerolínea para ofrecer esta conexión."
        />
        <ul v-else class="space-y-3" aria-label="Ofertas registradas">
          <li
            v-for="oferta in ruta.ofertas"
            :key="oferta.id"
            class="flex items-center justify-between gap-2"
          >
            <div>
              <p>
                {{
                  oferta.aerolinea?.nombre ??
                  oferta.codigoAerolinea ??
                  "Aerolínea desconocida"
                }}
              </p>
              <p class="text-sm text-text-muted">
                {{ oferta.escalas }} escalas ·
                {{
                  oferta.codigoCompartido
                    ? "Código compartido"
                    : "Sin código compartido"
                }}
              </p>
              <UBadge v-if="oferta.archivadoEn" color="neutral"
                >Archivada</UBadge
              >
            </div>
            <div class="flex flex-wrap gap-1">
              <UButton
                v-if="
                  oferta.protegidoManualmente &&
                  !oferta.archivadoEn &&
                  !ruta.archivadoEn
                "
                variant="ghost"
                color="neutral"
                :disabled="guardando"
                @click="
                  emit('guardar', { protegidoManualmente: false }, oferta.id)
                "
                >Permitir actualizaciones ETL</UButton
              ><UButton
                icon="i-lucide-pencil"
                color="neutral"
                variant="ghost"
                aria-label="Editar oferta"
                :disabled="
                  guardando || !!oferta.archivadoEn || !!ruta.archivadoEn
                "
                @click="editar(oferta)"
              /><UButton
                icon="i-lucide-archive"
                color="neutral"
                variant="ghost"
                aria-label="Archivar oferta"
                :disabled="guardando || !!oferta.archivadoEn"
                @click="archivando = oferta"
              />
            </div>
          </li>
        </ul>
        <UAlert
          v-if="archivando"
          title="¿Archivar esta oferta?"
          description="La aerolínea y la ruta se conservan."
          ><template #actions
            ><UButton
              color="neutral"
              variant="outline"
              :disabled="guardando"
              @click="archivando = null"
              >Cancelar</UButton
            ><UButton
              color="warning"
              :loading="guardando"
              @click="emit('archivar', archivando!.id)"
              >Archivar</UButton
            ></template
          ></UAlert
        >
        <UForm
          v-if="!ruta?.archivadoEn"
          :schema="ofertaRutaSchema"
          :state="estado"
          class="space-y-4 border-t border-border-subtle pt-4"
          @submit="guardar"
        >
          <div class="flex items-center justify-between">
            <h3 class="font-medium">
              {{ editando ? "Editar oferta" : "Nueva oferta" }}
            </h3>
            <UButton
              v-if="editando"
              variant="ghost"
              :disabled="guardando"
              @click="editar(null)"
              >Nueva oferta</UButton
            >
          </div>
          <UFormField name="aerolineaId" label="Aerolínea"
            ><SelectorCatalogo
              v-model="estado.aerolineaId"
              recurso="aerolineas"
              :referencia="editando?.aerolinea"
              label="Aerolínea de la oferta"
              :disabled="guardando"
          /></UFormField>
          <UFormField
            name="codigoAerolinea"
            label="Código de aerolínea"
            help="Permite conservar el código de la fuente cuando todavía no se identifica su aerolínea."
            ><UInput
              v-model="estado.codigoAerolinea"
              class="w-full"
              :disabled="guardando"
          /></UFormField>
          <UFormField name="escalas" label="Escalas"
            ><UInputNumber
              v-model="estado.escalas"
              :min="0"
              :max="2147483647"
              :step="1"
              :disabled="guardando"
          /></UFormField>
          <UCheckbox
            v-model="estado.codigoCompartido"
            label="Código compartido"
            :disabled="guardando"
          />
          <UButton type="submit" :loading="guardando">Guardar oferta</UButton>
        </UForm>
      </div>
    </template>
  </UModal>
</template>
