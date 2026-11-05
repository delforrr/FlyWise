import { ref, watch } from "vue";
import { mapCatalogAirport, useCatalog, type CatalogAirport } from "~/shared/composables/useCatalog";
import { useBackendRequest } from "~/shared/composables/useBackendRequest";
import type { Aeropuerto } from "~/types/airport";

export function useAirportSearch(search: () => string) {
  const { aeropuertos, rememberAirport } = useCatalog();
  const request = useBackendRequest();
  const results = ref<Aeropuerto[]>([]);
  const loading = ref(false);
  const searchError = ref(false);

  watch(() => search().trim(), (q, _, onCleanup) => {
    results.value = [];
    loading.value = false;
    searchError.value = false;
    if (q.length < 2) return;

    const controller = new AbortController();
    loading.value = true;
    const timer = setTimeout(async () => {
      try {
        const rows = await request<CatalogAirport[]>("/aeropuertos/buscar", {
          query: { q, limit: 20 },
          signal: controller.signal,
        });
        if (!controller.signal.aborted) results.value = rows.map(mapCatalogAirport);
      } catch {
        if (!controller.signal.aborted) searchError.value = true;
      } finally {
        if (!controller.signal.aborted) loading.value = false;
      }
    }, 250);
    onCleanup(() => {
      clearTimeout(timer);
      controller.abort();
    });
  });

  function rememberResult(id: string) {
    const airport = results.value.find(a => a.id === id);
    if (airport) rememberAirport(airport);
  }

  return { aeropuertos, results, loading, searchError, rememberResult };
}
