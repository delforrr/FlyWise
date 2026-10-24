import { Type } from 'class-transformer';
import { IsInt, Max, Min } from 'class-validator';
export class CatalogAirportsDto {
  @Type(() => Number) @IsInt() @Min(1) @Max(1000) limit = 1000;
  @Type(() => Number) @IsInt() @Min(0) @Max(1000000) offset = 0;
}
