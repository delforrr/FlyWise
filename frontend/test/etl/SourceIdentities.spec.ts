import { describe, expect, it, vi } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import SourceIdentities from "../../app/features/etl-monitoring/components/SourceIdentities.vue";

const request = vi.hoisted(() => vi.fn());
vi.mock("../../app/shared/composables/useBackendRequest", () => ({
  useBackendRequest: () => request,
}));

const pendiente = {
  fuente: "OurAirports",
  identificador: "123",
  observacion: { nombre: "Aeropuerto de prueba", iata: "PRU" },
  rechazadoEn: null,
};

function mockBackend(pendientes: typeof pendiente[] = [pendiente], rechazadas: typeof pendiente[] = []) {
  request.mockImplementation((path: string, options?: { method?: string; body?: unknown; query?: Record<string, unknown> }) => {
    if (path.endsWith("/identidades"))
      return Promise.resolve(options?.query?.rechazadas ? rechazadas : pendientes);
    if (path.endsWith("/catalogo"))
      return Promise.resolve([{ id: "aeropuerto-id", nombre: "Puerto", iata: "PRU", icao: "PRUR" }]);
    if (path.endsWith("/rechazar-todo"))
      return Promise.resolve({ rechazadas: 4 });
    if (options?.method === "PATCH") return Promise.resolve({ resuelto: true });
    return Promise.resolve([]);
  });
}

async function render() {
  return mount(SourceIdentities, {
    global: {
      stubs: {
        UCard: { template: "<div><slot name='header'/><slot /></div>" },
        UButton: { template: "<button><slot /></button>" },
        USelectMenu: {
          props: ["modelValue", "items", "loading"],
          template: '<div data-testid="selector">{{ items.length }} opciones</div>',
        },
      },
    },
  });
}

async function esperarBuscador() {
  await new Promise((resolve) => setTimeout(resolve, 260));
  await flushPromises();
}

type Wrapper = Awaited<ReturnType<typeof render>>;
function boton(wrapper: Wrapper, texto: string) {
  const encontrado = wrapper.findAll("button").find((b) => b.text() === texto);
  if (!encontrado) throw new Error(`No se encontró el botón «${texto}»`);
  return encontrado;
}

describe("Correspondencias pendientes", () => {
  it("muestra opciones apenas se abre el selector", async () => {
    mockBackend();
    const wrapper = await render();
    await flushPromises();
    await esperarBuscador();
    expect(wrapper.get('[data-testid="selector"]').text()).toContain("1 opciones");
    wrapper.unmount();
  });

  it("permite rechazar una correspondencia", async () => {
    mockBackend();
    const wrapper = await render();
    await flushPromises();
    await wrapper.findAll("button").find((button) => button.text() === "Rechazar")!.trigger("click");
    await flushPromises();
    expect(request).toHaveBeenCalledWith(
      "/administracion/fuentes/identidades/OurAirports/123/rechazo",
      expect.objectContaining({ method: "PATCH", body: { rechazado: true } }),
    );
    expect(wrapper.text()).toContain("Correspondencia rechazada");
    wrapper.unmount();
  });

  it("permite consultar y restaurar las rechazadas", async () => {
    mockBackend([], [{ ...pendiente, rechazadoEn: "2026-11-20 12:00:00" }]);
    const wrapper = await render();
    await flushPromises();
    await wrapper.findAll("button").find((button) => button.text() === "Ver rechazadas")!.trigger("click");
    await flushPromises();
    expect(request).toHaveBeenCalledWith(
      "/administracion/fuentes/identidades",
      expect.objectContaining({ query: expect.objectContaining({ rechazadas: true }) }),
    );
    await wrapper.findAll("button").find((button) => button.text() === "Restaurar")!.trigger("click");
    await flushPromises();
    expect(request).toHaveBeenCalledWith(
      "/administracion/fuentes/identidades/OurAirports/123/rechazo",
      expect.objectContaining({ method: "PATCH", body: { rechazado: false } }),
    );
    wrapper.unmount();
  });

  it("pide confirmación antes de rechazar todo y permite cancelar", async () => {
    mockBackend();
    const wrapper = await render();
    await flushPromises();
    await boton(wrapper, "Rechazar todo").trigger("click");
    expect(wrapper.text()).toContain("¿Rechazar todas las correspondencias pendientes?");
    expect(wrapper.text()).toContain("no solo las de esta página");
    expect(request).not.toHaveBeenCalledWith(
      "/administracion/fuentes/identidades/rechazar-todo",
      expect.anything(),
    );
    await boton(wrapper, "Cancelar").trigger("click");
    expect(wrapper.text()).not.toContain("¿Rechazar todas las correspondencias pendientes?");
    expect(request).not.toHaveBeenCalledWith(
      "/administracion/fuentes/identidades/rechazar-todo",
      expect.anything(),
    );
    wrapper.unmount();
  });

  it("rechaza todas las pendientes tras confirmar", async () => {
    mockBackend();
    const wrapper = await render();
    await flushPromises();
    await boton(wrapper, "Rechazar todo").trigger("click");
    await boton(wrapper, "Confirmar rechazo").trigger("click");
    await flushPromises();
    expect(request).toHaveBeenCalledWith("/administracion/fuentes/identidades/rechazar-todo", {
      method: "PATCH",
    });
    expect(wrapper.text()).toContain("Se rechazaron 4 correspondencias");
    expect(wrapper.text()).not.toContain("¿Rechazar todas las correspondencias pendientes?");
    wrapper.unmount();
  });
});
