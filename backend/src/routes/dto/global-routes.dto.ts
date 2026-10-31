import { ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsUUID, ValidateIf } from 'class-validator';
import { CONTINENTS, type Continent } from '../../countries/continents.js';

@ApiSchema({
  name: 'ListarPares',
  description: 'Filtros de agrupaciones y cantidad de pares.',
})
export class GlobalRoutesDto {
  @IsIn(['global', 'domestic', 'paises', 'continents'])
  @ApiPropertyOptional({
    description:
      'global: todos; domestic: una agrupación; paises: dos agrupaciones; continents: dos conjuntos',
    enum: ['global', 'domestic', 'paises', 'continents'],
    default: 'global',
  })
  mode: 'global' | 'domestic' | 'paises' | 'continents' = 'global';

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
      dto.mode === 'paises' ||
      dto.paisOrigenId !== undefined,
  )
  @ApiPropertyOptional({
    description:
      'UUID de agrupación inicial; obligatorio con domestic o paises',
    format: 'uuid',
  })
  @IsUUID()
  paisOrigenId?: string;

  @ValidateIf(
    (dto: GlobalRoutesDto) =>
      dto.mode === 'paises' || dto.paisDestinoId !== undefined,
  )
  @ApiPropertyOptional({
    description:
      'UUID de agrupación final, distinto del inicial; obligatorio con paises',
    format: 'uuid',
  })
  @IsUUID()
  paisDestinoId?: string;

  @ValidateIf(
    (dto: GlobalRoutesDto) =>
      dto.mode === 'continents' || dto.continenteOrigen !== undefined,
  )
  @ApiPropertyOptional({
    description: 'Conjunto inicial; obligatorio con continents',
    enum: CONTINENTS,
  })
  @IsIn(CONTINENTS)
  continenteOrigen?: Continent;

  @ValidateIf(
    (dto: GlobalRoutesDto) =>
      dto.mode === 'continents' || dto.continenteDestino !== undefined,
  )
  @ApiPropertyOptional({
    description:
      'Conjunto final, distinto del inicial; obligatorio con continents',
    enum: CONTINENTS,
  })
  @IsIn(CONTINENTS)
  continenteDestino?: Continent;
}
