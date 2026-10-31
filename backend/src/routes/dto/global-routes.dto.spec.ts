import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { GlobalRoutesDto } from './global-routes.dto.js';
import {
  countryContinent,
  COUNTRY_CONTINENTS,
} from '../../countries/continents.js';
import { ExploreRoutesDto } from './explore-routes.dto.js';

describe('Global rutas validation', () => {
  it('defaults to global top 50 and accepts each supported limit', async () => {
    expect(plainToInstance(GlobalRoutesDto, {})).toMatchObject({
      mode: 'global',
      limit: 50,
    });
    for (const limit of [10, 20, 50, 100])
      expect(
        await validate(
          plainToInstance(GlobalRoutesDto, { limit: String(limit) }),
        ),
      ).toEqual([]);
  });
  it.each([
    { mode: 'unknown' },
    { limit: 500 },
    { limit: 0 },
    { limit: 'bad' },
    { mode: 'domestic' },
    { mode: 'paises', paisOrigenId: 'invalid' },
    { mode: 'continents', continenteOrigen: 'SA' },
    { mode: 'continents', continenteOrigen: 'xx', continenteDestino: 'EU' },
  ])('rejects invalid or incomplete filters %j', async (query) => {
    expect(
      (await validate(plainToInstance(GlobalRoutesDto, query))).length,
    ).toBeGreaterThan(0);
  });
  it('parses incluirRegreso explicitly rather than coercing false strings to true', async () => {
    expect(
      plainToInstance(ExploreRoutesDto, { incluirRegreso: 'false' })
        .incluirRegreso,
    ).toBe(false);
    expect(
      plainToInstance(ExploreRoutesDto, { incluirRegreso: 'true' })
        .incluirRegreso,
    ).toBe(true);
    expect(
      (
        await validate(
          plainToInstance(ExploreRoutesDto, { incluirRegreso: 'yes' }),
        )
      ).length,
    ).toBeGreaterThan(0);
  });
  it('classifies ISO codes, with Central America and Caribbean in North America', () => {
    expect(countryContinent('ar')).toBe('SA');
    expect(countryContinent('ES')).toBe('EU');
    expect(countryContinent('CR')).toBe('NA');
    expect(countryContinent('CU')).toBe('NA');
    expect(countryContinent('AQ')).toBe('AN');
    expect(countryContinent(null)).toBeNull();
    expect(countryContinent('xx')).toBeNull();
    expect(Object.keys(COUNTRY_CONTINENTS).length).toBeGreaterThan(240);
  });
});
