import { normalizeCatalogRow, catalogValue } from './catalog.js';

describe('OpenFlights catalog validation', () => {
  it('preserves the textual NAN code used by Nadi in airports.dat', () => {
    expect(
      normalizeCatalogRow('aeropuertos', {
        idOpenflights: '1960',
        nombre: 'Nadi International Aeropuerto',
        iata: 'NAN',
        icao: 'NFFN',
        latitud: '-17.755399703979492',
        longitud: '177.4429931640625',
      }),
    ).toMatchObject({ iata: 'NAN', icao: 'NFFN' });
  });
  it('preserves aeropuertos without codes and coordenadas at zero', () => {
    expect(
      normalizeCatalogRow('aeropuertos', {
        idOpenflights: '42',
        nombre: 'Aeropuerto',
        iata: '\\N',
        latitud: '0',
        longitud: '-58',
      }),
    ).toMatchObject({
      idOpenflights: 42,
      iata: null,
      latitud: 0,
      longitud: -58,
    });
  });
  it('keeps inactive aerolineas and unknown activity', () => {
    expect(
      normalizeCatalogRow('aerolineas', {
        idOpenflights: '2',
        nombre: 'Historical',
        activa: 'n',
      }),
    ).toMatchObject({ activa: false });
    expect(
      normalizeCatalogRow('aerolineas', {
        idOpenflights: '3',
        nombre: 'Unknown estado',
        activa: '\\N',
      }),
    ).toMatchObject({ activa: null });
  });
  it('rejects missing coordenadas instead of creating a point at zero', () => {
    expect(() =>
      normalizeCatalogRow('aeropuertos', {
        idOpenflights: '1',
        nombre: 'Aeropuerto',
        latitud: '\\N',
        longitud: '10',
      }),
    ).toThrow(/latitud/);
  });
  it('keeps entities when optional codes are malformed', () => {
    expect(
      normalizeCatalogRow('aerolineas', {
        idOpenflights: '1',
        nombre: 'Aerolinea',
        iata: 'N/A',
        icao: '-',
      }),
    ).toMatchObject({ iata: null, icao: null });
  });
  it('preserves meaningful text and rejects sentinel identities', () => {
    expect(catalogValue('-')).toBe('-');
    expect(catalogValue(' \\N ')).toBeNull();
    expect(() =>
      normalizeCatalogRow('aerolineas', {
        idOpenflights: '-1',
        nombre: 'Unknown',
      }),
    ).toThrow(/marcador/);
  });
  it('retains escalas and codigoCompartido, rejects fractional escalas', () => {
    expect(
      normalizeCatalogRow('rutas', {
        codigoOrigen: 'AAA',
        codigoDestino: 'BBB',
        escalas: '1',
        codigoCompartido: 'Y',
      }),
    ).toMatchObject({ escalas: 1, codigoCompartido: true });
    expect(() => normalizeCatalogRow('rutas', { escalas: '1.5' })).toThrow(
      /escalas/,
    );
  });
});
