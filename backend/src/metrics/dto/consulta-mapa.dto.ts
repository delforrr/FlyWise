import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsObject,
  IsOptional,
  IsUUID,
  Matches,
  ValidateNested,
} from 'class-validator';

export const MAX_PARES_MAPA = 100;

export class ParRutaDto {
  @ApiProperty() @IsUUID() origenId!: string;
  @ApiProperty() @IsUUID() destinoId!: string;
}

export class ConsultaMapaDto {
  @ApiProperty({ example: '2026-08' })
  @Matches(/^(?!0000)\d{4}-(0[1-9]|1[0-2])$/)
  periodo!: string;

  @ApiPropertyOptional() @IsOptional() @IsUUID() aerolineaId?: string;

  @ApiProperty({ type: [ParRutaDto], maxItems: MAX_PARES_MAPA })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_PARES_MAPA)
  @IsObject({ each: true })
  @ValidateNested({ each: true })
  @Type(() => ParRutaDto)
  pares!: ParRutaDto[];
}
