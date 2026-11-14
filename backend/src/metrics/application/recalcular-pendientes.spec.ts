import { recalcularPendientes } from './recalcular-pendientes.js';

it('conserva la publicación vigente y recalcula la población sin publicación', async () => {
  const publicada = {
    origenId: 'origen',
    destinoId: 'destino',
    aerolineaId: 'operadora',
    periodo: '2026-10',
  };
  const administrativa = { ...publicada, periodo: '2026-09' };
  const evidencia = {
    ejecucionId: null,
    actualizada: true,
    vuelosTotales: 1,
    fuentes: ['OAG'],
  };
  const limpiarPendiente = jest.fn();
  const publicarAdministrativa = jest.fn();

  await expect(
    recalcularPendientes({
      leerPendientes: () =>
        Promise.resolve([
          { ...publicada, ...evidencia },
          { ...administrativa, ...evidencia, fuentes: ['Administrativa'] },
        ]),
      limpiarPendiente,
      publicarAdministrativa,
    }),
  ).resolves.toBe(2);

  expect(limpiarPendiente).toHaveBeenCalledWith(publicada);
  expect(publicarAdministrativa).toHaveBeenCalledWith(administrativa);
});
