import { jest } from '@jest/globals';
import { demoraReintentoOag } from './cola-oag.js';
import { paginasOag } from './flight-info.js';

const consulta = {
  origenCodigo: 'AEP',
  destinoCodigo: 'COR',
  tipoCodigo: 'IATA' as const,
  periodo: '2026-10',
};

describe('Reintentos del adaptador OAG', () => {
  afterEach(() => jest.restoreAllMocks());

  it('clasifica fallos de red y usa espera exponencial sin Retry-After', async () => {
    jest
      .spyOn(globalThis, 'fetch')
      .mockRejectedValueOnce(new TypeError('fetch'));
    const error = await paginasOag(consulta, 'fixture')
      .next()
      .catch((error: Error) => error);
    expect(error).toBeInstanceOf(Error);
    if (!(error instanceof Error))
      throw new Error('Se esperaba un fallo de red');
    expect(demoraReintentoOag(1, 'oag', error)).toBe(2000);
    expect(demoraReintentoOag(2, 'oag', error)).toBe(4000);
  });

  it('respeta Retry-After de un error 503 en formato fecha HTTP', async () => {
    jest.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-11-13T12:00:00Z'));
    jest.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(null, {
        status: 503,
        headers: { 'Retry-After': 'Fri, 13 Nov 2026 12:01:00 GMT' },
      }),
    );
    const error = await paginasOag(consulta, 'fixture')
      .next()
      .catch((error: Error) => error);
    if (!(error instanceof Error)) throw new Error('Se esperaba HTTP 503');
    expect(error.message).toBe('OAG respondió HTTP 503');
    expect(demoraReintentoOag(1, 'oag', error)).toBe(60_000);
  });

  it('descarta un cursor repetido sin reintentos', async () => {
    jest.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      Response.json({
        data: [],
        paging: { next: '?After=repetido' },
      }),
    );
    const error = await paginasOag(consulta, 'fixture', ['repetido'])
      .next()
      .catch((error: Error) => error);
    if (!(error instanceof Error))
      throw new Error('Se esperaba un cursor inválido');
    expect(error.message).toContain('cursor de paginación inválido');
    expect(demoraReintentoOag(1, 'oag', error)).toBe(-1);
  });
});

it('rechaza una página final con menos filas que el total informado tras reanudar', async () => {
  const fetch = jest
    .spyOn(globalThis, 'fetch')
    .mockResolvedValueOnce(
      Response.json({ data: [{}], paging: { totalCount: 4 } }),
    );
  try {
    await expect(
      paginasOag(consulta, 'fixture', ['anterior'], 2).next(),
    ).rejects.toThrow(
      'La paginación de OAG no coincide con el total informado',
    );
  } finally {
    fetch.mockRestore();
  }
});

it('conserva el total esperado al reanudar cuando la página final lo omite', async () => {
  const fetch = jest
    .spyOn(globalThis, 'fetch')
    .mockResolvedValueOnce(Response.json({ data: [{}] }));
  try {
    await expect(
      paginasOag(consulta, 'fixture', ['anterior'], 2, 4).next(),
    ).rejects.toThrow(
      'La paginación de OAG no coincide con el total informado',
    );
  } finally {
    fetch.mockRestore();
  }
});
