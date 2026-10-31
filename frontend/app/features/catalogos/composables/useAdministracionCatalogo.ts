import { ref, watch, onScopeDispose } from "vue";
import { useBackendRequest } from "~/shared/composables/useBackendRequest";
import type {
  DatosCatalogo,
  PaginaCatalogo,
  RecursoCatalogo,
  RegistroCatalogo,
} from "../schemas/catalogos";

export function useAdministracionCatalogo(recurso: RecursoCatalogo) {
  const request = useBackendRequest();
  const toast = useToast();
  const registros = ref<RegistroCatalogo[]>([]);
  const total = ref(0);
  const pagina = ref(1);
  const limite = 20;
  const busqueda = ref("");
  const estado = ref("vigentes");
  const cargando = ref(false);
  const guardando = ref(false);
  const error = ref("");
  let lectura: AbortController | undefined;
  onScopeDispose(() => lectura?.abort());

  function mensaje(causa: unknown) {
    const valor = (causa as { data?: { message?: unknown } })?.data?.message;
    return Array.isArray(valor)
      ? valor.join(" ")
      : typeof valor === "string"
        ? valor
        : "No pudimos completar la solicitud. Intentá nuevamente.";
  }
  async function cargar() {
    lectura?.abort();
    const actual = new AbortController();
    lectura = actual;
    cargando.value = true;
    error.value = "";
    try {
      const resultado = await request<PaginaCatalogo>(
        `/administracion/${recurso}`,
        {
          query: {
            busqueda: busqueda.value,
            estado: estado.value,
            pagina: pagina.value,
            limite,
          },
          signal: actual.signal,
        },
      );
      if (!actual.signal.aborted) {
        registros.value = resultado.datos;
        total.value = resultado.total;
      }
    } catch (causa: unknown) {
      if (!actual.signal.aborted) error.value = mensaje(causa);
    } finally {
      if (lectura === actual) cargando.value = false;
    }
  }
  watch([busqueda, estado], () => {
    if (pagina.value !== 1) pagina.value = 1;
    else void cargar();
  });
  watch(pagina, () => {
    void cargar();
  });

  async function detalle(id: string, signal?: AbortSignal) {
    try {
      return await request<RegistroCatalogo>(
        `/administracion/${recurso}/${id}`,
        { signal },
      );
    } catch (causa: unknown) {
      throw new Error(mensaje(causa));
    }
  }
  async function guardar(
    datos: DatosCatalogo | { protegidoManualmente: false },
    id?: string,
  ) {
    if (guardando.value) return false;
    guardando.value = true;
    try {
      await request(`/administracion/${recurso}${id ? "/" + id : ""}`, {
        method: id ? "PATCH" : "POST",
        body: datos,
      });
      toast.add({
        title: id ? "Cambios guardados" : "Registro creado",
        color: "success",
      });
      await cargar();
      return true;
    } catch (causa: unknown) {
      throw new Error(mensaje(causa));
    } finally {
      guardando.value = false;
    }
  }
  async function archivar(id: string) {
    if (guardando.value) return false;
    guardando.value = true;
    try {
      await request(`/administracion/${recurso}/${id}`, { method: "DELETE" });
      toast.add({
        title: "Registro archivado",
        description: "Se conservan sus relaciones y datos históricos.",
        color: "success",
      });
      if (registros.value.length === 1 && pagina.value > 1) pagina.value--;
      else await cargar();
      return true;
    } catch (causa: unknown) {
      throw new Error(mensaje(causa));
    } finally {
      guardando.value = false;
    }
  }
  async function guardarOferta(
    rutaId: string,
    datos: Record<string, unknown>,
    ofertaId?: string,
  ) {
    if (guardando.value) return false;
    guardando.value = true;
    try {
      await request(
        `/administracion/rutas/${rutaId}/ofertas${ofertaId ? "/" + ofertaId : ""}`,
        { method: ofertaId ? "PATCH" : "POST", body: datos },
      );
      toast.add({ title: "Oferta guardada", color: "success" });
      await cargar();
      return true;
    } catch (causa: unknown) {
      throw new Error(mensaje(causa));
    } finally {
      guardando.value = false;
    }
  }
  async function archivarOferta(rutaId: string, ofertaId: string) {
    if (guardando.value) return false;
    guardando.value = true;
    try {
      await request(`/administracion/rutas/${rutaId}/ofertas/${ofertaId}`, {
        method: "DELETE",
      });
      toast.add({ title: "Oferta archivada", color: "success" });
      await cargar();
      return true;
    } catch (causa: unknown) {
      throw new Error(mensaje(causa));
    } finally {
      guardando.value = false;
    }
  }
  return {
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
  };
}
