import { beforeEach, describe, expect, it, vi } from "vitest";
import { effectScope, nextTick } from "vue";
import { flushPromises } from "@vue/test-utils";
import { useAdministracionCatalogo } from "../../app/features/catalogos/composables/useAdministracionCatalogo";

const request = vi.hoisted(() => vi.fn());
vi.mock("~/shared/composables/useBackendRequest", () => ({
  useBackendRequest: () => request,
}));
beforeEach(() => request.mockReset());

function catalogo() {
  const scope = effectScope();
  const crud = scope.run(() => useAdministracionCatalogo("aeropuertos"))!;
  return { crud, scope };
}

describe("Administración de catálogos", () => {
  it("descarta respuestas anteriores y cancela la lectura al salir de la pantalla", async () => {
    let resolver!: (value: unknown) => void;
    request.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolver = resolve;
        }),
    );
    const { crud, scope } = catalogo();
    const primera = crud.cargar();
    const primeraSignal = request.mock.calls[0]![1].signal as AbortSignal;
    request.mockResolvedValueOnce({ datos: [{ id: "actual" }], total: 1 });
    await crud.cargar();
    expect(primeraSignal.aborted).toBe(true);
    resolver({ datos: [{ id: "viejo" }], total: 100 });
    await primera;
    expect(crud.registros.value.map((r) => r.id)).toEqual(["actual"]);
    expect(crud.total.value).toBe(1);
    const signal = request.mock.calls[1]![1].signal as AbortSignal;
    scope.stop();
    expect(signal.aborted).toBe(true);
  });

  it("muestra conflictos de API y conserva la edición disponible para corregirla", async () => {
    const { crud, scope } = catalogo();
    request.mockRejectedValueOnce({
      data: { message: "El registro ya existe" },
    });
    await expect(
      crud.guardar({ protegidoManualmente: false }, "id"),
    ).rejects.toThrow("ya existe");
    expect(crud.guardando.value).toBe(false);
    request
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce({ datos: [], total: 0 });
    expect(await crud.guardar({ protegidoManualmente: false }, "id")).toBe(
      true,
    );
    expect(request).toHaveBeenCalledWith(
      "/administracion/aeropuertos/id",
      expect.objectContaining({
        method: "PATCH",
        body: { protegidoManualmente: false },
      }),
    );
    scope.stop();
  });

  it("retrocede de página al archivar su última fila y vuelve a consultar", async () => {
    const { crud, scope } = catalogo();
    request.mockResolvedValue({ datos: [{ id: "ultimo" }], total: 21 });
    crud.pagina.value = 2;
    await nextTick();
    await flushPromises();
    request
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce({ datos: [], total: 20 });
    await crud.archivar("ultimo");
    await flushPromises();
    expect(crud.pagina.value).toBe(1);
    expect(request).toHaveBeenCalledWith("/administracion/aeropuertos/ultimo", {
      method: "DELETE",
    });
    expect(request).toHaveBeenLastCalledWith(
      "/administracion/aeropuertos",
      expect.objectContaining({
        query: expect.objectContaining({ pagina: 1 }),
      }),
    );
    scope.stop();
  });
});
