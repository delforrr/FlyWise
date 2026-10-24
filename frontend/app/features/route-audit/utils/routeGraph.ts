import type { FlightRoute } from '~/types/route';

export function findRouteBetween(routes: FlightRoute[], originId?: string, destinationId?: string): FlightRoute | null {
  if (!originId || !destinationId) return null;
  return routes.find(r => r.originId === originId && r.destinationId === destinationId && r.flightType !== 'connecting') ?? null;
}
export function queryMatchingRoutes(routes: FlightRoute[], originId?: string, destinationId?: string): FlightRoute[] {
  return routes.filter(r =>
    (!originId || r.originId === originId) && (!destinationId || r.destinationId === destinationId)
  );
}
