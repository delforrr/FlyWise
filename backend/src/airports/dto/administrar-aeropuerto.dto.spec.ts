import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import {
  CrearAeropuertoDto,
  EditarAeropuertoDto,
} from './administrar-aeropuerto.dto.js';

describe('DTO administrativo de aeropuerto', () => {
  it('permite cambios parciales, pero rechaza null en campos obligatorios y coordenadas inválidas', () => {
    expect(
      validateSync(
        plainToInstance(EditarAeropuertoDto, { nombre: ' Ezeiza ' }),
      ),
    ).toEqual([]);
    expect(
      validateSync(plainToInstance(EditarAeropuertoDto, { nombre: null })),
    ).not.toEqual([]);
    expect(
      validateSync(plainToInstance(EditarAeropuertoDto, { latitud: 91 })),
    ).not.toEqual([]);
    expect(
      validateSync(plainToInstance(CrearAeropuertoDto, { nombre: '   ' })),
    ).not.toEqual([]);
    expect(plainToInstance(EditarAeropuertoDto, { iata: ' eze ' }).iata).toBe(
      'EZE',
    );
  });
});
