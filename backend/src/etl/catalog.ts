import { createHash } from 'node:crypto';
export type CatalogDataset = 'paises' | 'aeropuertos' | 'aerolineas' | 'rutas';
export type CatalogRecord = Record<string, string | number | boolean | null>;

export const OPENFLIGHTS_COLUMNS: Record<CatalogDataset, string[]> = {
  paises: ['nombre', 'codigoIso', '_dafif'],
  aeropuertos: [
    'idOpenflights',
    'nombre',
    'ciudad',
    'nombrePais',
    'iata',
    'icao',
    'latitud',
    'longitud',
    '_altitude',
    '_timezone',
    '_dst',
    '_tz',
    '_type',
    'fuente',
  ],
  aerolineas: [
    'idOpenflights',
    'nombre',
    '_alias',
    'iata',
    'icao',
    '_callsign',
    'pais',
    'activa',
  ],
  rutas: [
    'codigoAerolinea',
    'idOpenflightsAerolinea',
    'codigoOrigen',
    'idOpenflightsOrigen',
    'codigoDestino',
    'idOpenflightsDestino',
    'codigoCompartido',
    'escalas',
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
    throw new Error('idOpenflights: identidad invalida o marcador Unknown');
  return null;
}

function requiredText(value: unknown, campo: string) {
  const text = catalogValue(value);
  if (!text) throw new Error(`${campo}: obligatorio`);
  return text;
}

export function normalizeCatalogRow(
  dataset: CatalogDataset,
  row: Record<string, unknown>,
): CatalogRecord {
  if (dataset === 'paises')
    return {
      nombre: requiredText(row.nombre, 'nombre'),
      codigoIso: code(row.codigoIso, /^[A-Z]{2}$/),
    };
  if (dataset === 'rutas') {
    const text = catalogValue(row.escalas);
    const escalas =
      text !== null && /^\d+$/.test(text) ? Number(text) : Number.NaN;
    if (!Number.isSafeInteger(escalas) || escalas > 2147483647)
      throw new Error('escalas: entero no negativo obligatorio');
    const codigoCompartido = catalogValue(row.codigoCompartido)?.toUpperCase();
    if (
      codigoCompartido &&
      !['Y', 'N', 'TRUE', 'FALSE'].includes(codigoCompartido)
    )
      throw new Error('codigoCompartido: indicador invalido');
    return {
      codigoAerolinea: code(row.codigoAerolinea, /^[A-Z0-9]{2,3}$/),
      idOpenflightsAerolinea: identifier(row.idOpenflightsAerolinea),
      codigoOrigen: code(row.codigoOrigen, /^[A-Z0-9]{3,4}$/),
      idOpenflightsOrigen: identifier(row.idOpenflightsOrigen),
      codigoDestino: code(row.codigoDestino, /^[A-Z0-9]{3,4}$/),
      idOpenflightsDestino: identifier(row.idOpenflightsDestino),
      codigoCompartido: codigoCompartido === 'Y' || codigoCompartido === 'TRUE',
      escalas,
    };
  }
  const common = {
    idOpenflights: identifier(row.idOpenflights, true),
    nombre: requiredText(row.nombre, 'nombre'),
  };
  if (dataset === 'aerolineas') {
    const activa = catalogValue(row.activa)?.toUpperCase();
    return {
      ...common,
      iata: code(row.iata, /^[A-Z0-9]{2}$/),
      icao: code(row.icao, /^[A-Z0-9]{3}$/),
      pais: catalogValue(row.pais),
      activa: ['Y', 'TRUE'].includes(activa ?? '')
        ? true
        : ['N', 'FALSE'].includes(activa ?? '')
          ? false
          : null,
    };
  }
  const coordenadas: Record<string, number> = {};
  for (const [campo, bound] of [
    ['latitud', 90],
    ['longitud', 180],
  ] as const) {
    const text = catalogValue(row[campo]);
    const number = text === null ? Number.NaN : Number(text);
    if (!Number.isFinite(number) || Math.abs(number) > bound)
      throw new Error(`${campo}: coordenada invalida`);
    coordenadas[campo] = number;
  }
  return {
    ...common,
    ...coordenadas,
    ciudad: catalogValue(row.ciudad),
    nombrePais: catalogValue(row.nombrePais) ?? 'Unknown',
    iata: code(row.iata, /^[A-Z]{3}$/),
    icao: code(row.icao, /^[A-Z0-9]{4}$/),
    fuente: catalogValue(row.fuente) ?? 'OpenFlights',
  };
}

export const OPENFLIGHTS_FILES: Record<CatalogDataset, string> = {
  paises: 'countries.dat',
  aeropuertos: 'airports.dat',
  aerolineas: 'airlines.dat',
  rutas: 'routes.dat',
};

// Fingerprint only source identities, before resolving mutable catalog relations.
export function claveRutaFuente(row: CatalogRecord) {
  return createHash('sha256')
    .update(
      JSON.stringify([
        row.idOpenflightsOrigen ?? row.codigoOrigen,
        row.idOpenflightsDestino ?? row.codigoDestino,
        row.idOpenflightsAerolinea ?? row.codigoAerolinea,
        row.codigoCompartido,
        row.escalas,
      ]),
    )
    .digest('hex');
}
