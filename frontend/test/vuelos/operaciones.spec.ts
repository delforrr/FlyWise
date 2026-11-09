import { beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import OperacionesAdmin from "../../app/features/vuelos/components/OperacionesAdmin.vue";

const request = vi.hoisted(() => vi.fn());
vi.mock("~/shared/composables/useBackendRequest", () => ({
  useBackendRequest: () => request,
}));
const vuelo = {
  id: "v1",
  version: 3,
  fuente: "BTS",
  fechaVuelo: "2020-02-01",
  numeroVuelo: "BTS1",
  origenId: "o",
  destinoId: "d",
  aerolineaId: "a",
  estado: "ARRIVED",
  demoraLlegadaMinutos: 0,
  protegidoManualmente: true,
  archivadoEn: null,
  ultimaObservacion: {},
  origen: { id: "o", nombre: "Origen", iata: "AAA" },
  destino: { id: "d", nombre: "Destino", iata: "BBB" },
  aerolinea: { id: "a", nombre: "Operador" },
};
function montar() {
  return mount(OperacionesAdmin, {
    global: {
      stubs: {
        UButton: { template: "<button><slot /></button>" },
        UInput: {
          props: ["modelValue"],
          emits: ["update:modelValue"],
          template:
            '<input :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />',
        },
        USelect: {
          props: ["modelValue", "items"],
          emits: ["update:modelValue"],
          template:
            '<select :value="modelValue" @change="$emit(\'update:modelValue\',$event.target.value)"><option v-for="item in items" :value="item.value">{{item.label}}</option></select>',
        },
        SelectorCatalogo: { template: "<input />" },
      },
    },
  });
}
beforeEach(() => {
  request.mockReset().mockImplementation(async (path: string) =>
    path.endsWith("/historial")
      ? {
          datos: [
            {
              version: 3,
              accion: "editar",
              actorId: "admin",
              creadoEn: "2020-02-01",
              instantanea: { demoraLlegadaMinutos: 0 },
            },
          ],
          total: 1,
        }
      : path === "/metricas/rutas"
        ? {
            datos: [
              {
                origenId: "o",
                destinoId: "d",
                vuelosTotales: 8,
                vuelosCancelados: 1,
                vuelosDesviados: 1,
                vuelosPuntuales: 0,
                otp15: 0,
                pendiente: true,
                fuentes: ["BTS"],
                actualizadoEn: "2020-02-01",
              },
            ],
            total: 1,
          }
        : path.includes("/v1")
          ? vuelo
          : { datos: [vuelo], total: 1 },
  );
});
describe("Administración de operaciones", () => {
  it("deja en blanco la demora hasta que el administrador la indique", async () => {
    const wrapper = montar();
    await flushPromises();
    await wrapper
      .findAll("button")
      .find((button) => button.text() === "Crear operación")!
      .trigger("click");
    expect(
      wrapper.get<HTMLInputElement>(
        '[aria-label="Demora de llegada en minutos"]',
      ).element.value,
    ).toBe("");
    wrapper.unmount();
  });
  it("muestra cero OTP y conserva el cálculo pendiente con su muestra y fuente", async () => {
    const wrapper = montar();
    await flushPromises();
    await wrapper.get('[aria-label="Ver operación BTS1"]').trigger("click");
    await flushPromises();
    expect(wrapper.text()).toContain("0%");
    expect(wrapper.text()).toContain("Actualización pendiente");
    expect(wrapper.text()).toContain("8 operaciones");
    expect(wrapper.text()).toContain("BTS");
    wrapper.unmount();
  });
  it("envía la versión al archivar y presenta el historial paginado", async () => {
    const wrapper = montar();
    await flushPromises();
    await wrapper.get('[aria-label="Ver operación BTS1"]').trigger("click");
    await flushPromises();
    expect(wrapper.text()).toContain("editar");
    await wrapper.get('[data-action="archivar"]').trigger("click");
    await flushPromises();
    expect(request).toHaveBeenCalledWith(
      "/administracion/vuelos/v1/archivar",
      expect.objectContaining({ method: "POST", body: { version: 3 } }),
    );
    wrapper.unmount();
  });
});
