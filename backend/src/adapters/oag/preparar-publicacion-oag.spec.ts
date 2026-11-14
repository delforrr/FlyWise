import { prepararPublicacionOag } from './preparar-publicacion-oag.js';

it('incluye los vuelos sin estado en los descartes de una carga sin cobertura', () => {
  const vuelo = {
    id: 'vuelo',
    aerolineaId: 'operadora',
    fechaVuelo: '2026-10-01',
    numeroVuelo: '1',
    revision: 0,
    horarios: {
      salidaProgramadaUtc: null,
      salidaRealUtc: null,
      llegadaProgramadaUtc: null,
      llegadaRealUtc: null,
      desfaseOrigenMinutos: null,
      evidenciaFecha: 'fecha-informada',
    },
    estado: null,
    demoraLlegadaMinutos: null,
  } as const;

  expect(
    prepararPublicacionOag(
      [vuelo],
      { origenId: 'origen', destinoId: 'destino', coberturaMinimaPct: 90 },
      2,
    ),
  ).toEqual({ tipo: 'cobertura-insuficiente', descartadas: 3 });
});
