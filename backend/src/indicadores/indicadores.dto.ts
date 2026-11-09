import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
export const EUROCONTROL_PRODUCTS = ['network', 'stakeholder'] as const;
export type EurocontrolProduct = (typeof EUROCONTROL_PRODUCTS)[number];
export class ProductoEurocontrolDto {
  @ApiProperty({ enum: EUROCONTROL_PRODUCTS })
  @IsIn(EUROCONTROL_PRODUCTS)
  producto!: EurocontrolProduct;
}
export class ProgramacionEurocontrolDto {
  @ApiProperty({
    description: 'Pausa la carga mensual UTC (día 1 a las 04:00)',
  })
  @IsBoolean()
  pausado!: boolean;
}
export class ConsultaIndicadoresDto {
  @ApiPropertyOptional({ enum: EUROCONTROL_PRODUCTS })
  @IsOptional()
  @IsIn(EUROCONTROL_PRODUCTS)
  producto?: EurocontrolProduct;
  @ApiPropertyOptional({ enum: ['NETWORK', 'COUNTRY', 'AIRPORT'] })
  @IsOptional()
  @IsIn(['NETWORK', 'COUNTRY', 'AIRPORT'])
  ambito?: string;
  @ApiPropertyOptional({ enum: ['DY', 'WK', 'Y2D'] })
  @IsOptional()
  @IsIn(['DY', 'WK', 'Y2D'])
  granularidad?: string;
  @ApiPropertyOptional({
    description: 'Código/nombre exacto nativo de la entidad',
  })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  entidad?: string;
  @ApiPropertyOptional({ example: '2026-08' })
  @IsOptional()
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/)
  mes?: string;
  @ApiPropertyOptional({
    description:
      'Snapshot histórico; por defecto último publicado por producto',
  })
  @IsOptional()
  @IsUUID('4')
  instantaneaId?: string;
  @ApiPropertyOptional({ default: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000000)
  pagina = 1;
  @ApiPropertyOptional({ default: 20, maximum: 100 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limite = 20;
}
