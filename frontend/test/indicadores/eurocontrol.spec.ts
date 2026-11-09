import { mount, flushPromises } from "@vue/test-utils";
import { describe, it, expect, vi } from "vitest";
import EurocontrolPanel from "../../app/features/indicadores/components/EurocontrolPanel.vue";
const fetcher = vi.hoisted(() => vi.fn());
vi.mock("../../app/shared/composables/useBackendRequest", () => ({
  useBackendRequest: () => fetcher,
}));
describe("Indicadores EUROCONTROL en Admin", () => {
  it("muestra cero, fuente y contadores sin confundir indicadores con OTP de rutas", async () => {
    fetcher.mockImplementation(async (path: string) =>
      path.endsWith("/fuentes")
        ? []
        : path.endsWith("/instantaneas")
          ? { total: 0, datos: [] }
          : {
              total: 1,
              datos: [
                {
                  instantaneaId: "s1",
                  producto: "network",
                  atribucion: "EUROCONTROL",
                  aviso: "© EUROCONTROL. No warranties.",
                  metodologia: [
                    ["ARR_PUN_DY", "Puntualidad nativa hasta 15:59"],
                  ],
                  ambito: "NETWORK",
                  entidad: "NM Area",
                  nombre: "NM Area",
                  granularidad: "DY",
                  desde: "2026-08-31",
                  hasta: "2026-08-31",
                  valores: {
                    ARR_PUN: 0,
                    ARR_SCHED_FLIGHTS: 10,
                    ARR_PUNCTUAL_FLIGHTS: 0,
                    MISSING_SCHED_FLIGHTS: 1,
                  },
                },
              ],
            },
    );
    const wrapper = mount(EurocontrolPanel);
    await flushPromises();
    expect(wrapper.text()).toContain("0,0 %");
    expect(wrapper.text()).toContain("EUROCONTROL");
    expect(wrapper.text()).toContain("15:59");
    expect(wrapper.text()).toContain("No son cancelaciones");
    await wrapper.get('select[aria-label="Granularidad"]').setValue("WK");
    await wrapper.get("form").trigger("submit");
    await flushPromises();
    expect(fetcher).toHaveBeenLastCalledWith(
      "/administracion/indicadores/eurocontrol",
      expect.objectContaining({
        query: expect.objectContaining({ granularidad: "WK" }),
      }),
    );
  });
  it("restablece la granularidad de red y permite consultar revisiones anteriores a las primeras veinte", async () => {
    fetcher.mockImplementation(
      async (path: string, options?: { query?: { pagina?: number } }) => {
        if (path.endsWith("/fuentes")) return [];
        if (path.endsWith("/instantaneas"))
          return {
            total: 21,
            datos:
              options?.query?.pagina === 2
                ? [{ id: "older", actualizadoEn: "2024-04-01" }]
                : [],
          };
        return { total: 0, datos: [] };
      },
    );
    const wrapper = mount(EurocontrolPanel);
    await flushPromises();
    await wrapper.get('select[aria-label="Producto"]').setValue("stakeholder");
    await flushPromises();
    await wrapper.get('select[aria-label="Granularidad"]').setValue("Y2D");
    await wrapper.get('select[aria-label="Producto"]').setValue("network");
    await flushPromises();
    expect(fetcher).toHaveBeenLastCalledWith(
      "/administracion/indicadores/eurocontrol",
      expect.objectContaining({
        query: expect.objectContaining({ granularidad: "DY" }),
      }),
    );
    await wrapper
      .findAll("button")
      .find((button) => button.text() === "Más antiguas")!
      .trigger("click");
    await flushPromises();
    await wrapper.get('select[aria-label="Instantánea"]').setValue("older");
    await wrapper.get("form").trigger("submit");
    await flushPromises();
    expect(fetcher).toHaveBeenLastCalledWith(
      "/administracion/indicadores/eurocontrol",
      expect.objectContaining({
        query: expect.objectContaining({ instantaneaId: "older" }),
      }),
    );
  });
});
