import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class ConfiguracionBtsDto {
  @ApiProperty({ example: '2026-08' })
  @Matches(/^(?!0000)\d{4}-(0[1-9]|1[0-2])$/)
  periodo!: string;
  @ApiProperty() @IsBoolean() pausado!: boolean;
  @ApiProperty({
    description: 'Cron mensual UTC; vacío deshabilita programación',
  })
  @IsString()
  @MaxLength(100)
  expresionCron!: string;
}
export class ConsultaBtsDto {
  @IsOptional() @IsIn(['aeropuertos', 'operadores']) tipo:
    'aeropuertos' | 'operadores' = 'aeropuertos';
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) pagina = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limite = 20;
}
export class CorrespondenciaBtsDto {
  @IsIn(['aeropuertos', 'operadores']) tipo!: 'aeropuertos' | 'operadores';
  @Matches(/^\d{1,12}$/) identificador!: string;
  @IsUUID() entidadId!: string;
}
export class EjecucionBtsParams {
  @IsUUID() id!: string;
}

export class ConsultaDescartesBtsDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) intento?: number;
}
