import { describe, it, expect, vi, beforeEach } from 'vitest';
import { flushPromises, shallowMount } from '@vue/test-utils';
import { ref, nextTick } from 'vue';
import Explorar from '../../app/pages/explorar.vue';
import { useGlobalMap, type GlobalMapFilter } from '../../app/features/flight-map/composables/useGlobalMap';
import RouteMetricsFilters from '../../app/features/flight-map/components/controls/RouteMetricsFilters.vue';

vi.mock('~/features/flight-map/composables/useShortcuts', () => ({ useShortcuts: vi.fn() }));

function setup(origen?: string, useMap?: typeof useGlobalMap, showMetrics = false) {
  const selectedOrigin = ref(origen);
  const selectedDestination = ref<string>();
  const globalMap = {
    isOpen: ref(false), filter: ref<GlobalMapFilter>({ mode: 'global', limit: 50 }),
    visibleRoutes: ref([]), rutasCatalogo: ref([]), loading: ref(false), error: ref(null), load: vi.fn(),
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
    ClientOnly: true, AppHeader: true, RouteResults: true, MobileSearchDrawer: true,
    HudWrapper: showMetrics ? {
      components: { RouteMetricsFilters }, template: '<RouteMetricsFilters />',
    } : true,
    RouteMetricsFilters: false,
    UPopover: { template: '<div><slot /><slot name="content" /></div>' },
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

  it.each([false, true])('keeps the current filtered arc after an old request finishes (rejects: %s)', async (falla) => {
    const origen = { id: 'a', iata: 'AAA', icao: null, nombre: 'A', ciudad: null, pais: 'Argentina', coordenadas: [-58, -34] };
    const destino = { ...origen, id: 'b', iata: 'BBB' };
    const arc = { id: 'r', origen, destino, aerolinea: { iata: 'AR', nombre: 'Operador' }, distanciaKm: 100, escalas: 0, otp15: null };
    let completarMesAnterior!: (value: unknown) => void;
    let fallarMesAnterior!: (reason: Error) => void;
    const resultadoAnterior = new Promise((resolve, reject) => {
      completarMesAnterior = resolve;
      fallarMesAnterior = reject;
    });
    const aviso = vi.fn();
    vi.stubGlobal('useToast', () => ({ add: aviso }));
    const fetch = vi.fn((path: string, options?: { body?: { periodo: string; aerolineaId?: string } }) => {
      if (path === '/api/rutas/globales') return Promise.resolve([{ id: 'a/b', origenId: 'a', destinoId: 'b', ida: [arc], vuelta: [] }]);
      if (path === '/api/metricas/mapa/opciones') return Promise.resolve({
        periodoInicial: '2026-08', periodos: ['2026-08', '2026-07'],
        aerolineas: [{ id: 'ar', nombre: 'Operador', iata: 'AR' }],
      });
      if (options?.body?.periodo === '2026-07') return resultadoAnterior;
      return Promise.resolve([{ origenId: 'a', destinoId: 'b', otp15: options?.body?.aerolineaId ? 90 : 0 }]);
    });
    vi.stubGlobal('$fetch', fetch);
    const { wrapper } = setup(undefined, useGlobalMap, true);
    try {
      await flushPromises();
      const mapa = useGlobalMap();
      const mes = wrapper.get<HTMLSelectElement>('select[aria-label="Mes observado"]');
      expect(mes.element.value).toBe('2026-08');
      expect(mapa.visibleRoutes.value[0]?.averageOtp15).toBe(0);
      await mes.setValue('2026-07');
      expect(mapa.visibleRoutes.value[0]?.averageOtp15).toBeNull();
      await mes.setValue('2026-08');
      await wrapper.get('select[aria-label="Aerolínea"]').setValue('ar');
      if (falla) fallarMesAnterior(new Error('502 Bad Gateway'));
      else completarMesAnterior([{ origenId: 'a', destinoId: 'b', otp15: 45 }]);
      await flushPromises();
      expect(mapa.visibleRoutes.value[0]?.averageOtp15).toBe(90);
      expect(wrapper.find('[role="alert"]').exists()).toBe(false);
      expect(aviso).not.toHaveBeenCalled();
      expect(fetch).toHaveBeenCalledWith('/api/metricas/mapa', expect.objectContaining({
        body: { periodo: '2026-08', aerolineaId: 'ar', pares: [{ origenId: 'a', destinoId: 'b' }] },
      }));
    } finally {
      wrapper.unmount();
    }
  });

  it('returns to the latest published month and all airlines when refreshed filters disappear', async () => {
    const operador = { id: 'ar', nombre: 'Operador', iata: 'AR' };
    const opciones = vi.fn()
      .mockResolvedValueOnce({ periodoInicial: '2026-08', periodos: ['2026-08', '2026-09'], aerolineas: [operador] })
      .mockResolvedValueOnce({ periodoInicial: '2026-08', periodos: ['2026-08'], aerolineas: [] });
    vi.stubGlobal('$fetch', (path: string) => path.endsWith('/opciones') ? opciones() : Promise.resolve([]));
    const { wrapper } = setup(undefined, useGlobalMap, true);
    try {
      await flushPromises();
      const mes = wrapper.get<HTMLSelectElement>('select[aria-label="Mes observado"]');
      const aerolinea = wrapper.get<HTMLSelectElement>('select[aria-label="Aerolínea"]');
      await mes.setValue('2026-09');
      await aerolinea.setValue('ar');
      await wrapper.findAll('button').find(button => button.text() === 'Actualizar puntualidad')!.trigger('click');
      await flushPromises();
      expect(mes.element.value).toBe('2026-08');
      expect(aerolinea.element.value).toBe('');
    } finally {
      wrapper.unmount();
    }
  });
});
