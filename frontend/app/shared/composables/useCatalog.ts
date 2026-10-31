import { useBackendRequest } from './useBackendRequest';
import type { Aeropuerto } from '~/types/airport';
import type { FlightRoute } from '~/types/route';

export interface CatalogAirport {
  id: string; nombre: string; ciudad: string | null; nombrePais: string;
  iata: string | null; icao: string | null; latitud: number; longitud: number; cantidadRutas: number;
}
export interface ArcRoute {
  id: string;
  origen: { id: string; iata: string | null; icao: string | null; nombre: string; ciudad: string | null; pais: string; coordenadas: [number, number] };
  destino: ArcRoute['origen'];
  aerolinea: { iata: string | null; nombre: string };
  distanciaKm: number; escalas: number; otp15: number | null;
}
export function mapCatalogAirport(a: CatalogAirport): Aeropuerto {
  return { id: a.id, iata: a.iata ?? a.icao ?? a.nombre, icao: a.icao ?? undefined,
    nombre: a.nombre, ciudad: a.ciudad ?? a.nombre, pais: a.nombrePais,
    coordenadas: [a.longitud, a.latitud], cantidadConexiones: a.cantidadRutas };
}
export function mapArcRoute(r: ArcRoute): FlightRoute {
  return { id: r.id, origenId: r.origen.id, destinoId: r.destino.id,
    originIata: r.origen.iata ?? r.origen.icao ?? r.origen.nombre,
    originName: r.origen.nombre, originCity: r.origen.ciudad ?? r.origen.nombre, originCoordinates: r.origen.coordenadas,
    destinationIata: r.destino.iata ?? r.destino.icao ?? r.destino.nombre,
    destinationName: r.destino.nombre, destinationCity: r.destino.ciudad ?? r.destino.nombre, destinationCoordinates: r.destino.coordenadas,
    distanciaKm: r.distanciaKm, averageOtp15: r.otp15, primaryAirline: r.aerolinea.nombre,
    flightType: r.escalas === 0 ? 'direct' : 'connecting',
    aerolineas: [{ codigoAerolinea: r.aerolinea.iata ?? '—', nombreAerolinea: r.aerolinea.nombre,
      otp15: null, avgDelayMinutes: null, cancellationRate: null, sampleFlightsCount: 0 }] };
}
export function useCatalog() {
  const request = useBackendRequest();
  const aeropuertos = useState<Aeropuerto[]>('catalog_airports', () => []);
  const rutas = useState<FlightRoute[]>('catalog_routes', () => []);
  const error = useState<string | null>('catalog_error', () => null);
  const loading = useState('catalog_loading', () => false);
  const loaded = useState('catalog_loaded', () => false);
  const routeQuery = useState<string | null>('catalog_route_query', () => null);
  const routeRequestId = useState('catalog_route_request', () => 0);
  async function loadAirports() {
    if (loading.value || loaded.value) return;
    loading.value = true;
    try {
      const result: Aeropuerto[] = [];
      for (let offset = 0; ; offset += 1000) {
        const page = await request<CatalogAirport[]>('/aeropuertos/catalogo', { query: { limit: 1000, offset } });
        result.push(...page.map(mapCatalogAirport));
        if (page.length < 1000) break;
      }
      aeropuertos.value = result; loaded.value = true; error.value = null;
    } catch (err) { error.value = err instanceof Error ? err.message : 'No se pudo cargar el catálogo'; }
    finally { loading.value = false; }
  }
  async function loadRoutes(origenId?: string, destinoId?: string) {
    const key = `${origenId ?? ''}/${destinoId ?? ''}`;
    if (routeQuery.value === key) return;
    routeQuery.value = key;
    const id = ++routeRequestId.value;
    try {
      const result = await request<ArcRoute[]>('/rutas/explorar', { query: { origenId, destinoId, limit: 100, incluirRegreso: origenId && destinoId ? 'true' : undefined } });
      if (id === routeRequestId.value) { rutas.value = groupArcRoutes(result); error.value = null; }
    } catch (err) {
      if (id === routeRequestId.value) { routeQuery.value = null; rutas.value = []; error.value = err instanceof Error ? err.message : 'No se pudieron consultar las rutas'; }
    }
  }
  return { aeropuertos, rutas, error, loading, loadAirports, loadRoutes };
}

export function groupArcRoutes(rows: ArcRoute[]): FlightRoute[] {
  const grouped = new Map<string, FlightRoute>();
  for (const row of rows) {
    const key = `${row.origen.id}/${row.destino.id}/${row.escalas}`;
    const mapped = mapArcRoute(row);
    const existing = grouped.get(key);
    if (!existing) grouped.set(key, mapped);
    else if (!existing.aerolineas.some(a => a.nombreAerolinea === mapped.aerolineas[0]!.nombreAerolinea && a.codigoAerolinea === mapped.aerolineas[0]!.codigoAerolinea)) {
      existing.aerolineas.push(...mapped.aerolineas);
      existing.primaryAirline = `${existing.aerolineas.length} aerolíneas`;
    }
  }
  return [...grouped.values()];
}
