import { useBackendRequest } from './useBackendRequest';
import type { Airport } from '~/types/airport';
import type { FlightRoute } from '~/types/route';

export interface CatalogAirport {
  id: string; name: string; city: string | null; countryName: string;
  iata: string | null; icao: string | null; latitude: number; longitude: number; routeCount: number;
}
export interface ArcRoute {
  id: string;
  origin: { id: string; iata: string | null; icao: string | null; name: string; city: string | null; country: string; coordinates: [number, number] };
  destination: ArcRoute['origin'];
  airline: { iata: string | null; name: string };
  distanceKm: number; stops: number; otp15: number | null;
}
export function mapCatalogAirport(a: CatalogAirport): Airport {
  return { id: a.id, iata: a.iata ?? a.icao ?? a.name, icao: a.icao ?? undefined,
    name: a.name, city: a.city ?? a.name, country: a.countryName,
    coordinates: [a.longitude, a.latitude], connectionsCount: a.routeCount };
}
export function mapArcRoute(r: ArcRoute): FlightRoute {
  return { id: r.id, originId: r.origin.id, destinationId: r.destination.id,
    originIata: r.origin.iata ?? r.origin.icao ?? r.origin.name,
    originName: r.origin.name, originCity: r.origin.city ?? r.origin.name, originCoordinates: r.origin.coordinates,
    destinationIata: r.destination.iata ?? r.destination.icao ?? r.destination.name,
    destinationName: r.destination.name, destinationCity: r.destination.city ?? r.destination.name, destinationCoordinates: r.destination.coordinates,
    distanceKm: r.distanceKm, averageOtp15: r.otp15, primaryAirline: r.airline.name,
    flightType: r.stops === 0 ? 'direct' : 'connecting',
    airlines: [{ airlineCode: r.airline.iata ?? '—', airlineName: r.airline.name,
      otp15: null, avgDelayMinutes: null, cancellationRate: null, sampleFlightsCount: 0 }] };
}
export function useCatalog() {
  const request = useBackendRequest();
  const airports = useState<Airport[]>('catalog_airports', () => []);
  const routes = useState<FlightRoute[]>('catalog_routes', () => []);
  const error = useState<string | null>('catalog_error', () => null);
  const loading = useState('catalog_loading', () => false);
  const loaded = useState('catalog_loaded', () => false);
  const routeQuery = useState<string | null>('catalog_route_query', () => null);
  const routeRequestId = useState('catalog_route_request', () => 0);
  async function loadAirports() {
    if (loading.value || loaded.value) return;
    loading.value = true;
    try {
      const result: Airport[] = [];
      for (let offset = 0; ; offset += 1000) {
        const page = await request<CatalogAirport[]>('/airports/catalog', { query: { limit: 1000, offset } });
        result.push(...page.map(mapCatalogAirport));
        if (page.length < 1000) break;
      }
      airports.value = result; loaded.value = true; error.value = null;
    } catch (err) { error.value = err instanceof Error ? err.message : 'No se pudo cargar el catálogo'; }
    finally { loading.value = false; }
  }
  async function loadRoutes(originId?: string, destinationId?: string) {
    const key = `${originId ?? ''}/${destinationId ?? ''}`;
    if (routeQuery.value === key) return;
    routeQuery.value = key;
    const id = ++routeRequestId.value;
    try {
      const result = await request<ArcRoute[]>('/routes/explore', { query: { originId, destinationId, limit: 100, includeReturn: originId && destinationId ? 'true' : undefined } });
      if (id === routeRequestId.value) { routes.value = groupArcRoutes(result); error.value = null; }
    } catch (err) {
      if (id === routeRequestId.value) { routeQuery.value = null; routes.value = []; error.value = err instanceof Error ? err.message : 'No se pudieron consultar las rutas'; }
    }
  }
  return { airports, routes, error, loading, loadAirports, loadRoutes };
}

export function groupArcRoutes(rows: ArcRoute[]): FlightRoute[] {
  const grouped = new Map<string, FlightRoute>();
  for (const row of rows) {
    const key = `${row.origin.id}/${row.destination.id}/${row.stops}`;
    const mapped = mapArcRoute(row);
    const existing = grouped.get(key);
    if (!existing) grouped.set(key, mapped);
    else if (!existing.airlines.some(a => a.airlineName === mapped.airlines[0]!.airlineName && a.airlineCode === mapped.airlines[0]!.airlineCode)) {
      existing.airlines.push(...mapped.airlines);
      existing.primaryAirline = `${existing.airlines.length} aerolíneas`;
    }
  }
  return [...grouped.values()];
}
