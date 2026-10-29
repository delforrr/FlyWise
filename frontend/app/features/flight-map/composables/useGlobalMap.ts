import { groupArcRoutes, mapArcRoute, type ArcRoute } from '~/shared/composables/useCatalog';
import { useBackendRequest } from '~/shared/composables/useBackendRequest';

export const MAP_CONTINENTS = [
  { value: 'AF', label: 'África' }, { value: 'NA', label: 'América del Norte' },
  { value: 'SA', label: 'América del Sur' }, { value: 'AN', label: 'Antártida' },
  { value: 'AS', label: 'Asia' }, { value: 'EU', label: 'Europa' }, { value: 'OC', label: 'Oceanía' },
];
export interface GlobalMapFilter {
  mode: 'global' | 'domestic' | 'countries' | 'continents';
  limit: number;
  originCountryId?: string;
  destinationCountryId?: string;
  originContinent?: string;
  destinationContinent?: string;
}
export interface GlobalMapConnection {
  id: string;
  originId: string;
  destinationId: string;
  outbound: ArcRoute[];
  inbound: ArcRoute[];
}
interface MapCountry { id: string; name: string; continent: string | null }

export function useGlobalMap() {
  const request = useBackendRequest();
  const filter = useState<GlobalMapFilter>('global_map_filter', () => ({ mode: 'global', limit: 50 }));
  const isOpen = useState('global_map_modal', () => false);
  const connections = useState<GlobalMapConnection[]>('global_map_connections', () => []);
  const loading = useState('global_map_loading', () => false);
  const error = useState<string | null>('global_map_error', () => null);
  const requestId = useState('global_map_request', () => 0);
  const countries = useState<MapCountry[]>('global_map_countries', () => []);
  const countriesLoading = useState('global_map_countries_loading', () => false);
  const countriesError = useState<string | null>('global_map_countries_error', () => null);
  const fitTrigger = useState('global_map_fit', () => 0);
  const visibleRoutes = computed(() => connections.value.flatMap((connection) => {
    const outbound = groupArcRoutes(connection.outbound)[0];
    if (outbound) return [outbound];
    const inbound = connection.inbound[0];
    return inbound ? [mapArcRoute({ ...inbound, origin: inbound.destination, destination: inbound.origin })] : [];
  }));

  async function load() {
    const id = ++requestId.value;
    loading.value = true;
    error.value = null;
    connections.value = [];
    try {
      const result = await request<GlobalMapConnection[]>('/routes/global', { query: { ...filter.value } });
      if (id !== requestId.value) return;
      connections.value = result;
      fitTrigger.value++;
    } catch (err) {
      if (id === requestId.value) error.value = err instanceof Error ? err.message : 'No se pudieron cargar las conexiones';
    } finally {
      if (id === requestId.value) loading.value = false;
    }
  }

  async function loadCountries() {
    if (countries.value.length || countriesLoading.value) return;
    countriesLoading.value = true;
    countriesError.value = null;
    try {
      const result = await request<MapCountry[]>('/countries');
      countries.value = result.filter(country => country.continent);
    } catch (err) {
      countriesError.value = err instanceof Error ? err.message : 'No se pudieron cargar los países';
    } finally { countriesLoading.value = false; }
  }

  return { filter, isOpen, connections, visibleRoutes, loading, error, countries, countriesLoading, countriesError, fitTrigger, load, loadCountries };
}
