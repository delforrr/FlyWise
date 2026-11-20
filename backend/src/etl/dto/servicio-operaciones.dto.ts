import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
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
  ValidateNested,
} from 'class-validator';
import { PoblacionBtsDto } from '../../bts/bts.dto.js';

export class TramoServicioDto {
  @IsUUID() origenId!: string;
  @IsUUID() destinoId!: string;
}

export class ServicioOperacionesDto {
  @IsString() @Length(1, 120) nombre!: string;
  @IsIn(['OAG', 'BTS']) proveedor!: 'OAG' | 'BTS';
  @Matches(/^(?!0000)\d{4}-(0[1-9]|1[0-2])$/) periodo!: string;
  @IsOptional() @IsBoolean() pausado?: boolean;
  @IsOptional() @IsUUID() origenId?: string;
  @IsOptional() @IsUUID() destinoId?: string;
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => TramoServicioDto)
  tramos?: TramoServicioDto[];
  @IsOptional() @IsInt() @Min(1) @Max(100) coberturaMinimaPct?: number;
}

export class EjecutarServicioDto {
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(1000)
  @ValidateNested({ each: true })
  @Type(() => PoblacionBtsDto)
  autorizarCambioFuente?: PoblacionBtsDto[];
}
