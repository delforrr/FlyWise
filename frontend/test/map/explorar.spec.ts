import { describe, it, expect, vi, beforeEach } from 'vitest';
import { flushPromises, shallowMount } from '@vue/test-utils';
import { ref, nextTick } from 'vue';
import Explorar from '../../app/pages/explorar.vue';
import { useGlobalMap, type GlobalMapFilter } from '../../app/features/flight-map/composables/useGlobalMap';

vi.mock('~/features/flight-map/composables/useShortcuts', () => ({ useShortcuts: vi.fn() }));

function setup(origen?: string, useMap?: typeof useGlobalMap) {
  const selectedOrigin = ref(origen);
  const selectedDestination = ref<string>();
  const globalMap = {
    isOpen: ref(false), filter: ref<GlobalMapFilter>({ mode: 'global', limit: 50 }),
    visibleRoutes: ref([]), loading: ref(false), error: ref(null), load: vi.fn(),
  };
  const clearSelection = () => { selectedOrigin.value = undefined; selectedDestination.value = undefined; };
  const loadRoutes = vi.fn();
  vi.stubGlobal('useSeoMeta', vi.fn());
  vi.stubGlobal('useCatalog', () => ({ aeropuertos: ref([]), rutas: ref([]), error: ref(null), loadAirports: vi.fn(), loadRoutes }));
  vi.stubGlobal('useFlightSelection', () => ({ selectedOrigin, selectedDestination, clearSelection }));
  vi.stubGlobal('useGlobalMap', useMap ?? (() => globalMap));
  const wrapper = shallowMount(Explorar, { global: { stubs: {
    GlobalMapFilters: { name: 'GlobalMapFilters', emits: ['apply'], template: '<div />' },
    UButton: { props: ['label'], template: '<button>{{ label }}</button>' },
    ClientOnly: true, AppHeader: true, RouteResults: true, HudWrapper: true, MobileSearchDrawer: true,
    UIcon: true, FlightMap: true, MapTooltip: true,
  } } });
  return { wrapper, selectedOrigin, selectedDestination, globalMap, clearSelection, loadRoutes };
}

describe('Global map entry', () => {
  beforeEach(() => vi.clearAllMocks());
  it('opens on a global entry and when returning from a selection', async () => {
    const state = setup();
    expect(state.globalMap.isOpen.value).toBe(true); expect(state.globalMap.load).toHaveBeenCalledTimes(1);
    state.globalMap.isOpen.value = false;
    state.selectedOrigin.value = 'airport-a'; await nextTick();
    expect(state.loadRoutes).toHaveBeenCalledWith('airport-a', undefined);
    state.clearSelection(); await nextTick();
    expect(state.globalMap.isOpen.value).toBe(true);
    expect(state.globalMap.load).toHaveBeenCalledTimes(2);
    state.wrapper.unmount();
  });
  it('preserves selection on entry and applying filters returns to global without reopening', async () => {
    const state = setup('airport-a');
    expect(state.globalMap.isOpen.value).toBe(false); expect(state.globalMap.load).not.toHaveBeenCalled();
    state.globalMap.isOpen.value = true;
    state.wrapper.findComponent({ name: 'GlobalMapFilters' }).vm.$emit('apply', { mode: 'global', limit: 20 });
    await nextTick();
    expect(state.selectedOrigin.value).toBeUndefined();
    expect(state.globalMap.filter.value.limit).toBe(20);
    expect(state.globalMap.isOpen.value).toBe(false);
    expect(state.globalMap.load).toHaveBeenCalledTimes(1);
    state.wrapper.unmount();
  });
  it('shows a readable error after a 502 and retries the same country filters', async () => {
    const filters: GlobalMapFilter = {
      mode: 'paises', limit: 50, paisOrigenId: 'pais-a', paisDestinoId: 'pais-b',
    };
    const fetch = vi.fn()
      .mockRejectedValueOnce(new Error('[GET] "/api/rutas/globales?mode=paises": 502 Bad Gateway'))
      .mockResolvedValueOnce([]);
    vi.stubGlobal('$fetch', fetch);
    const { wrapper } = setup('airport-a', useGlobalMap);
    wrapper.findComponent({ name: 'GlobalMapFilters' }).vm.$emit('apply', filters);
    await flushPromises();

    const alert = wrapper.get('[role="alert"]');
    expect(alert.text()).toBe('No se pudieron cargar las conexiones. Intentá de nuevo.');
    expect(alert.element.closest('.hud-panel')?.classList.contains('hidden')).toBe(false);
    await wrapper.findAll('button').find(button => button.text() === 'Reintentar')?.trigger('click');
    await flushPromises();

    expect(fetch).toHaveBeenCalledTimes(2);
    for (const call of fetch.mock.calls) {
      expect(call).toEqual(['/api/rutas/globales', expect.objectContaining({ query: filters })]);
    }
    expect(wrapper.find('[role="alert"]').exists()).toBe(false);
    expect(wrapper.text()).toContain('No hay conexiones para estos filtros.');
    wrapper.unmount();
  });
});
