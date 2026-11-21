import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Inject,
  Post,
  UseGuards,
} from '@nestjs/common';
import { IsIn, IsOptional, IsUUID, Matches } from 'class-validator';
import { AdminGuard, JwtAuthGuard } from '../auth/auth.guard.js';
import type { CargasVuelos } from '../ingestion/application/carga-vuelos.js';
import { periodosCerradosMapa } from '../metrics/periodos-mapa.js';
import { CurrentUser } from '../users/decorators/current-user.decorator.js';
import type { UserDto } from '../users/dto/user.dto.js';

export const CARGAS_VUELOS = Symbol('CARGAS_VUELOS');

class CargarVuelosDto {
  @IsIn(['mensual', 'tramo'])
  alcance!: 'mensual' | 'tramo';

  @IsOptional()
  @Matches(/^(?!0000)\d{4}-(0[1-9]|1[0-2])$/)
  periodo?: string;

  @IsOptional() @IsUUID() origenId?: string;
  @IsOptional() @IsUUID() destinoId?: string;
}

@UseGuards(JwtAuthGuard, AdminGuard)
@Controller('administracion/cargas-vuelos')
export class CargasVuelosController {
  constructor(@Inject(CARGAS_VUELOS) private readonly cargas: CargasVuelos) {}

  @Get()
  opciones() {
    return {
      ultimoMesCerrado: periodosCerradosMapa()[0],
      coberturaMensual: this.cargas.coberturaMensual,
    };
  }

  @Post()
  async ejecutar(@Body() dto: CargarVuelosDto, @CurrentUser() user: UserDto) {
    const periodo = dto.periodo ?? periodosCerradosMapa()[0];
    const { alcance, origenId, destinoId } = dto;
    if (alcance === 'mensual') {
      if (origenId != null || destinoId != null)
        throw new BadRequestException(
          'La carga mensual utiliza toda la cobertura disponible',
        );
      return {
        ...(await this.cargas.mensual({ alcance, periodo }, user.id)),
        periodo,
      };
    }
    if (!origenId || !destinoId || origenId === destinoId)
      throw new BadRequestException('Seleccioná dos aeropuertos distintos');
    return {
      ...(await this.cargas.tramo(
        { alcance, periodo, origenId, destinoId },
        user.id,
      )),
      periodo,
    };
  }
}
