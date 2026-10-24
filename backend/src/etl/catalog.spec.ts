import { normalizeCatalogRow, catalogValue } from './catalog.js';

describe('OpenFlights catalog validation', () => {
  it('preserves airports without codes and coordinates at zero', () => {
    expect(
      normalizeCatalogRow('airports', {
        openflightsId: '42',
        name: 'Airport',
        iata: '\\N',
        latitude: '0',
        longitude: '-58',
      }),
    ).toMatchObject({
      openflightsId: 42,
      iata: null,
      latitude: 0,
      longitude: -58,
    });
  });
  it('keeps inactive airlines and unknown activity', () => {
    expect(
      normalizeCatalogRow('airlines', {
        openflightsId: '2',
        name: 'Historical',
        active: 'n',
      }),
    ).toMatchObject({ active: false });
    expect(
      normalizeCatalogRow('airlines', {
        openflightsId: '3',
        name: 'Unknown status',
        active: '\\N',
      }),
    ).toMatchObject({ active: null });
  });
  it('rejects missing coordinates instead of creating a point at zero', () => {
    expect(() =>
      normalizeCatalogRow('airports', {
        openflightsId: '1',
        name: 'Airport',
        latitude: '\\N',
        longitude: '10',
      }),
    ).toThrow(/latitude/);
  });
  it('keeps entities when optional codes are malformed', () => {
    expect(
      normalizeCatalogRow('airlines', {
        openflightsId: '1',
        name: 'Airline',
        iata: 'N/A',
        icao: '-',
      }),
    ).toMatchObject({ iata: null, icao: null });
  });
  it('preserves meaningful text and rejects sentinel identities', () => {
    expect(catalogValue('-')).toBe('-');
    expect(catalogValue(' \\N ')).toBeNull();
    expect(() =>
      normalizeCatalogRow('airlines', { openflightsId: '-1', name: 'Unknown' }),
    ).toThrow(/marcador/);
  });
  it('retains stops and codeshare, rejects fractional stops', () => {
    expect(
      normalizeCatalogRow('routes', {
        originCode: 'AAA',
        destinationCode: 'BBB',
        stops: '1',
        codeshare: 'Y',
      }),
    ).toMatchObject({ stops: 1, codeshare: true });
    expect(() => normalizeCatalogRow('routes', { stops: '1.5' })).toThrow(
      /stops/,
    );
  });
});
