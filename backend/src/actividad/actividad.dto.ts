import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  Max,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class PeriodoAnacDto {
  @ApiProperty({
    example: '2026-08',
    description: 'Mes observado UTC, sin backfill automático',
  })
  @Matches(/^(19|20)\d{2}-(0[1-9]|1[0-2])$/)
  periodo!: string;
}
export class ConsultaActividadDto extends PeriodoAnacDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(1, 30)
  aeropuerto?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(1, 200)
  operador?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(1, 100)
  clasificacion?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(1, 100)
  calidad?: string;
  @ApiPropertyOptional({ enum: ['DESPEGUE', 'ATERRIZAJE'] })
  @IsOptional()
  @IsIn(['DESPEGUE', 'ATERRIZAJE'])
  movimiento?: string;
  @ApiPropertyOptional({ default: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100000)
  pagina = 1;
  @ApiPropertyOptional({ default: 20, maximum: 100 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limite = 20;
}
export class ConfiguracionAnacDto {
  @ApiProperty({
    description:
      'Ficha oficial del recurso anual; se resuelve el enlace CSV en cada carga',
  })
  @IsString()
  @Length(1, 1000)
  fichaUrl!: string;
  @ApiProperty({
    example: '0 5 20 * *',
    description: 'Programación mensual en UTC',
  })
  @Matches(/^([0-5]?\d) ([01]?\d|2[0-3]) ([1-9]|[12]\d|3[01]) \* \*$/)
  expresionCron!: string;
  @ApiProperty() @IsBoolean() pausado!: boolean;
}
export class CorrespondenciaAnacDto {
  @ApiProperty({
    description: 'Código ANAC FAA/OACI; nunca se equipara a IATA por similitud',
  })
  @IsString()
  @Matches(/^[A-Z0-9-]{1,30}$/)
  codigo!: string;
  @ApiProperty() @IsUUID() aeropuertoId!: string;
}
