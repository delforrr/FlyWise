import type { FlightRoute } from '~/types/route';

export function findRouteBetween(rutas: FlightRoute[], origenId?: string, destinoId?: string): FlightRoute | null {
  if (!origenId || !destinoId) return null;
  return rutas.find(r => r.origenId === origenId && r.destinoId === destinoId && r.flightType !== 'connecting') ?? null;
}
export function queryMatchingRoutes(rutas: FlightRoute[], origenId?: string, destinoId?: string): FlightRoute[] {
  return rutas.filter(r =>
    (!origenId || r.origenId === origenId) && (!destinoId || r.destinoId === destinoId)
  );
}
