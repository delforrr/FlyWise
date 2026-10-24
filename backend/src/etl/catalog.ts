export type CatalogDataset = 'countries' | 'airports' | 'airlines' | 'routes';
export type CatalogRecord = Record<string, string | number | boolean | null>;

export const OPENFLIGHTS_COLUMNS: Record<CatalogDataset, string[]> = {
  countries: ['name', 'isoCode', '_dafif'],
  airports: [
    'openflightsId',
    'name',
    'city',
    'countryName',
    'iata',
    'icao',
    'latitude',
    'longitude',
    '_altitude',
    '_timezone',
    '_dst',
    '_tz',
    '_type',
    'source',
  ],
  airlines: [
    'openflightsId',
    'name',
    '_alias',
    'iata',
    'icao',
    '_callsign',
    'country',
    'active',
  ],
  routes: [
    'airlineCode',
    'airlineOpenflightsId',
    'originCode',
    'originOpenflightsId',
    'destinationCode',
    'destinationOpenflightsId',
    'codeshare',
    'stops',
    '_equipment',
  ],
};

export function catalogValue(value: unknown): string | null {
  const text =
    typeof value === 'string'
      ? value.trim()
      : typeof value === 'number' || typeof value === 'boolean'
        ? String(value)
        : '';
  return text === '' || text === String.raw`\N` ? null : text;
}

function code(value: unknown, pattern: RegExp) {
  const text = catalogValue(value)?.toUpperCase();
  return text && pattern.test(text) ? text : null;
}

function identifier(value: unknown, required = false) {
  const text = catalogValue(value);
  const id = text && /^\d+$/.test(text) ? Number(text) : Number.NaN;
  if (Number.isSafeInteger(id) && id > 0 && id <= 2147483647) return id;
  if (required)
    throw new Error('openflightsId: identidad invalida o marcador Unknown');
  return null;
}

function requiredText(value: unknown, field: string) {
  const text = catalogValue(value);
  if (!text) throw new Error(`${field}: obligatorio`);
  return text;
}

export function normalizeCatalogRow(
  dataset: CatalogDataset,
  row: Record<string, unknown>,
): CatalogRecord {
  if (dataset === 'countries')
    return {
      name: requiredText(row.name, 'name'),
      isoCode: code(row.isoCode, /^[A-Z]{2}$/),
    };
  if (dataset === 'routes') {
    const text = catalogValue(row.stops);
    const stops =
      text !== null && /^\d+$/.test(text) ? Number(text) : Number.NaN;
    if (!Number.isSafeInteger(stops) || stops > 2147483647)
      throw new Error('stops: entero no negativo obligatorio');
    const codeshare = catalogValue(row.codeshare)?.toUpperCase();
    if (codeshare && !['Y', 'N', 'TRUE', 'FALSE'].includes(codeshare))
      throw new Error('codeshare: indicador invalido');
    return {
      airlineCode: code(row.airlineCode, /^[A-Z0-9]{2,3}$/),
      airlineOpenflightsId: identifier(row.airlineOpenflightsId),
      originCode: code(row.originCode, /^[A-Z0-9]{3,4}$/),
      originOpenflightsId: identifier(row.originOpenflightsId),
      destinationCode: code(row.destinationCode, /^[A-Z0-9]{3,4}$/),
      destinationOpenflightsId: identifier(row.destinationOpenflightsId),
      codeshare: codeshare === 'Y' || codeshare === 'TRUE',
      stops,
    };
  }
  const common = {
    openflightsId: identifier(row.openflightsId, true),
    name: requiredText(row.name, 'name'),
  };
  if (dataset === 'airlines') {
    const active = catalogValue(row.active)?.toUpperCase();
    return {
      ...common,
      iata: code(row.iata, /^[A-Z0-9]{2}$/),
      icao: code(row.icao, /^[A-Z0-9]{3}$/),
      country: catalogValue(row.country),
      active: ['Y', 'TRUE'].includes(active ?? '')
        ? true
        : ['N', 'FALSE'].includes(active ?? '')
          ? false
          : null,
    };
  }
  const coordinates: Record<string, number> = {};
  for (const [field, bound] of [
    ['latitude', 90],
    ['longitude', 180],
  ] as const) {
    const text = catalogValue(row[field]);
    const number = text === null ? Number.NaN : Number(text);
    if (!Number.isFinite(number) || Math.abs(number) > bound)
      throw new Error(`${field}: coordenada invalida`);
    coordinates[field] = number;
  }
  return {
    ...common,
    ...coordinates,
    city: catalogValue(row.city),
    countryName: catalogValue(row.countryName) ?? 'Unknown',
    iata: code(row.iata, /^[A-Z]{3}$/),
    icao: code(row.icao, /^[A-Z0-9]{4}$/),
    source: catalogValue(row.source) ?? 'OpenFlights',
  };
}
