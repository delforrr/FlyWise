import { Type } from 'class-transformer';
import { IsInt, IsOptional, Min } from 'class-validator';

export class SampleQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  intento?: number;
}
