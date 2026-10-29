import { ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';
import { IsOptional, IsString, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

@ApiSchema({
  name: 'ListarEntidades',
  description: 'Búsqueda y paginación de entidades.',
})
export class QueryAirlinesDto {
  @ApiPropertyOptional({
    description: 'Filtro por nombre o código de la entidad',
    example: 'Entidad',
  })
  @IsOptional()
  @IsString()
  q?: string;

  @ApiPropertyOptional({
    description: 'Página de resultados',
    default: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @ApiPropertyOptional({
    description: 'Cantidad de resultados por página',
    default: 20,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 20;
}
