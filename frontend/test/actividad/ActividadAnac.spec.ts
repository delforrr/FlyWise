import { describe, expect, it, vi } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import ActividadAnac from "../../app/features/actividad/ActividadAnac.vue";

const request = vi.hoisted(() => vi.fn());
vi.mock("../../app/shared/composables/useBackendRequest", () => ({
  useBackendRequest: () => request,
}));

describe("Actividad ANAC", () => {
  it("muestra procedencia, calidad y pasajeros con semánticas separadas y permite cambiar el mes", async () => {
    request.mockImplementation(
      (path: string, options?: { query?: { intento?: number } }) => {
        if (path.endsWith("/ejecuciones"))
          return Promise.resolve([
            {
              id: "recuperada",
              estado: "completed",
              intento: 2,
              filasProcesadas: 2,
              filasDescartadas: 0,
              mensajeError: null,
              instantaneaConfiguracion: { conexion: { periodo: "2026-08" } },
            },
          ]);
        if (path.endsWith("/muestras"))
          return Promise.resolve(
            options?.query?.intento === 1
              ? [
                  {
                    numeroFila: 7,
                    motivo: "PAX inválido",
                    muestraOriginal: "{}",
                  },
                ]
              : [],
          );
        if (path.endsWith("/configuracion"))
          return Promise.resolve({
            fichaUrl:
              "https://datos.transporte.gob.ar/dataset/anac/archivo/recurso",
            expresionCron: "0 5 20 * *",
            pausado: true,
          });
        if (path.endsWith("/actividad-anac"))
          return Promise.resolve({
            datos: [
              {
                numeroFila: 1,
                fechaUtc: "2026-08-01 00:01",
                movimiento: "DESPEGUE",
                aeropuerto: "AER",
                origen: "AER",
                destino: "CBA",
                operador: "Operador ANAC",
                clasificacion: "Doméstico",
                pasajeros: 120,
                pax: 120,
                calidad: "PROVISORIO",
              },
            ],
            total: 1,
            resumen: [
              {
                clasificacion: "Doméstico",
                movimientos: 2,
                despegues: 1,
                aterrizajes: 1,
                pasajeros: 240,
                pax: 120,
                movimientosConPasajeros: 2,
                movimientosConPax: 2,
              },
            ],
            cobertura: {
              estado: "publicada",
              revisionId: "revision",
              actualizadoEn: "2026-11-08",
              filasProcesadas: 2,
              uri: "https://datos.transporte.gob.ar/datos.csv",
            },
            fuente: "ANAC — CC BY 4.0",
          });
        return Promise.resolve([]);
      },
    );
    const wrapper = mount(ActividadAnac, {
      global: {
        stubs: {
          UButton: { template: "<button><slot/></button>" },
          UInput: {
            props: ["modelValue"],
            emits: ["update:modelValue"],
            template:
              '<input :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />',
          },
          USelectMenu: true,
        },
      },
    });
    await flushPromises();
    expect(wrapper.text()).toContain("ANAC — CC BY 4.0");
    expect(wrapper.text()).toContain("PROVISORIO");
    expect(wrapper.text()).toContain("240");
    expect(wrapper.text()).toContain("PAX");
    expect(wrapper.text()).toContain("tarjetas de embarque");
    await wrapper.get('input[type="month"]').setValue("2026-08");
    await wrapper
      .get('form[aria-label="Consultar actividad"]')
      .trigger("submit");
    await flushPromises();
    expect(request).toHaveBeenCalledWith(
      "/administracion/actividad-anac",
      expect.objectContaining({
        query: expect.objectContaining({ periodo: "2026-08" }),
      }),
    );
    await wrapper
      .findAll("button")
      .find((button) => button.text() === "Ver descartes")!
      .trigger("click");
    await flushPromises();
    await wrapper
      .get('select[aria-label="Intento de descartes"]')
      .setValue("1");
    await flushPromises();
    expect(wrapper.text()).toContain("Fila 7: PAX inválido");
    wrapper.unmount();
  });
});
