import { ValidationPipe } from '@nestjs/common';
import { CreatePipelineDto } from './pipeline.dto.js';

describe('Pipeline input validation', () => {
  const pipe = new ValidationPipe({
    transform: true,
    whitelist: true,
    forbidNonWhitelisted: true,
  });
  const valid = {
    name: 'Airports',
    datasetName: 'OpenFlights',
    targetEntity: 'airports',
    connection: {
      sourceType: 'http_stream',
      endpointUrl: 'https://raw.githubusercontent.com/data',
      httpMethod: 'GET',
      dataFormat: 'csv',
    },
    schemaMapping: [],
    scheduleConfig: {
      cronExpression: '',
      batchSize: 2000,
      timeoutSeconds: 300,
      maxRetries: 2,
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
      connection: {
        ...valid.connection,
        headers: [{ key: 'Authorization', value: 'literal-secret' }],
      },
    },
    { ...valid, connection: { ...valid.connection, dataFormat: 'json' } },
    { ...valid, scheduleConfig: { ...valid.scheduleConfig, concurrency: 4 } },
    { ...valid, scheduleConfig: { ...valid.scheduleConfig, batchSize: 999 } },
    { ...valid, targetEntity: 'otp_metrics' },
  ])('rejects unsupported or unsafe configurations', async (body) => {
    await expect(
      pipe.transform(body, { type: 'body', metatype: CreatePipelineDto }),
    ).rejects.toThrow();
  });
});
