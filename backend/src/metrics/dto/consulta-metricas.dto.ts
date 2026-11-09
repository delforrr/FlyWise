import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsUUID, Matches, Max, Min } from 'class-validator';

export class ConsultaMetricasDto {
  @ApiProperty({ example: '2026-01' })
  @Matches(/^(?!0000)\d{4}-(0[1-9]|1[0-2])$/)
  periodo!: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() origenId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() destinoId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() aerolineaId?: string;
  @ApiPropertyOptional({ default: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pagina = 1;
  @ApiPropertyOptional({ default: 20, maximum: 100 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limite = 20;
}
