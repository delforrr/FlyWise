import type { FlightRoute } from '~/types/route';
import { SEED_ROUTES } from '~/data/seedData';

/**
 * Índices Map precalculados a nivel de módulo para búsquedas O(1) ultra-rápidas.
 * Separa la lógica de grafo y consultas analíticas del composable de estado de UI (SRP).
 */
export const routeByIdMap = new Map<string, FlightRoute>();
export const routesByAirportMap = new Map<string, FlightRoute[]>();
export const outgoingRoutesMap = new Map<string, FlightRoute[]>();
export const incomingRoutesMap = new Map<string, FlightRoute[]>();

for (const route of SEED_ROUTES) {
  routeByIdMap.set(route.id, route);
  routeByIdMap.set(`${route.originIata}-${route.destinationIata}`, route);

  if (!routesByAirportMap.has(route.originIata)) routesByAirportMap.set(route.originIata, []);
  routesByAirportMap.get(route.originIata)!.push(route);

  if (!routesByAirportMap.has(route.destinationIata)) routesByAirportMap.set(route.destinationIata, []);
  routesByAirportMap.get(route.destinationIata)!.push(route);

  if (!outgoingRoutesMap.has(route.originIata)) outgoingRoutesMap.set(route.originIata, []);
  outgoingRoutesMap.get(route.originIata)!.push(route);

  if (!incomingRoutesMap.has(route.destinationIata)) incomingRoutesMap.set(route.destinationIata, []);
  incomingRoutesMap.get(route.destinationIata)!.push(route);
}

/**
 * Encuentra una ruta directa entre dos aeropuertos en cualquier dirección.
 */
export function findRouteBetween(orig?: string, dest?: string): FlightRoute | null {
  if (!orig || !dest) return null;
  return (
    routeByIdMap.get(`${orig}-${dest}`) ??
    routeByIdMap.get(`${dest}-${orig}`) ??
    null
  );
}

/**
 * Rutas coincidentes con el criterio de búsqueda:
 * - Si se seleccionan ambos (origen y destino): ruta directa + rutas de 1 escala conectadas.
 * - Si se selecciona solo origen o destino: todas las conexiones del hub.
 * - Si no hay selección: devuelve todas las rutas del catálogo.
 */
export function queryMatchingRoutes(orig?: string, dest?: string): FlightRoute[] {
  if (orig && dest) {
    const directRoute = findRouteBetween(orig, dest);
    const direct = directRoute ? [directRoute] : [];

    const outgoing = outgoingRoutesMap.get(orig) ?? [];
    const incoming = incomingRoutesMap.get(dest) ?? [];
    const incomingByOrigin = new Map<string, FlightRoute>();
    for (const inLeg of incoming) {
      incomingByOrigin.set(inLeg.originIata, inLeg);
    }

    const connecting: FlightRoute[] = [];
    for (const leg1 of outgoing) {
      const leg2 = incomingByOrigin.get(leg1.destinationIata);
      if (leg2 && !direct.some((d) => d.id === leg1.id || d.id === leg2.id)) {
        connecting.push(leg1, leg2);
      }
    }

    return [...direct, ...connecting];
  }

  if (orig) {
    return routesByAirportMap.get(orig) ?? [];
  }

  if (dest) {
    return routesByAirportMap.get(dest) ?? [];
  }

  return SEED_ROUTES;
}
