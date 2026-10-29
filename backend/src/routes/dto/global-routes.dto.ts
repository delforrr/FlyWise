import { ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsUUID, ValidateIf } from 'class-validator';
import { CONTINENTS, type Continent } from '../../countries/continents.js';

@ApiSchema({
  name: 'ListarPares',
  description: 'Filtros de agrupaciones y cantidad de pares.',
})
export class GlobalRoutesDto {
  @IsIn(['global', 'domestic', 'countries', 'continents'])
  @ApiPropertyOptional({
    description:
      'global: todos; domestic: una agrupación; countries: dos agrupaciones; continents: dos conjuntos',
    enum: ['global', 'domestic', 'countries', 'continents'],
    default: 'global',
  })
  mode: 'global' | 'domestic' | 'countries' | 'continents' = 'global';

  @Type(() => Number)
  @IsInt()
  @IsIn([10, 20, 50, 100])
  @ApiPropertyOptional({
    description: 'Cantidad de pares',
    enum: [10, 20, 50, 100],
    default: 50,
  })
  limit: number = 50;

  @ValidateIf(
    (dto: GlobalRoutesDto) =>
      dto.mode === 'domestic' ||
      dto.mode === 'countries' ||
      dto.originCountryId !== undefined,
  )
  @ApiPropertyOptional({
    description:
      'UUID de agrupación inicial; obligatorio con domestic o countries',
    format: 'uuid',
  })
  @IsUUID()
  originCountryId?: string;

  @ValidateIf(
    (dto: GlobalRoutesDto) =>
      dto.mode === 'countries' || dto.destinationCountryId !== undefined,
  )
  @ApiPropertyOptional({
    description:
      'UUID de agrupación final, distinto del inicial; obligatorio con countries',
    format: 'uuid',
  })
  @IsUUID()
  destinationCountryId?: string;

  @ValidateIf(
    (dto: GlobalRoutesDto) =>
      dto.mode === 'continents' || dto.originContinent !== undefined,
  )
  @ApiPropertyOptional({
    description: 'Conjunto inicial; obligatorio con continents',
    enum: CONTINENTS,
  })
  @IsIn(CONTINENTS)
  originContinent?: Continent;

  @ValidateIf(
    (dto: GlobalRoutesDto) =>
      dto.mode === 'continents' || dto.destinationContinent !== undefined,
  )
  @ApiPropertyOptional({
    description:
      'Conjunto final, distinto del inicial; obligatorio con continents',
    enum: CONTINENTS,
  })
  @IsIn(CONTINENTS)
  destinationContinent?: Continent;
}
