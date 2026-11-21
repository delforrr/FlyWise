import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  ArrayMinSize,
  ValidateNested,
  IsUUID,
  Matches,
  Max,
  Min,
} from 'class-validator';

class TramoOagDto {
  @IsUUID() origenId!: string;
  @IsUUID() destinoId!: string;
}

export class ConfiguracionOagDto {
  @IsBoolean() pausado!: boolean;
  @ApiPropertyOptional({
    description:
      'Cron mensual UTC para el último mes cerrado. Vacío deshabilita la programación.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  expresionCron?: string;
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => TramoOagDto)
  tramos?: TramoOagDto[];
  @IsOptional() @IsUUID() origenId?: string;
  @IsOptional() @IsUUID() destinoId?: string;
  @Matches(/^(?!0000)\d{4}-(0[1-9]|1[0-2])$/)
  periodo!: string;
  @IsInt() @Min(1) @Max(100) coberturaMinimaPct!: number;
}

export class EjecutarOagDto {
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(1000)
  @ArrayUnique()
  @IsUUID(undefined, { each: true })
  autorizarCambioFuente?: string[];
}
