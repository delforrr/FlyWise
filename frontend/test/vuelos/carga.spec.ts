import { flushPromises, mount } from "@vue/test-utils";
import { expect, it, vi } from "vitest";
import CargaVuelosModal from "~/features/vuelos/components/CargaVuelosModal.vue";

const request = vi.hoisted(() => vi.fn());
vi.mock("~/shared/composables/useBackendRequest", () => ({
  useBackendRequest: () => request,
}));

it("pide la cobertura mensual sin elegir fuente y actualiza el mes al completar", async () => {
  request.mockResolvedValueOnce({ ultimoMesCerrado: "2026-10", coberturaMensual: "Cobertura de prueba" })
    .mockResolvedValueOnce({ ejecucionId: "carga-1", periodo: "2026-10" })
    .mockResolvedValueOnce({ estado: "completed", filasProcesadas: 15, mensajeError: null });
  const wrapper = mount(CargaVuelosModal, {
    global: {
      stubs: {
        UModal: { template: '<div><slot name="body" /></div>' },
        UFormField: { template: "<div><slot /></div>" },
        USelect: {
          props: ["modelValue", "items"],
          emits: ["update:modelValue"],
          template: '<select :value="modelValue" @change="$emit(\'update:modelValue\',$event.target.value)"><option v-for="item in items" :value="item.value">{{item.label}}</option></select>',
        },
        UInput: true,
        UButton: { template: "<button><slot /></button>" },
        SelectorCatalogo: true,
      },
    },
  });
  try {
    await flushPromises();
    expect(wrapper.text()).toContain("Cobertura de prueba");
    await wrapper.get("select").setValue("mensual");
    await wrapper.get("form").trigger("submit");
    await flushPromises();
    expect(request).toHaveBeenCalledWith("/administracion/cargas-vuelos", {
      method: "POST",
      signal: expect.any(AbortSignal),
      body: { alcance: "mensual" },
    });
    expect(wrapper.emitted("completada")).toEqual([["2026-10"]]);
    expect(wrapper.text()).toContain("15 operaciones procesadas.");
  } finally {
    wrapper.unmount();
  }
});
