import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsDefined,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CrearAeropuertoDto {
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
  @IsString()
  @MaxLength(255)
  @ApiPropertyOptional({ nullable: true, type: String })
  ciudad?: string | null;

  @IsDefined()
  @IsUUID()
  @ApiProperty()
  paisId!: string;

  @IsOptional()
  @Matches(/^[A-Z]{3}$/)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toUpperCase() || null : value,
  )
  @ApiPropertyOptional({ nullable: true, type: String })
  iata?: string | null;

  @IsOptional()
  @Matches(/^[A-Z0-9]{4}$/)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toUpperCase() || null : value,
  )
  @ApiPropertyOptional({ nullable: true, type: String })
  icao?: string | null;

  @IsDefined()
  @IsNumber()
  @Min(-90)
  @Max(90)
  @ApiProperty()
  latitud!: number;

  @IsDefined()
  @IsNumber()
  @Min(-180)
  @Max(180)
  @ApiProperty()
  longitud!: number;
}

export class EditarAeropuertoDto extends PartialType(CrearAeropuertoDto, {
  skipNullProperties: false,
}) {
  @IsOptional()
  @IsBoolean()
  @ApiPropertyOptional()
  protegidoManualmente?: boolean;
}
