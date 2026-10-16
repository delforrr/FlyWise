import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class ExploreRoutesDto {
  @ApiPropertyOptional({
    description:
      'Código IATA de aeropuerto de origen para activar la exploración bajo demanda (modo Estrella)',
    example: 'EZE',
  })
  @IsOptional()
  @IsString()
  origin?: string;

  @ApiPropertyOptional({
    description:
      'Código IATA de aerolínea para filtrar únicamente su red comercial',
    example: 'AR',
  })
  @IsOptional()
  @IsString()
  airline?: string;

  @ApiPropertyOptional({
    description: 'Cantidad máxima de rutas a retornar (por defecto 100)',
    default: 100,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  limit: number = 100;
}
