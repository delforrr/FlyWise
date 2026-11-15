import { jest } from '@jest/globals';
import {
  OPENFLIGHTS_COLUMNS,
  type CatalogDataset,
} from '../../src/etl/catalog.js';
import { catalogFile } from './catalog-file.js';
import type { PipelineConfiguration } from '../../src/etl/interfaces/pipeline-configuration.js';

export function catalogSnapshot(
  dataset: CatalogDataset,
): PipelineConfiguration {
  return {
    conexion: {
      tipoFuente: 'http_stream',
      urlEndpoint: 'https://raw.githubusercontent.com/flywise-test/catalog.csv',
      metodoHttp: 'GET',
      formatoDatos: 'csv',
      csvConCabecera: false,
    },
    mapeoEsquema: OPENFLIGHTS_COLUMNS[dataset].flatMap((campoDestino, index) =>
      campoDestino.startsWith('_')
        ? []
        : [{ campoDestino, columnaOrigen: String(index) }],
    ),
    configuracionProgramacion: {
      expresionCron: '',
      tamanoLote: 2000,
      tiempoLimiteSegundos: 300,
      maximoReintentos: 2,
    },
  };
}

export async function mockCatalogHttp(path: string) {
  const source = await import('../../src/etl/http-source.js');
  const openCsvSource = jest.fn(() => Promise.resolve(catalogFile(path)));
  jest.unstable_mockModule('../../src/etl/http-source.js', () => ({
    ...source,
    openCsvSource,
  }));
  return openCsvSource;
}
