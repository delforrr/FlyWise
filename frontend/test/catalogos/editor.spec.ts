import { beforeEach, describe, expect, it, vi } from "vitest";
import { shallowMount, flushPromises } from "@vue/test-utils";
import { defineComponent, h } from "vue";
import AdministracionCatalogo from "../../app/features/catalogos/components/AdministracionCatalogo.vue";
import EditorCatalogo from "../../app/features/catalogos/components/EditorCatalogo.vue";
import type { RegistroCatalogo } from "../../app/features/catalogos/schemas/catalogos";

const request = vi.hoisted(() => vi.fn());
vi.mock("~/shared/composables/useBackendRequest", () => ({
  useBackendRequest: () => request,
}));
const registros: RegistroCatalogo[] = [
  { id: "a", nombre: "A", archivadoEn: null, protegidoManualmente: false },
  { id: "b", nombre: "B", archivadoEn: null, protegidoManualmente: false },
];

function montar() {
  return shallowMount(AdministracionCatalogo, {
    props: { recurso: "aeropuertos", titulo: "Aeropuertos" },
    global: {
      stubs: {
        UCard: { template: "<div><slot /></div>" },
        UButton: { template: "<button><slot /></button>" },
        UTable: defineComponent({
          setup(_, { slots }) {
            return () =>
              h(
                "div",
                registros.map((original) =>
                  slots["acciones-cell"]?.({ row: { original } }),
                ),
              );
          },
        }),
      },
    },
  });
}
function pendiente() {
  let resolver!: (r: RegistroCatalogo) => void;
  const promesa = new Promise<RegistroCatalogo>((resolve) => {
    resolver = resolve;
  });
  return { promesa, resolver };
}
beforeEach(() =>
  request.mockReset().mockResolvedValue({ datos: registros, total: 2 }),
);

describe("Selección del editor de catálogos", () => {
  it("conserva la última selección aunque la respuesta anterior llegue después", async () => {
    const wrapper = montar();
    await flushPromises();
    const a = pendiente();
    const b = pendiente();
    request.mockReturnValueOnce(a.promesa).mockReturnValueOnce(b.promesa);
    await wrapper.get('[aria-label="Editar A"]').trigger("click");
    const signal = request.mock.lastCall?.[1]?.signal as
      AbortSignal | undefined;
    await wrapper.get('[aria-label="Editar B"]').trigger("click");
    b.resolver(registros[1]!);
    await flushPromises();
    a.resolver(registros[0]!);
    await flushPromises();
    expect(signal?.aborted).toBe(true);
    expect(
      wrapper.getComponent(EditorCatalogo).props("registro"),
    ).toMatchObject({ id: "b" });
    wrapper
      .getComponent(EditorCatalogo)
      .vm.$emit("guardar", { nombre: "B editado" });
    await flushPromises();
    expect(request).toHaveBeenCalledWith(
      "/administracion/aeropuertos/b",
      expect.objectContaining({ method: "PATCH" }),
    );
    wrapper.unmount();
  });

  it("cancela una edición pendiente al crear y al desmontar", async () => {
    const wrapper = montar();
    await flushPromises();
    const a = pendiente();
    request.mockReturnValueOnce(a.promesa);
    await wrapper.get('[aria-label="Editar A"]').trigger("click");
    const signal = request.mock.lastCall?.[1]?.signal as
      AbortSignal | undefined;
    await wrapper
      .findAll("button")
      .find((b) => b.text() === "Crear registro")!
      .trigger("click");
    a.resolver(registros[0]!);
    await flushPromises();
    expect(signal?.aborted).toBe(true);
    expect(wrapper.getComponent(EditorCatalogo).props("registro")).toBeNull();
    expect(wrapper.getComponent(EditorCatalogo).props("open")).toBe(true);
    request.mockReturnValueOnce(pendiente().promesa);
    await wrapper.get('[aria-label="Editar B"]').trigger("click");
    const ultima = request.mock.lastCall?.[1]?.signal as
      AbortSignal | undefined;
    wrapper.unmount();
    expect(ultima?.aborted).toBe(true);
  });
});
