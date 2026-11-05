import { groupArcRoutes, mapArcRoute, type ArcRoute } from '~/shared/composables/useCatalog';
import { useBackendRequest } from '~/shared/composables/useBackendRequest';

export const MAP_CONTINENTS = [
  { value: 'AF', label: 'África' }, { value: 'NA', label: 'América del Norte' },
  { value: 'SA', label: 'América del Sur' }, { value: 'AN', label: 'Antártida' },
  { value: 'AS', label: 'Asia' }, { value: 'EU', label: 'Europa' }, { value: 'OC', label: 'Oceanía' },
];
export interface GlobalMapFilter {
  mode: 'global' | 'domestic' | 'paises' | 'continents';
  limit: number;
  paisOrigenId?: string;
  paisDestinoId?: string;
  continenteOrigen?: string;
  continenteDestino?: string;
}
export interface GlobalMapConnection {
  id: string;
  origenId: string;
  destinoId: string;
  ida: ArcRoute[];
  vuelta: ArcRoute[];
}
interface MapCountry { id: string; nombre: string; continent: string | null }

export function useGlobalMap() {
  const request = useBackendRequest();
  const filter = useState<GlobalMapFilter>('global_map_filter', () => ({ mode: 'global', limit: 50 }));
  const isOpen = useState('global_map_modal', () => false);
  const connections = useState<GlobalMapConnection[]>('global_map_connections', () => []);
  const loading = useState('global_map_loading', () => false);
  const error = useState<string | null>('global_map_error', () => null);
  const requestId = useState('global_map_request', () => 0);
  const paises = useState<MapCountry[]>('global_map_countries', () => []);
  const countriesLoading = useState('global_map_countries_loading', () => false);
  const countriesError = useState<string | null>('global_map_countries_error', () => null);
  const fitTrigger = useState('global_map_fit', () => 0);
  const visibleRoutes = computed(() => connections.value.flatMap((conexion) => {
    const ida = groupArcRoutes(conexion.ida)[0];
    if (ida) return [ida];
    const vuelta = conexion.vuelta[0];
    return vuelta ? [mapArcRoute({ ...vuelta, origen: vuelta.destino, destino: vuelta.origen })] : [];
  }));

  async function load() {
    const id = ++requestId.value;
    loading.value = true;
    error.value = null;
    connections.value = [];
    try {
      const result = await request<GlobalMapConnection[]>('/rutas/globales', { query: { ...filter.value } });
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
    if (paises.value.length || countriesLoading.value) return;
    countriesLoading.value = true;
    countriesError.value = null;
    try {
      const result = await request<MapCountry[]>('/paises');
      paises.value = result.filter(pais => pais.continent);
    } catch (err) {
      countriesError.value = err instanceof Error ? err.message : 'No se pudieron cargar los países';
    } finally { countriesLoading.value = false; }
  }

  return { filter, isOpen, connections, visibleRoutes, loading, error, paises, countriesLoading, countriesError, fitTrigger, load, loadCountries };
}
