import {
  ApiProperty,
  ApiPropertyOptional,
  PartialType,
  ApiSchema,
} from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDefined,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export const CATALOG_TARGETS = [
  'countries',
  'airports',
  'airlines',
  'routes',
] as const;
export type CatalogTarget = (typeof CATALOG_TARGETS)[number];

@ApiSchema({
  name: 'CabeceraDeCarga',
  description: 'Nombre y referencia de credencial autorizada.',
})
export class PipelineHeaderDto {
  @IsString()
  @Length(1, 100)
  @ApiProperty({
    description: 'Nombre de cabecera',
    minLength: 1,
    maxLength: 100,
  })
  key!: string;
  @IsString()
  @Matches(/^[A-Za-z_][A-Za-z0-9_]*$/)
  @MaxLength(100)
  @ApiProperty({
    description:
      'Referencia de credencial autorizada; no admite secretos literales',
    maxLength: 100,
  })
  credentialRef!: string;
}

@ApiSchema({
  name: 'ConexionDeCarga',
  description: 'Parámetros de lectura del archivo.',
})
export class PipelineConnectionDto {
  @ApiProperty({ description: 'Tipo de conexión', enum: ['http_stream'] })
  @IsIn(['http_stream'])
  sourceType!: 'http_stream';
  @ApiProperty({
    description:
      'URL HTTPS autorizada, sin credenciales, consulta ni fragmento',
    maxLength: 2048,
  })
  @IsString()
  @Length(1, 2048)
  endpointUrl!: string;
  @ApiProperty({ description: 'Método de lectura', enum: ['GET'] })
  @IsIn(['GET'])
  httpMethod!: 'GET';
  @ApiProperty({ description: 'Formato de entrada', enum: ['csv'] })
  @IsIn(['csv'])
  dataFormat!: 'csv';
  @ApiPropertyOptional({
    description: 'Separador de columnas',
    minLength: 1,
    maxLength: 1,
  })
  @IsOptional()
  @IsString()
  @Length(1, 1)
  csvDelimiter?: string;
  @ApiPropertyOptional({
    description: 'Indica si la primera fila contiene nombres de columnas',
  })
  @IsOptional()
  @IsBoolean()
  csvHasHeader?: boolean;
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => PipelineHeaderDto)
  @ApiPropertyOptional({
    description: 'Cabeceras con referencias autorizadas',
    type: () => [PipelineHeaderDto],
    maxItems: 20,
  })
  headers?: PipelineHeaderDto[];
}

@ApiSchema({
  name: 'CorrespondenciaDeCampo',
  description: 'Columna de entrada y campo de destino.',
})
export class FieldMappingDto {
  @ApiProperty({
    description: 'Columna de entrada; sin cabecera, posición desde 0',
    minLength: 1,
    maxLength: 128,
  })
  @IsString()
  @Length(1, 128)
  sourceColumn!: string;
  @ApiProperty({
    description: 'Campo admitido por el destino; no puede repetirse',
    minLength: 1,
    maxLength: 100,
  })
  @IsString()
  @Length(1, 100)
  targetField!: string;
  @IsOptional()
  @IsIn(['none', 'trim', 'uppercase', 'to_number', 'to_boolean'])
  @ApiPropertyOptional({
    description: 'Conversión del valor',
    enum: ['none', 'trim', 'uppercase', 'to_number', 'to_boolean'],
  })
  transform?: 'none' | 'trim' | 'uppercase' | 'to_number' | 'to_boolean';
  @ApiPropertyOptional({ description: 'Rechaza la fila si falta el valor' })
  @IsOptional()
  @IsBoolean()
  required?: boolean;
}

@ApiSchema({
  name: 'ProgramacionDeCarga',
  description: 'Programación y límites de ejecución.',
})
export class PipelineScheduleDto {
  @ApiProperty({
    description: 'Programación en UTC; vacío para ejecución manual',
    maxLength: 100,
  })
  @IsString()
  @MaxLength(100)
  cronExpression!: string;
  @ApiProperty({ description: 'Filas por lote', minimum: 1000, maximum: 5000 })
  @IsInt()
  @Min(1000)
  @Max(5000)
  batchSize!: number;
  @ApiProperty({
    description: 'Tiempo máximo de lectura en segundos',
    minimum: 1,
    maximum: 3600,
  })
  @IsInt()
  @Min(1)
  @Max(3600)
  timeoutSeconds!: number;
  @ApiProperty({
    description: 'Reintentos permitidos',
    minimum: 0,
    maximum: 10,
  })
  @IsInt()
  @Min(0)
  @Max(10)
  maxRetries!: number;
}

@ApiSchema({
  name: 'CrearCarga',
  description: 'Configuración de una carga de datos.',
})
export class CreatePipelineDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @Length(1, 120)
  @ApiProperty({
    description: 'Nombre de la configuración',
    minLength: 1,
    maxLength: 120,
  })
  name!: string;
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @Length(1, 120)
  @ApiProperty({
    description: 'Nombre del conjunto de datos',
    minLength: 1,
    maxLength: 120,
  })
  datasetName!: string;
  @ApiPropertyOptional({
    description: 'Descripción de la configuración',
    maxLength: 1000,
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;
  @ApiProperty({
    description: 'Destino de los registros',
    enum: CATALOG_TARGETS,
  })
  @IsIn(CATALOG_TARGETS)
  targetEntity!: CatalogTarget;
  @ApiPropertyOptional({ description: 'Impide iniciar nuevas ejecuciones' })
  @IsOptional()
  @IsBoolean()
  paused?: boolean;
  @IsDefined()
  @ValidateNested()
  @Type(() => PipelineConnectionDto)
  @ApiProperty({
    description: 'Parámetros de conexión',
    type: () => PipelineConnectionDto,
  })
  connection!: PipelineConnectionDto;
  @IsDefined()
  @IsArray()
  @ArrayMaxSize(40)
  @ValidateNested({ each: true })
  @Type(() => FieldMappingDto)
  @ApiProperty({
    description: 'Correspondencias de columnas y campos',
    type: () => [FieldMappingDto],
    maxItems: 40,
  })
  schemaMapping!: FieldMappingDto[];
  @IsDefined()
  @ValidateNested()
  @Type(() => PipelineScheduleDto)
  @ApiProperty({
    description: 'Programación y límites de lectura',
    type: () => PipelineScheduleDto,
  })
  scheduleConfig!: PipelineScheduleDto;
}

@ApiSchema({
  name: 'ActualizarCarga',
  description: 'Cambios opcionales de una configuración.',
})
export class UpdatePipelineDto extends PartialType(CreatePipelineDto) {}

export const CATALOG_FIELDS: Record<CatalogTarget, readonly string[]> = {
  countries: ['name', 'isoCode'],
  airports: [
    'openflightsId',
    'name',
    'city',
    'countryName',
    'iata',
    'icao',
    'latitude',
    'longitude',
    'source',
  ],
  airlines: ['openflightsId', 'name', 'iata', 'icao', 'country', 'active'],
  routes: [
    'airlineCode',
    'airlineOpenflightsId',
    'originOpenflightsId',
    'originCode',
    'destinationOpenflightsId',
    'destinationCode',
    'codeshare',
    'stops',
  ],
};
