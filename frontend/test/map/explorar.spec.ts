import { describe, it, expect, vi, beforeEach } from 'vitest';
import { shallowMount } from '@vue/test-utils';
import { ref, nextTick } from 'vue';
import Explorar from '../../app/pages/explorar.vue';
import type { GlobalMapFilter } from '../../app/features/flight-map/composables/useGlobalMap';

vi.mock('~/features/flight-map/composables/useShortcuts', () => ({ useShortcuts: vi.fn() }));

function setup(origen?: string) {
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
  vi.stubGlobal('useGlobalMap', () => globalMap);
  const wrapper = shallowMount(Explorar, { global: { stubs: {
    GlobalMapFilters: { name: 'GlobalMapFilters', emits: ['apply'], template: '<div />' },
    UButton: true, ClientOnly: true, AppHeader: true, RouteResults: true, HudWrapper: true, MobileSearchDrawer: true,
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
});
