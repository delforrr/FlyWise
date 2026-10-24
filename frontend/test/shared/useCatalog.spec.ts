import { describe, it, expect, vi } from 'vitest';
import { mapCatalogAirport, mapArcRoute, useCatalog, type ArcRoute } from '../../app/shared/composables/useCatalog';

const airport = { id: 'uuid-a', name: 'Unnamed code', city: null, countryName: 'Argentina', iata: null, icao: null, latitude: 0, longitude: -58, routeCount: 2 };
const endpoint = { id: 'uuid-a', iata: null, icao: 'SAEZ', name: 'Airport', city: null, country: 'Argentina', coordinates: [-58, -34] as [number,number] };
const arc: ArcRoute = { id: 'uuid-route', origin: endpoint, destination: { ...endpoint, id: 'uuid-b' }, airline: { iata: null, name: 'Unknown' }, distanceKm: 100, stops: 0, otp15: null };

describe('Real catalogue boundary', () => {
  it('uses internal identities and preserves zero coordinates without requiring codes', () => {
    expect(mapCatalogAirport(airport)).toMatchObject({ id: 'uuid-a', iata: 'Unnamed code', coordinates: [-58, 0] });
    expect(mapCatalogAirport({ ...airport, icao: 'SAEZ' }).iata).toBe('SAEZ');
  });
  it('does not invent punctuality or historical samples for a catalogue route', () => {
    const route = mapArcRoute(arc);
    expect(route).toMatchObject({ originId: 'uuid-a', destinationId: 'uuid-b', averageOtp15: null });
    expect(route.airlines[0]).toMatchObject({ otp15: null, avgDelayMinutes: null, cancellationRate: null, sampleFlightsCount: 0 });
  });
  it('shares loaded catalogue state without duplicate HTTP requests', async () => {
    const fetcher = vi.fn().mockResolvedValue([airport]); vi.stubGlobal('$fetch', fetcher);
    await useCatalog().loadAirports(); await useCatalog().loadAirports();
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(useCatalog().airports.value[0]?.id).toBe('uuid-a');
  });
  it('keeps only the latest route response when requests finish out of order', async () => {
    let finish: (value: ArcRoute[]) => void = () => {};
    const pending = new Promise<ArcRoute[]>(resolve => { finish = resolve; });
    const fetcher = vi.fn().mockReturnValueOnce(pending).mockResolvedValueOnce([]); vi.stubGlobal('$fetch', fetcher);
    const catalog = useCatalog(); const first = catalog.loadRoutes('uuid-a');
    await catalog.loadRoutes('uuid-b'); finish([arc]); await first;
    expect(catalog.routes.value).toEqual([]);
    await catalog.loadRoutes('uuid-b'); expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it('groups all published operators for a directed segment without invented metrics', async () => {
    const fetcher = vi.fn().mockResolvedValue([arc, { ...arc, id: 'other-route', airline: { iata: 'ZZ', name: 'Other Airline' } }]); vi.stubGlobal('$fetch', fetcher);
    const catalog = useCatalog(); await catalog.loadRoutes('uuid-a', 'uuid-b');
    expect(catalog.routes.value).toHaveLength(1);
    expect(catalog.routes.value[0]?.airlines).toHaveLength(2);
    expect(catalog.routes.value[0]?.averageOtp15).toBeNull();
  });
  it('surfaces unavailable catalogues and permits retry', async () => {
    const fetcher = vi.fn().mockRejectedValueOnce(new Error('unavailable')).mockResolvedValueOnce([airport]); vi.stubGlobal('$fetch', fetcher);
    const catalog = useCatalog(); await catalog.loadAirports();
    expect(catalog.error.value).toBe('unavailable'); expect(catalog.airports.value).toEqual([]);
    await catalog.loadAirports(); expect(catalog.error.value).toBeNull();
  });
});
