import {
  catalogValue,
  type CatalogDataset,
  type CatalogRecord,
} from '../catalog.js';

export function readOurAirportsRow(
  dataset: CatalogDataset,
  row: Record<string, string>,
): CatalogRecord {
  if (dataset === 'paises') {
    if (!/^[A-Z]{2}$/.test(row.code ?? '') || !row.name?.trim())
      throw new Error('pais: código o nombre inválido');
    return { codigoIso: row.code, nombre: row.name.trim() };
  }
  if (dataset !== 'aeropuertos')
    throw new Error('OurAirports sólo admite países y aeropuertos');
  if (!['small_airport', 'medium_airport', 'large_airport'].includes(row.type))
    throw new Error('tipo: instalación sin aeropuerto operativo');
  const latitud = Number(row.latitude_deg),
    longitud = Number(row.longitude_deg);
  if (
    !row.id ||
    !row.name?.trim() ||
    !row.latitude_deg?.trim() ||
    !row.longitude_deg?.trim() ||
    !Number.isFinite(latitud) ||
    !Number.isFinite(longitud) ||
    Math.abs(latitud) > 90 ||
    Math.abs(longitud) > 180 ||
    !/^[A-Z]{2}$/.test(row.iso_country ?? '')
  )
    throw new Error('aeropuerto: identidad, país o coordenadas inválidas');
  return {
    identificador: row.id,
    nombre: row.name.trim(),
    ciudad: catalogValue(row.municipality),
    codigoIso: row.iso_country,
    latitud,
    longitud,
    iata: /^[A-Z]{3}$/.test(row.iata_code ?? '') ? row.iata_code : null,
    icao: /^[A-Z0-9]{4}$/.test(row.icao_code ?? '') ? row.icao_code : null,
  };
}
