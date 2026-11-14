import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils';
import { afterEach, expect, it, vi } from 'vitest';
import { defineComponent } from 'vue';
import { useRouteMetricOverlay } from '../../app/features/flight-map/composables/useRouteMetrics';
import RouteDirectCard from '../../app/features/route-audit/components/results/RouteDirectCard.vue';
import { SEED_ROUTES } from '../../app/data/seedData';
import type { FlightRoute } from '../../app/types/route';

const Tabs = defineComponent({
  props: {
    items: { type: Array<{ label: string; value: string; slot: string }>, required: true },
    modelValue: String,
  },
  emits: ['update:modelValue'],
  template: `
    <div>
      <button v-for="item in items" :key="item.value" @click="$emit('update:modelValue', item.value)">
        {{ item.label }}
      </button>
      <slot :name="items.find(item => item.value === modelValue)?.slot" />
    </div>`,
});

const route = {
  ...SEED_ROUTES[0]!,
  averageOtp15: 76,
  metricas: {
    origenId: SEED_ROUTES[0]!.origenId, destinoId: SEED_ROUTES[0]!.destinoId,
    periodo: '2026-08', aerolineaId: null, otp15: 76,
    vuelosTotales: 25, vuelosOperados: 20, fuentes: ['BTS'],
    actualizadoEn: '2026-09-01 12:30:00', pendiente: false, errorActualizacion: null,
  },
};

function mountCard(fetch: ReturnType<typeof vi.fn>, selectedRoute: FlightRoute = route) {
  vi.stubGlobal('$fetch', fetch);
  const { filtro } = useRouteMetricOverlay();
  filtro.value.periodo = '2026-08';
  const wrapper = mount(RouteDirectCard, {
    props: { route: selectedRoute },
    global: { stubs: { UTabs: Tabs, UIcon: true, OtpBadge: true, UProgress: true, RouteAirlineRow: true } },
  });
  return { wrapper, filtro };
}

enableAutoUnmount(afterEach);

it('muestra el OTP-15 de la ruta y presenta la actividad ANAC en su propia pestaña', async () => {
  const fetch = vi.fn().mockResolvedValue({
    actividad: { despegues: 17, pasajeros: 2350 },
    indicadores: [],
  });
  const { wrapper } = mountCard(fetch);
  await flushPromises();

  expect(fetch).toHaveBeenCalledWith('/api/metricas/mapa/contexto', expect.objectContaining({
    query: { origenId: route.origenId, destinoId: route.destinoId, periodo: '2026-08' },
  }));
  expect(wrapper.text()).toContain('20 operados de 25');
  const actividad = wrapper.findAll('button').find(button => button.text() === 'Actividad ANAC')!;
  await actividad.trigger('click');
  expect(wrapper.text()).toContain('2026-08');
  expect(wrapper.text()).toContain('Despegues');
  expect(wrapper.text()).toContain('17');
  expect(wrapper.text()).toContain('2.350');
  expect(wrapper.text()).not.toContain('20 operados de 25');
  expect(wrapper.text()).not.toContain('EUROCONTROL');
});

it('muestra el aeropuerto y el período EUROCONTROL aunque el tramo no tenga OTP-15', async () => {
  const fetch = vi.fn().mockResolvedValue({
    actividad: { despegues: 17, pasajeros: null },
    indicadores: [
      { aeropuerto: 'LEMD', desde: '2026-08-01', hasta: '2026-08-31', puntualidadLlegada: 83.5 },
    ],
  });
  const { wrapper } = mountCard(fetch, { ...route, averageOtp15: null, metricas: undefined });
  await flushPromises();

  expect(wrapper.text()).toContain('Sin datos');
  const actividad = wrapper.findAll('button').find(button => button.text() === 'Actividad ANAC')!;
  await actividad.trigger('click');
  expect(wrapper.text()).toContain('Despegues del tramo');

  const indicadores = wrapper.findAll('button').find(button => button.text() === 'EUROCONTROL')!;
  await indicadores.trigger('click');

  expect(wrapper.text()).toContain('Puntualidad de llegada por aeropuerto');
  expect(wrapper.text()).toContain('LEMD');
  expect(wrapper.text()).toContain('2026-08-01 al 2026-08-31');
  expect(wrapper.text()).toContain('83,5 %');
  expect(wrapper.text()).not.toContain('Despegues del tramo');
});

it('al cambiar el período vuelve a OTP-15 y descarta las respuestas externas anteriores', async () => {
  const anterior = Promise.withResolvers<{
    actividad: null;
    indicadores: { aeropuerto: string; desde: string; hasta: string; puntualidadLlegada: number }[];
  }>();
  const fetch = vi.fn()
    .mockResolvedValueOnce({ actividad: { despegues: 17, pasajeros: null }, indicadores: [] })
    .mockReturnValueOnce(anterior.promise)
    .mockResolvedValueOnce({ actividad: null, indicadores: [] });
  const { wrapper, filtro } = mountCard(fetch);
  await flushPromises();

  const actividad = wrapper.findAll('button').find(button => button.text() === 'Actividad ANAC')!;
  await actividad.trigger('click');
  expect(wrapper.text()).toContain('Despegues del tramo');
  expect(wrapper.text()).not.toContain('Pasajeros');

  filtro.value.periodo = '2026-09';
  filtro.value.periodo = '2026-10';
  await flushPromises();
  anterior.resolve({
    actividad: null,
    indicadores: [{ aeropuerto: 'LEMD', desde: '2026-09-01', hasta: '2026-09-30', puntualidadLlegada: 84 }],
  });
  await flushPromises();

  expect(wrapper.findAll('button').map(button => button.text())).toEqual(['Puntualidad OTP-15']);
  expect(wrapper.text()).toContain('20 operados de 25');
});
