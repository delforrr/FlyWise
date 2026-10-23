import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsOptional,
  IsString,
  MinLength,
  IsInt,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';

export class SearchAirportsDto {
  @ApiProperty({
    description:
      'Término de búsqueda (código IATA de 3 letras, ICAO de 4 letras, nombre o ciudad)',
    example: 'EZE',
  })
  @IsString()
  @MinLength(2, {
    message: 'El término de búsqueda debe tener al menos 2 caracteres',
  })
  q!: string;

  @ApiPropertyOptional({
    description: 'Cantidad máxima de resultados a retornar',
    default: 20,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 20;
}
