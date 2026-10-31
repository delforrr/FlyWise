import { ApiProperty, ApiSchema } from '@nestjs/swagger';
import { IsString, Matches } from 'class-validator';
import { Transform } from 'class-transformer';

@ApiSchema({
  name: 'ConsultarEnlace',
  description: 'Códigos de los puntos inicial y final.',
})
export class QueryDirectRouteDto {
  @ApiProperty({
    description: 'Código IATA o ICAO del aeropuerto de origen',
    example: 'EZE',
  })
  @IsString()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @Matches(/^(?:[A-Z]{3}|[A-Z0-9]{4})$/)
  origen!: string;

  @ApiProperty({
    description: 'Código IATA o ICAO del aeropuerto de destino',
    example: 'MIA',
  })
  @IsString()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @Matches(/^(?:[A-Z]{3}|[A-Z0-9]{4})$/)
  destino!: string;
}
