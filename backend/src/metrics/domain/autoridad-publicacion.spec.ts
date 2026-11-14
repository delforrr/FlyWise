import { tienePublicacionExterna } from './autoridad-publicacion.js';

describe('autoridad de publicación', () => {
  const publicada = {
    ejecucionId: null,
    actualizada: true,
    vuelosTotales: 1,
    fuentes: ['OAG'],
  };

  it.each([
    [
      'ejecución vigente con cero vuelos',
      { ejecucionId: 'e1', vuelosTotales: 0 },
      true,
    ],
    ['publicación externa histórica', {}, true],
    ['métrica aún sin publicar', { actualizada: false }, false],
    ['carga histórica sin vuelos', { vuelosTotales: 0 }, false],
    ['publicación administrativa', { fuentes: ['Administrativa'] }, false],
    [
      'publicación de fuentes mixtas',
      { fuentes: ['Administrativa', 'OAG'] },
      true,
    ],
  ] as const)('%s', (_caso, cambio, esperado) => {
    expect(tienePublicacionExterna({ ...publicada, ...cambio })).toBe(esperado);
  });
});
