import { afterEach, expect, it, vi } from 'vitest';
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils';
import { useGlobalMap } from '../../app/features/flight-map/composables/useGlobalMap';
import RouteCounterBadge from '../../app/features/route-audit/components/indicators/RouteCounterBadge.vue';
import RouteHeader from '../../app/features/route-audit/components/results/RouteHeader.vue';
import RouteResults from '../../app/features/route-audit/components/results/RouteResults.vue';
import FromToDate from '../../app/features/route-audit/components/search/FromToDate.vue';
import MobileSearchDrawer from '../../app/features/route-audit/components/search/MobileSearchDrawer.vue';
import { useFlightSelection } from '../../app/features/route-audit/composables/useFlightSelection';
import Explorar from '../../app/pages/explorar.vue';
import { useCatalog, type ArcRoute } from '../../app/shared/composables/useCatalog';

const eze: ArcRoute['origen'] = {
  id: 'uuid-eze', iata: 'EZE', icao: null, nombre: 'Ministro Pistarini',
  ciudad: 'Buenos Aires', pais: 'Argentina', coordenadas: [-58, -34],
};
const jfk: ArcRoute['destino'] = {
  id: 'uuid-jfk', iata: 'JFK', icao: null, nombre: 'John F. Kennedy',
  ciudad: 'Nueva York', pais: 'Estados Unidos', coordenadas: [-73, 40],
};
const offer: ArcRoute = {
  id: 'eze-jfk', origen: eze, destino: jfk, distanciaKm: 8525,
  aerolinea: { iata: 'AA', nombre: 'American Airlines' }, escalas: 0, otp15: null,
};

function mountExplorer(fetchRoutes: () => Promise<ArcRoute[]>) {
  vi.stubGlobal('useSeoMeta', vi.fn());
  vi.stubGlobal('useCatalog', useCatalog);
  vi.stubGlobal('useFlightSelection', useFlightSelection);
  vi.stubGlobal('useGlobalMap', useGlobalMap);
  vi.stubGlobal('$fetch', vi.fn((url: string) =>
    url === '/api/rutas/explorar' ? fetchRoutes() : Promise.resolve([]),
  ));

  const selection = useFlightSelection();
  selection.setRoute(eze.id, jfk.id);
  const wrapper = mount(Explorar, {
    global: {
      stubs: {
        RouteResults, RouteHeader, RouteCounterBadge, MobileSearchDrawer,
        UCard: { template: '<div><slot name="header" /><slot /></div>' },
        UEmpty: { props: ['title'], template: '<p>{{ title }}</p>' },
        AppHeader: { components: { FromToDate }, template: '<FromToDate />' },
        HudContainer: { template: '<div><slot /></div>' },
        UDrawer: { template: '<div><slot name="footer" /></div>' },
        UBadge: { template: '<span><slot /></span>' },
        GlobalMapFilters: true, HudWrapper: true, AirportSelectInput: true,
        USeparator: true, UPopover: true, UCalendar: true,
        ClientOnly: true, FlightMap: true, MapTooltip: true, UButton: true, UIcon: true, RouteDirectCard: true,
        RouteConnectingList: true, RouteHubConnections: true,
      },
    },
  });
  return { wrapper, selection };
}

enableAutoUnmount(afterEach);

it('muestra carga mientras EZE → JFK está pendiente y luego muestra la ida', async () => {
  const response = Promise.withResolvers<ArcRoute[]>();
  const { wrapper } = mountExplorer(() => response.promise);

  await flushPromises();
  expect(wrapper.text()).not.toContain('Sin rutas disponibles');
  expect(wrapper.get('[role="status"]').text()).toBe('Cargando rutas…');
  expect(wrapper.text()).not.toMatch(/0\s*rutas/);

  response.resolve([offer]);
  await flushPromises();
  expect(wrapper.text()).toContain('Ida · EZE → JFK');
  expect(wrapper.text()).not.toContain('Cargando rutas');
});

it('mantiene la búsqueda más reciente pendiente y solo muestra vacío al completarla', async () => {
  const first = Promise.withResolvers<ArcRoute[]>();
  const latest = Promise.withResolvers<ArcRoute[]>();
  const fetchRoutes = vi.fn().mockReturnValueOnce(first.promise).mockReturnValueOnce(latest.promise);
  const { wrapper, selection } = mountExplorer(fetchRoutes);

  selection.setRoute(eze.id, 'uuid-mad');
  await flushPromises();
  first.resolve([offer]);
  await flushPromises();
  expect(wrapper.get('[role="status"]').text()).toBe('Cargando rutas…');

  latest.resolve([]);
  await flushPromises();
  expect(wrapper.text()).toContain('Sin rutas disponibles');
  expect(wrapper.text()).not.toContain('Cargando rutas');
});

it('muestra un error en lugar de un resultado vacío cuando falla la búsqueda', async () => {
  const { wrapper } = mountExplorer(() => Promise.reject(new Error('Service unavailable')));

  await flushPromises();
  expect(wrapper.get('[role="alert"]').text()).toBe('No se pudieron consultar las rutas.');
  expect(wrapper.text()).not.toContain('Sin rutas disponibles');
});

it('solo anuncia conteos de rutas cuando hay una respuesta válida', async () => {
  const response = Promise.withResolvers<ArcRoute[]>();
  const { wrapper } = mountExplorer(() => response.promise);

  await flushPromises();
  expect(wrapper.find('[aria-label="0 rutas disponibles"]').exists()).toBe(false);

  response.resolve([]);
  await flushPromises();
  expect(wrapper.findAll('[aria-label="0 rutas disponibles"]')).toHaveLength(2);
});
