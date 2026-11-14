import { Matches } from 'class-validator';
import { ParRutaDto } from './consulta-mapa.dto.js';

export class ContextoRutaDto extends ParRutaDto {
  @Matches(/^(?!0000)\d{4}-(0[1-9]|1[0-2])$/)
  periodo!: string;
}
