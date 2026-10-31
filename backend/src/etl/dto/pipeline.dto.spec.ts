import { ValidationPipe } from '@nestjs/common';
import { CreatePipelineDto } from './pipeline.dto.js';

describe('Pipeline input validation', () => {
  const pipe = new ValidationPipe({
    transform: true,
    whitelist: true,
    forbidNonWhitelisted: true,
  });
  const valid = {
    nombre: 'Airports',
    nombreConjunto: 'OpenFlights',
    entidadDestino: 'aeropuertos',
    conexion: {
      tipoFuente: 'http_stream',
      urlEndpoint: 'https://raw.githubusercontent.com/data',
      metodoHttp: 'GET',
      formatoDatos: 'csv',
    },
    mapeoEsquema: [],
    configuracionProgramacion: {
      expresionCron: '',
      tamanoLote: 2000,
      tiempoLimiteSegundos: 300,
      maximoReintentos: 2,
    },
  };
  it('accepts a strict CSV GET configuration', async () => {
    await expect(
      pipe.transform(valid, { type: 'body', metatype: CreatePipelineDto }),
    ).resolves.toBeInstanceOf(CreatePipelineDto);
  });
  it.each([
    {
      ...valid,
      conexion: {
        ...valid.conexion,
        headers: [{ key: 'Authorization', value: 'literal-secret' }],
      },
    },
    { ...valid, conexion: { ...valid.conexion, formatoDatos: 'json' } },
    {
      ...valid,
      configuracionProgramacion: {
        ...valid.configuracionProgramacion,
        concurrency: 4,
      },
    },
    {
      ...valid,
      configuracionProgramacion: {
        ...valid.configuracionProgramacion,
        tamanoLote: 999,
      },
    },
    { ...valid, entidadDestino: 'otp_metrics' },
  ])('rejects unsupported or unsafe configurations', async (body) => {
    await expect(
      pipe.transform(body, { type: 'body', metatype: CreatePipelineDto }),
    ).rejects.toThrow();
  });
});
