import { mount } from '@vue/test-utils';
import { nextTick } from 'vue';
import { expect, it } from 'vitest';
import AirportTooltipContent from '~/features/flight-map/components/tooltips/AirportTooltipContent.vue';
import InputCard from '~/features/route-audit/components/search/InputCard.vue';
import { mapCatalogAirport } from '~/shared/composables/useCatalog';
import { useCountryLocale } from '~/shared/composables/useCountryLocale';

it('localiza países de los aeropuertos ya cargados en tarjetas y tooltips sin cambiar el catálogo', async () => {
  const airport = mapCatalogAirport({ id: 'gb', nombre: 'Heathrow', ciudad: 'London', nombrePais: 'United Kingdom', codigoIsoPais: 'GB', iata: 'LHR', icao: 'EGLL', latitud: 51, longitud: 0, cantidadRutas: 1 });
  const global = { stubs: { UIcon: true, UBadge: true } };
  const tooltip = mount(AirportTooltipContent, { props: { airport }, global });
  const card = mount(InputCard, { props: { airport }, global });
  expect(tooltip.text()).toContain('London, Reino Unido');
  expect(card.text()).toContain('London, Reino Unido');
  useCountryLocale().locale.value = 'en'; await nextTick();
  expect(tooltip.text()).toContain('London, United Kingdom');
  expect(card.text()).toContain('London, United Kingdom');
  expect(airport.pais).toBe('United Kingdom');
  tooltip.unmount(); card.unmount();
});
