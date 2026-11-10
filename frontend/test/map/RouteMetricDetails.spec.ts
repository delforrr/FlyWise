import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import RouteTooltipContent from '../../app/features/flight-map/components/tooltips/RouteTooltipContent.vue';
import { SEED_ROUTES } from '../../app/data/seedData';

describe('Detalle de puntualidad de un arco', () => {
  it('muestra la muestra, las fuentes y el último cálculo mientras se actualiza', () => {
    const route = SEED_ROUTES[0]!;
    const wrapper = mount(RouteTooltipContent, {
      props: {
        route: {
          ...route, averageOtp15: 0,
          metricas: {
            origenId: route.origenId, destinoId: route.destinoId,
            periodo: '2026-08', aerolineaId: null, otp15: 0,
            vuelosTotales: 5, vuelosOperados: 4, fuentes: ['BTS', 'Administrativa'],
            actualizadoEn: '2026-09-01 12:30:00', pendiente: true, errorActualizacion: null,
          },
        },
      },
      global: { stubs: { UIcon: true, OtpBadge: { props: ['value'], template: '<span>{{ value }} %</span>' } } },
    });
    try {
      expect(wrapper.text()).toContain('0 %');
      expect(wrapper.text()).toContain('2026-08');
      expect(wrapper.text()).toContain('4 operados de 5');
      expect(wrapper.text()).toContain('BTS, Registro manual');
      expect(wrapper.text()).toContain('2026-09-01 12:30 UTC');
      expect(wrapper.text()).toContain('Actualización pendiente');
    } finally {
      wrapper.unmount();
    }
  });
});
