import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsDefined,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
} from 'class-validator';

export class CrearAerolineaDto {
  @IsDefined()
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @ApiProperty()
  nombre!: string;

  @IsOptional()
  @IsUUID()
  @ApiPropertyOptional({ nullable: true, type: String })
  paisId?: string | null;

  @IsOptional()
  @Matches(/^[A-Z0-9]{2}$/)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toUpperCase() || null : value,
  )
  @ApiPropertyOptional({ nullable: true, type: String })
  iata?: string | null;

  @IsOptional()
  @Matches(/^[A-Z0-9]{3}$/)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toUpperCase() || null : value,
  )
  @ApiPropertyOptional({ nullable: true, type: String })
  icao?: string | null;

  @IsOptional()
  @IsBoolean()
  @ApiPropertyOptional({ nullable: true, type: Boolean })
  activa?: boolean | null;
}

export class EditarAerolineaDto extends PartialType(CrearAerolineaDto, {
  skipNullProperties: false,
}) {
  @IsOptional()
  @IsBoolean()
  @ApiPropertyOptional()
  protegidoManualmente?: boolean;
}
