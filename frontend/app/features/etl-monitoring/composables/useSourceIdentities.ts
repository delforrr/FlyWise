import { computed, ref, watch } from 'vue';
import { useBackendRequest } from '~/shared/composables/useBackendRequest';

export interface PendingIdentity {
  fuente: string;
  identificador: string;
  observacion: { nombre?: string; iata?: string; icao?: string };
  rechazadoEn?: string | null;
}
interface AirportOption {
  id: string;
  nombre: string;
  iata: string | null;
  icao: string | null;
}

export function useSourceIdentities() {
  const request = useBackendRequest();
  const identities = ref<PendingIdentity[]>([]);
  const airports = ref<AirportOption[]>([]);
  const searchTerm = ref('');
  const loading = ref(false), searching = ref(false), error = ref('');
  const pagina = ref(1);
  const verRechazadas = ref(false);
  let searchVersion = 0;

  async function load() {
    loading.value = true;
    error.value = '';
    try {
      identities.value = await request<PendingIdentity[]>('/administracion/fuentes/identidades', {
        query: { pagina: pagina.value, limite: 20, rechazadas: verRechazadas.value },
      });
    } catch { error.value = 'No se pudieron consultar las correspondencias pendientes.'; }
    finally { loading.value = false; }
  }

  async function traerAeropuertos(term: string, signal?: AbortSignal) {
    const q = term.trim();
    return q.length >= 2
      ? request<AirportOption[]>('/aeropuertos/buscar', { query: { q, limit: 20 }, signal })
      : request<AirportOption[]>('/aeropuertos/catalogo', { query: { limit: 20 }, signal });
  }

  // El desplegable siempre arranca con opciones: sin término se muestra el catálogo,
  // y a partir de dos caracteres se consulta la búsqueda por código o nombre.
  watch(searchTerm, (term, _, onCleanup) => {
    const version = ++searchVersion;
    const controller = new AbortController();
    searching.value = true;
    const timer = setTimeout(async () => {
      try {
        const rows = await traerAeropuertos(term, controller.signal);
        if (version === searchVersion) airports.value = rows;
      } catch {
        if (version === searchVersion && !controller.signal.aborted)
          error.value = 'No se pudieron buscar aeropuertos.';
      } finally {
        if (version === searchVersion) searching.value = false;
      }
    }, 200);
    onCleanup(() => { clearTimeout(timer); controller.abort(); });
  }, { immediate: true });

  async function changePage(delta: number) {
    pagina.value = Math.max(1, pagina.value + delta);
    await load();
  }

  async function resolve(identity: PendingIdentity, aeropuertoId: string) {
    await request(`/administracion/fuentes/identidades/${encodeURIComponent(identity.fuente)}/${encodeURIComponent(identity.identificador)}`, { method: 'PATCH', body: { aeropuertoId } });
    await load();
  }

  async function reject(identity: PendingIdentity, rechazado = true) {
    await request(`/administracion/fuentes/identidades/${encodeURIComponent(identity.fuente)}/${encodeURIComponent(identity.identificador)}/rechazo`, {
      method: 'PATCH',
      body: { rechazado },
    });
    await load();
  }

  // Afecta a TODAS las pendientes de OurAirports/OpenFlights, no a la página visible.
  async function rejectAll() {
    const resultado = await request<{ rechazadas: number }>('/administracion/fuentes/identidades/rechazar-todo', {
      method: 'PATCH',
    });
    await load();
    return resultado;
  }

  return {
    identities,
    options: computed(() => airports.value.map(a => ({ label: `${a.iata ?? a.icao ?? 'Sin código'} · ${a.nombre}`, value: a.id }))),
    loading, searching, searchTerm, error, pagina, verRechazadas,
    changePage, load, resolve, reject, rejectAll,
  };
}
