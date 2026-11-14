import {
  CODIGO_OPERADORA_RUTA,
  MAX_ESCALAS,
  MIN_ESCALAS,
} from '../../entities/rutas/domain/ruta.js';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsDefined,
  IsInt,
  IsOptional,
  IsUUID,
  Matches,
  Max,
  Min,
  ValidateIf,
} from 'class-validator';

export class CrearRutaDto {
  @ApiProperty()
  @IsDefined()
  @IsUUID()
  origenId!: string;
  @ApiProperty()
  @IsDefined()
  @IsUUID()
  destinoId!: string;
}

export class EditarRutaDto extends PartialType(CrearRutaDto, {
  skipNullProperties: false,
}) {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  protegidoManualmente?: boolean;
}

export class CrearOfertaRutaDto {
  @ApiPropertyOptional({ nullable: true, type: String })
  @IsOptional()
  @IsUUID()
  aerolineaId?: string | null;

  @IsOptional()
  @Matches(CODIGO_OPERADORA_RUTA)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toUpperCase() || null : value,
  )
  @ApiPropertyOptional({ nullable: true, type: String })
  codigoAerolinea?: string | null;

  @ValidateIf((_obj, value: unknown) => value !== undefined)
  @IsBoolean()
  @ApiPropertyOptional()
  codigoCompartido?: boolean;

  @ValidateIf((_obj, value: unknown) => value !== undefined)
  @IsInt()
  @Min(MIN_ESCALAS)
  @Max(MAX_ESCALAS)
  @ApiPropertyOptional()
  escalas?: number;
}

export class EditarOfertaRutaDto extends PartialType(CrearOfertaRutaDto, {
  skipNullProperties: false,
}) {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  protegidoManualmente?: boolean;
}
