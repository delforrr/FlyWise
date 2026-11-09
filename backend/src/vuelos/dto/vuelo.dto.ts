import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class OperacionDto {
  @ApiProperty({ example: '2026-01-15' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  fechaVuelo!: string;
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(30)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  numeroVuelo!: string;
  @ApiProperty() @IsUUID() origenId!: string;
  @ApiProperty() @IsUUID() destinoId!: string;
  @ApiProperty() @IsUUID() aerolineaId!: string;
  @ApiProperty({ enum: ['ARRIVED', 'CANCELLED', 'DIVERTED'] })
  @IsIn(['ARRIVED', 'CANCELLED', 'DIVERTED'])
  estado!: 'ARRIVED' | 'CANCELLED' | 'DIVERTED';
  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsInt()
  @Min(-2147483648)
  @Max(2147483647)
  demoraLlegadaMinutos?: number | null;
}
export class VersionVueloDto {
  @ApiProperty({ minimum: 1 })
  @IsInt()
  @Min(1)
  @Max(2147483646)
  version!: number;
}
export class EditarVueloDto extends PartialType(OperacionDto, {
  skipNullProperties: false,
}) {
  @ApiProperty({ minimum: 1 })
  @IsInt()
  @Min(1)
  @Max(2147483646)
  version!: number;
}
export class ConsultaVuelosDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Matches(/^(?!0000)\d{4}-(0[1-9]|1[0-2])$/)
  periodo?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() origenId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() destinoId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() aerolineaId?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsIn(['ARRIVED', 'CANCELLED', 'DIVERTED'])
  resultado?: 'ARRIVED' | 'CANCELLED' | 'DIVERTED';
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  fuente?: string;
  @ApiPropertyOptional({ default: 'vigentes' })
  @IsIn(['vigentes', 'archivados', 'todos'])
  archivo: 'vigentes' | 'archivados' | 'todos' = 'vigentes';
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
