import { describe, it, expect, vi } from 'vitest';
import { useGlobalMap, type GlobalMapConnection } from '../../app/features/flight-map/composables/useGlobalMap';
import { useCatalog, mapArcRoute, type ArcRoute } from '../../app/shared/composables/useCatalog';

const endpoint = { id: 'a', iata: 'AAA', icao: null, name: 'A', city: null, country: 'Argentina', coordinates: [-58, -34] as [number, number] };
const arc: ArcRoute = { id: 'r1', origin: endpoint, destination: { ...endpoint, id: 'b', iata: 'BBB' }, airline: { iata: 'AR', name: 'Aerolíneas' }, distanceKm: 100, stops: 0, otp15: null };
const connection: GlobalMapConnection = { id: 'a/b', originId: 'a', destinationId: 'b', outbound: [arc], inbound: [] };

describe('Global map catalogue', () => {
  it('defaults to top 50 and draws one arc per pair despite multiple operators and return offers', async () => {
    vi.stubGlobal('$fetch', vi.fn().mockResolvedValue([{ ...connection, outbound: [arc, { ...arc, id: 'r2', airline: { iata: 'ZZ', name: 'Otra' } }], inbound: [{ ...arc, origin: arc.destination, destination: arc.origin }] }]));
    const map = useGlobalMap();
    expect(map.filter.value).toEqual({ mode: 'global', limit: 50 });
    await map.load();
    expect(map.visibleRoutes.value).toHaveLength(1);
    expect(map.visibleRoutes.value[0]?.airlines).toHaveLength(2);
    expect(map.visibleRoutes.value[0]?.averageOtp15).toBeNull();
  });

  it('keeps canonical orientation for pairs that only have return offers', async () => {
    vi.stubGlobal('$fetch', vi.fn().mockResolvedValue([{ ...connection, outbound: [], inbound: [{ ...arc, origin: arc.destination, destination: arc.origin }] }]));
    const map = useGlobalMap(); await map.load();
    expect(map.visibleRoutes.value[0]).toMatchObject({ originId: 'a', destinationId: 'b' });
  });

  it('ignores stale successes and failures without replacing selection results', async () => {
    let finish: (value: GlobalMapConnection[]) => void = () => {};
    let fail: (error: Error) => void = () => {};
    const first = new Promise<GlobalMapConnection[]>(resolve => { finish = resolve; });
    const second = new Promise<GlobalMapConnection[]>((_resolve, reject) => { fail = reject; });
    vi.stubGlobal('$fetch', vi.fn().mockReturnValueOnce(first).mockReturnValueOnce(second).mockResolvedValueOnce([connection]));
    const map = useGlobalMap();
    const selection = useCatalog(); selection.routes.value = [mapArcRoute(arc)];
    const old = map.load(); const oldFailure = map.load();
    map.filter.value = { mode: 'countries', limit: 10, originCountryId: 'ar', destinationCountryId: 'es' };
    await map.load(); finish([]); fail(new Error('stale')); await Promise.all([old, oldFailure]);
    expect(map.connections.value).toEqual([connection]);
    expect(map.error.value).toBeNull();
    expect(map.loading.value).toBe(false);
    expect(selection.routes.value).toHaveLength(1);
  });

  it('clears old results on failure and permits retry', async () => {
    vi.stubGlobal('$fetch', vi.fn().mockRejectedValueOnce(new Error('unavailable')).mockResolvedValueOnce([connection]));
    const map = useGlobalMap(); await map.load();
    expect(map.connections.value).toEqual([]); expect(map.error.value).toBe('unavailable');
    await map.load(); expect(map.error.value).toBeNull(); expect(map.connections.value).toHaveLength(1);
  });

  it('filters unclassified countries and permits retry after catalogue errors', async () => {
    vi.stubGlobal('$fetch', vi.fn().mockRejectedValueOnce(new Error('countries unavailable')).mockResolvedValueOnce([
      { id: 'ar', name: 'Argentina', continent: 'SA' }, { id: 'xx', name: 'Unknown', continent: null },
    ]));
    const map = useGlobalMap(); await map.loadCountries();
    expect(map.countriesError.value).toBe('countries unavailable');
    await map.loadCountries(); expect(map.countries.value.map(c => c.id)).toEqual(['ar']);
    expect(map.countriesError.value).toBeNull();
  });
});

