import { ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, Max, Min } from 'class-validator';
@ApiSchema({
  name: 'ListarPuntos',
  description: 'Límite y desplazamiento del listado.',
})
export class CatalogAirportsDto {
  @ApiPropertyOptional({
    description: 'Cantidad de puntos',
    minimum: 1,
    maximum: 1000,
    default: 1000,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000)
  limit = 1000;
  @ApiPropertyOptional({
    description: 'Cantidad de puntos que se omiten',
    minimum: 0,
    maximum: 1000000,
    default: 0,
  })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(1000000)
  offset = 0;
}
