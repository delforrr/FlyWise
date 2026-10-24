import { PartialType } from '@nestjs/swagger';
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

export class PipelineHeaderDto {
  @IsString()
  @Length(1, 100)
  key!: string;
  @IsString()
  @Matches(/^[A-Za-z_][A-Za-z0-9_]*$/)
  @MaxLength(100)
  credentialRef!: string;
}

export class PipelineConnectionDto {
  @IsIn(['http_stream']) sourceType!: 'http_stream';
  @IsString() @Length(1, 2048) endpointUrl!: string;
  @IsIn(['GET']) httpMethod!: 'GET';
  @IsIn(['csv']) dataFormat!: 'csv';
  @IsOptional() @IsString() @Length(1, 1) csvDelimiter?: string;
  @IsOptional() @IsBoolean() csvHasHeader?: boolean;
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => PipelineHeaderDto)
  headers?: PipelineHeaderDto[];
}

export class FieldMappingDto {
  @IsString() @Length(1, 128) sourceColumn!: string;
  @IsString() @Length(1, 100) targetField!: string;
  @IsOptional()
  @IsIn(['none', 'trim', 'uppercase', 'to_number', 'to_boolean'])
  transform?: 'none' | 'trim' | 'uppercase' | 'to_number' | 'to_boolean';
  @IsOptional() @IsBoolean() required?: boolean;
}

export class PipelineScheduleDto {
  @IsString() @MaxLength(100) cronExpression!: string;
  @IsInt() @Min(1000) @Max(5000) batchSize!: number;
  @IsInt() @Min(1) @Max(3600) timeoutSeconds!: number;
  @IsInt() @Min(0) @Max(10) maxRetries!: number;
}

export class CreatePipelineDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @Length(1, 120)
  name!: string;
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @Length(1, 120)
  datasetName!: string;
  @IsOptional() @IsString() @MaxLength(1000) description?: string;
  @IsIn(CATALOG_TARGETS) targetEntity!: CatalogTarget;
  @IsOptional() @IsBoolean() paused?: boolean;
  @IsDefined()
  @ValidateNested()
  @Type(() => PipelineConnectionDto)
  connection!: PipelineConnectionDto;
  @IsDefined()
  @IsArray()
  @ArrayMaxSize(40)
  @ValidateNested({ each: true })
  @Type(() => FieldMappingDto)
  schemaMapping!: FieldMappingDto[];
  @IsDefined()
  @ValidateNested()
  @Type(() => PipelineScheduleDto)
  scheduleConfig!: PipelineScheduleDto;
}

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
