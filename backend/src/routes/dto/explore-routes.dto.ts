import { ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';
import { IsOptional, IsUUID, IsString, IsInt, Min, Max } from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { IsBoolean } from 'class-validator';

@ApiSchema({
  name: 'ListarEnlaces',
  description: 'Filtros de extremos, entidad y cantidad de enlaces.',
})
export class ExploreRoutesDto {
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    value === 'true' ? true : value === 'false' ? false : value,
  )
  @IsBoolean()
  @ApiPropertyOptional({
    description: 'Incluye ambos sentidos, exige ambos UUID y no aplica limit',
    type: Boolean,
  })
  incluirRegreso?: boolean;
  @ApiPropertyOptional({
    description: 'UUID del punto inicial',
    format: 'uuid',
  })
  @IsOptional()
  @IsUUID()
  origenId?: string;
  @ApiPropertyOptional({ description: 'UUID del punto final', format: 'uuid' })
  @IsOptional()
  @IsUUID()
  destinoId?: string;

  @ApiPropertyOptional({
    description: 'Código iata de cualquiera de los extremos',
    example: 'EZE',
  })
  @IsOptional()
  @IsString()
  origen?: string;

  @ApiPropertyOptional({
    description: 'Código de la entidad asociada',
    example: 'AR',
  })
  @IsOptional()
  @IsString()
  aerolinea?: string;

  @ApiPropertyOptional({
    description: 'Máximo de enlaces; de 1 a 500',
    default: 100,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  limit?: number = 100;
}
