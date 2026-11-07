import { mount } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';
import HeroSearchCard from '../../app/features/route-audit/components/search/HeroSearchCard.vue';
import InputCard from '../../app/features/route-audit/components/search/InputCard.vue';
import { useFlightSelection } from '../../app/features/route-audit/composables/useFlightSelection';
import { useCatalog, type CatalogAirport } from '../../app/shared/composables/useCatalog';

const eze: CatalogAirport = {
  id: 'd4991c93-f06d-4fa1-83eb-841fe8866941', iata: 'EZE', icao: 'SAEZ',
  nombre: 'Ministro Pistarini', ciudad: 'Buenos Aires', nombrePais: 'Argentina',
  latitud: -34.82, longitud: -58.54, cantidadRutas: 1,
};
const jfk: CatalogAirport = {
  id: 'c726fa64-839d-4d9e-9bf2-4198326bfc40', iata: 'JFK', icao: 'KJFK',
  nombre: 'John F. Kennedy', ciudad: 'Nueva York', nombrePais: 'Estados Unidos',
  latitud: 40.64, longitud: -73.78, cantidadRutas: 1,
};
const withoutIata: CatalogAirport = {
  ...eze, id: 'd4991c93-f06d-4fa1-83eb-841fe8866942',
  iata: null, icao: null, nombre: 'Aeropuerto sin código',
};

describe('HeroSearchCard', () => {
  it('muestra IATA para ambos aeropuertos al resolverlos y al invertirlos', async () => {
    vi.stubGlobal('useFlightSelection', useFlightSelection);
    const selection = useFlightSelection();
    selection.setRoute(eze.id, jfk.id);
    const wrapper = mount(HeroSearchCard, {
      global: { stubs: {
        InputCard,
        PaperBezel: { template: '<div><slot /></div>' },
        UButton: { template: '<button><slot /></button>' },
        AirportSelectInput: true, UIcon: true, USeparator: true, NuxtLink: true,
      } },
    });
    try {
      expect(wrapper.text()).not.toContain(eze.id);
      expect(wrapper.text()).not.toContain(jfk.id);

      vi.stubGlobal('$fetch', vi.fn().mockResolvedValue([eze, jfk, withoutIata]));
      await useCatalog().loadAirports();

      const origin = () => wrapper.get('fieldset[data-type="origen"]').text();
      const destination = () => wrapper.get('fieldset[data-type="destino"]').text();
      expect(origin()).toContain('EZE');
      expect(destination()).toContain('JFK');

      await wrapper.get('button[aria-label="Invertir origen y destino"]').trigger('click');
      expect(origin()).toContain('JFK');
      expect(destination()).toContain('EZE');

      selection.setOrigin(withoutIata.id);
      await wrapper.vm.$nextTick();
      expect(wrapper.find('fieldset[data-type="origen"] [title="Seleccionar aeropuerto origen"]').exists()).toBe(true);
    } finally {
      wrapper.unmount();
      vi.unstubAllGlobals();
    }
  });
});
