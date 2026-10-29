import { ApiProperty, ApiSchema } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Length } from 'class-validator';

@ApiSchema({
  name: 'ConsultarEnlace',
  description: 'Códigos de los puntos inicial y final.',
})
export class QueryDirectRouteDto {
  @ApiProperty({
    description: 'Código iata del punto inicial',
    example: 'EZE',
  })
  @IsString()
  @IsNotEmpty()
  @Length(3, 4)
  origin!: string;

  @ApiProperty({
    description: 'Código iata del punto final',
    example: 'MIA',
  })
  @IsString()
  @IsNotEmpty()
  @Length(3, 4)
  destination!: string;
}
