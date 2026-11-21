import { CargasVuelosController } from './cargas-vuelos.controller.js';
import type { UserDto } from '../users/dto/user.dto.js';

it('envía el mes cerrado y el alcance al puerto de carga', async () => {
  const mensual = jest.fn().mockResolvedValue({ ejecucionId: 'mes' });
  const tramo = jest.fn().mockResolvedValue({ ejecucionId: 'ruta' });
  const controller = new CargasVuelosController({
    coberturaMensual: 'Cobertura del proveedor',
    mensual,
    tramo,
  });
  const usuario = { id: 'solicitante' } as UserDto;
  const periodo = controller.opciones().ultimoMesCerrado;
  await expect(
    controller.ejecutar({ alcance: 'mensual' }, usuario),
  ).resolves.toEqual({ ejecucionId: 'mes', periodo });
  await expect(
    controller.ejecutar(
      { alcance: 'tramo', periodo, origenId: 'o', destinoId: 'd' },
      usuario,
    ),
  ).resolves.toEqual({ ejecucionId: 'ruta', periodo });
  await expect(
    controller.ejecutar(
      { alcance: 'tramo', origenId: 'o', destinoId: 'o' },
      usuario,
    ),
  ).rejects.toThrow('Seleccioná dos aeropuertos distintos');
  expect(mensual).toHaveBeenCalledWith(
    { alcance: 'mensual', periodo },
    usuario.id,
  );
  expect(tramo).toHaveBeenCalledWith(
    { alcance: 'tramo', periodo, origenId: 'o', destinoId: 'd' },
    usuario.id,
  );
});
