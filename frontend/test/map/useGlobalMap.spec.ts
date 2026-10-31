import { describe, it, expect, vi } from 'vitest';
import { useGlobalMap, type GlobalMapConnection } from '../../app/features/flight-map/composables/useGlobalMap';
import { useCatalog, mapArcRoute, type ArcRoute } from '../../app/shared/composables/useCatalog';

const endpoint = { id: 'a', iata: 'AAA', icao: null, nombre: 'A', ciudad: null, pais: 'Argentina', coordenadas: [-58, -34] as [number, number] };
const arc: ArcRoute = { id: 'r1', origen: endpoint, destino: { ...endpoint, id: 'b', iata: 'BBB' }, aerolinea: { iata: 'AR', nombre: 'Aerolíneas' }, distanciaKm: 100, escalas: 0, otp15: null };
const conexion: GlobalMapConnection = { id: 'a/b', origenId: 'a', destinoId: 'b', ida: [arc], vuelta: [] };

describe('Global map catalogue', () => {
  it('defaults to top 50 and draws one arc per pair despite multiple operadores and return offers', async () => {
    vi.stubGlobal('$fetch', vi.fn().mockResolvedValue([{ ...conexion, ida: [arc, { ...arc, id: 'r2', aerolinea: { iata: 'ZZ', nombre: 'Otra' } }], vuelta: [{ ...arc, origen: arc.destino, destino: arc.origen }] }]));
    const map = useGlobalMap();
    expect(map.filter.value).toEqual({ mode: 'global', limit: 50 });
    await map.load();
    expect(map.visibleRoutes.value).toHaveLength(1);
    expect(map.visibleRoutes.value[0]?.aerolineas).toHaveLength(2);
    expect(map.visibleRoutes.value[0]?.averageOtp15).toBeNull();
  });

  it('keeps canonical orientation for pairs that only have return offers', async () => {
    vi.stubGlobal('$fetch', vi.fn().mockResolvedValue([{ ...conexion, ida: [], vuelta: [{ ...arc, origen: arc.destino, destino: arc.origen }] }]));
    const map = useGlobalMap(); await map.load();
    expect(map.visibleRoutes.value[0]).toMatchObject({ origenId: 'a', destinoId: 'b' });
  });

  it('ignores stale successes and failures without replacing selection results', async () => {
    let finish: (value: GlobalMapConnection[]) => void = () => {};
    let fail: (error: Error) => void = () => {};
    const first = new Promise<GlobalMapConnection[]>(resolve => { finish = resolve; });
    const second = new Promise<GlobalMapConnection[]>((_resolve, reject) => { fail = reject; });
    vi.stubGlobal('$fetch', vi.fn().mockReturnValueOnce(first).mockReturnValueOnce(second).mockResolvedValueOnce([conexion]));
    const map = useGlobalMap();
    const selection = useCatalog(); selection.rutas.value = [mapArcRoute(arc)];
    const old = map.load(); const oldFailure = map.load();
    map.filter.value = { mode: 'paises', limit: 10, paisOrigenId: 'ar', paisDestinoId: 'es' };
    await map.load(); finish([]); fail(new Error('stale')); await Promise.all([old, oldFailure]);
    expect(map.connections.value).toEqual([conexion]);
    expect(map.error.value).toBeNull();
    expect(map.loading.value).toBe(false);
    expect(selection.rutas.value).toHaveLength(1);
  });

  it('clears old results on failure and permits retry', async () => {
    vi.stubGlobal('$fetch', vi.fn().mockRejectedValueOnce(new Error('unavailable')).mockResolvedValueOnce([conexion]));
    const map = useGlobalMap(); await map.load();
    expect(map.connections.value).toEqual([]); expect(map.error.value).toBe('unavailable');
    await map.load(); expect(map.error.value).toBeNull(); expect(map.connections.value).toHaveLength(1);
  });

  it('filters unclassified paises and permits retry after catalogue errors', async () => {
    vi.stubGlobal('$fetch', vi.fn().mockRejectedValueOnce(new Error('paises unavailable')).mockResolvedValueOnce([
      { id: 'ar', nombre: 'Argentina', continent: 'SA' }, { id: 'xx', nombre: 'Unknown', continent: null },
    ]));
    const map = useGlobalMap(); await map.loadCountries();
    expect(map.countriesError.value).toBe('paises unavailable');
    await map.loadCountries(); expect(map.paises.value.map(c => c.id)).toEqual(['ar']);
    expect(map.countriesError.value).toBeNull();
  });
});

