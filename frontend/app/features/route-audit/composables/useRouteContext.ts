import { onMounted, shallowRef, watch } from 'vue';
import { useRouteMetricOverlay } from '~/features/flight-map/composables/useRouteMetrics';
import { useBackendRequest } from '~/shared/composables/useBackendRequest';
import type { FlightRoute } from '~/types/route';

interface RouteContext {
  actividad: { despegues: number; pasajeros: number | null } | null;
  indicadores: { aeropuerto: string; desde: string; hasta: string; puntualidadLlegada: number }[];
}

export function useRouteContext(route: () => FlightRoute) {
  const request = useBackendRequest({ notificarError: false });
  const { filtro } = useRouteMetricOverlay();
  const context = shallowRef<(RouteContext & { periodo: string }) | null>(null);

  onMounted(() => {
    watch([
      () => route().origenId,
      () => route().destinoId,
      () => filtro.value.periodo,
    ], async ([origenId, destinoId, periodo], _, onCleanup) => {
      context.value = null;
      if (!periodo) return;

      const controller = new AbortController();
      onCleanup(() => controller.abort());
      try {
        const response = await request<RouteContext>('/metricas/mapa/contexto', {
          query: { origenId, destinoId, periodo },
          signal: controller.signal,
        });
        if (!controller.signal.aborted) context.value = { ...response, periodo };
      } catch {
        // Las fuentes externas son opcionales para mostrar el tramo.
      }
    }, { immediate: true, flush: 'sync' });
  });
  return context;
}
