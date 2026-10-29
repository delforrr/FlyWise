import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';
import { IsNumber, Min, Max, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';

@ApiSchema({
  name: 'BuscarPuntosCercanos',
  description: 'Coordenadas y radio de búsqueda.',
})
export class NearbyAirportsDto {
  @ApiProperty({
    description: 'Latitud geográfica WGS 84 (-90 a 90)',
    example: -34.8222,
  })
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  lat!: number;

  @ApiProperty({
    description: 'Longitud geográfica WGS 84 (-180 a 180)',
    example: -58.5358,
  })
  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  lng!: number;

  @ApiPropertyOptional({
    description: 'Radio de búsqueda en kilómetros',
    default: 100,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(2000)
  radiusKm: number = 100;
}
