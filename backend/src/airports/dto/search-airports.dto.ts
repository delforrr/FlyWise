import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';
import {
  IsOptional,
  IsString,
  MinLength,
  IsInt,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';

@ApiSchema({
  name: 'BuscarPuntos',
  description: 'Búsqueda por código, nombre o localidad.',
})
export class SearchAirportsDto {
  @ApiProperty({
    description: 'Código, nombre o localidad; mínimo 2 caracteres',
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
