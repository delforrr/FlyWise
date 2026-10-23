import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Length } from 'class-validator';

export class QueryDirectRouteDto {
  @ApiProperty({
    description: 'Código IATA del aeropuerto de origen',
    example: 'EZE',
  })
  @IsString()
  @IsNotEmpty()
  @Length(3, 4)
  origin!: string;

  @ApiProperty({
    description: 'Código IATA del aeropuerto de destino',
    example: 'MIA',
  })
  @IsString()
  @IsNotEmpty()
  @Length(3, 4)
  destination!: string;
}
