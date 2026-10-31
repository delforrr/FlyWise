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
  @Matches(/^[A-Z0-9]{2,3}$/)
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
  @Min(0)
  @Max(2147483647)
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
