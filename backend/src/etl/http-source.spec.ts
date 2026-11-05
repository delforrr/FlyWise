import {
  validateSourceUrl,
  sourceHeaders,
  redactSourceRow,
} from './http-source.js';

describe('HTTP catalog trust boundary', () => {
  const conexion = {
    tipoFuente: 'http_stream' as const,
    metodoHttp: 'GET' as const,
    formatoDatos: 'csv' as const,
    urlEndpoint:
      'https://raw.githubusercontent.com/jpatokal/openflights/master/data/airports.dat',
  };
  afterEach(() => {
    delete process.env.ETL_ALLOWED_CREDENTIAL_REFS;
    delete process.env.ETL_TEST_TOKEN;
  });
  it.each([
    'http://raw.githubusercontent.com/data',
    'https://127.0.0.1/data',
    'https://localhost/data',
    'https://raw.githubusercontent.com.evil.test/data',
    'https://user:password@raw.githubusercontent.com/data',
    'https://raw.githubusercontent.com/data?token=secret',
    'https://raw.githubusercontent.com/data#secret',
  ])('rejects an unsafe input URL %s', (url) => {
    expect(() => validateSourceUrl(url)).toThrow();
  });
  it('accepts only exact explicitly allowed HTTPS hosts', () => {
    expect(validateSourceUrl(conexion.urlEndpoint).hostname).toBe(
      'raw.githubusercontent.com',
    );
  });
  it('does not resolve arbitrary server environment variables', () => {
    expect(() =>
      sourceHeaders({
        ...conexion,
        headers: [
          { key: 'Authorization', referenciaCredencial: 'DATABASE_URL' },
        ],
      }),
    ).toThrow();
  });
  it('redacts sensitive columns and referenced credential values from samples', () => {
    process.env.ETL_ALLOWED_CREDENTIAL_REFS = 'ETL_TEST_TOKEN';
    process.env.ETL_TEST_TOKEN = 'test-secret';
    const config = {
      ...conexion,
      headers: [
        { key: 'Authorization', referenciaCredencial: 'ETL_TEST_TOKEN' },
      ],
    };
    expect(sourceHeaders(config)).toEqual({ Authorization: 'test-secret' });
    expect(
      redactSourceRow(
        {
          token: 'other',
          nombre: 'prefix test-secret suffix',
          name2: 'Aeropuerto',
        },
        config,
      ),
    ).toEqual({
      token: '[REDACTED]',
      nombre: 'prefix [REDACTED] suffix',
      name2: 'Aeropuerto',
    });
  });
});
