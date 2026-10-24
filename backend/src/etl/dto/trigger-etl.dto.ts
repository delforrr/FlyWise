import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';

export const ETL_DATASETS: readonly string[] = [
  'all',
  'countries',
  'airports',
  'airlines',
  'routes',
];

export class TriggerEtlDto {
  @ApiProperty({ enum: ETL_DATASETS })
  @IsIn(ETL_DATASETS)
  dataset!: string;
}
