import { ApiProperty, ApiSchema } from '@nestjs/swagger';
import { IsIn } from 'class-validator';

export const ETL_DATASETS: readonly string[] = [
  'all',
  'paises',
  'aeropuertos',
  'aerolineas',
  'rutas',
];

@ApiSchema({
  name: 'SolicitarCarga',
  description: 'Conjunto de datos que se actualizará.',
})
export class TriggerEtlDto {
  @ApiProperty({ enum: ETL_DATASETS })
  @IsIn(ETL_DATASETS)
  dataset!: string;
}
