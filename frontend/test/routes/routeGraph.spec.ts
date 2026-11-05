import { describe, it, expect } from 'vitest';
import { findRouteBetween, queryMatchingRoutes } from '../../app/features/route-audit/utils/routeGraph';
import { SEED_ROUTES } from '../../app/data/seedData';

describe('Routes from the API', () => {
  const route = SEED_ROUTES[0]!;
  it('finds a direct route by airport identity', () => {
    expect(findRouteBetween([route], route.origenId, route.destinoId)).toEqual(route);
  });
  it('never invents a reverse service', () => {
    expect(findRouteBetween([route], route.destinoId, route.origenId)).toBeNull();
  });
  it('does not treat a route with escalas as direct', () => {
    expect(findRouteBetween([{ ...route, flightType: 'connecting' }], route.origenId, route.destinoId)).toBeNull();
  });
  it('handles missing selections and empty real catalogues', () => {
    expect(findRouteBetween([], 'a', 'b')).toBeNull();
    expect(findRouteBetween([route])).toBeNull();
    expect(queryMatchingRoutes([])).toEqual([]);
    expect(queryMatchingRoutes([route])).toEqual([route]);
  });
  it('filters only supplied rutas without generating connecting itineraries', () => {
    expect(queryMatchingRoutes([route], route.origenId, route.destinoId)).toEqual([route]);
    expect(queryMatchingRoutes([route], route.destinoId, route.origenId)).toEqual([]);
    expect(queryMatchingRoutes([route], undefined, route.destinoId)).toEqual([route]);
    expect(queryMatchingRoutes([route], 'missing')).toEqual([]);
  });
});
