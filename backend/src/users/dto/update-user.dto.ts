import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsIn, IsOptional, MinLength } from 'class-validator';

export class UpdateUserDto {
  @ApiPropertyOptional({ example: 'nuevo@flywise.com' })
  @IsOptional()
  @IsEmail({}, { message: 'Debe tener formato de email' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  email?: string;

  @ApiPropertyOptional({ example: 'newPassword123', minLength: 8 })
  @IsOptional()
  @MinLength(8, { message: 'La contraseña debe ser mayor a 8 caracteres' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  password?: string;

  @ApiPropertyOptional({ enum: ['ADMIN', 'OPERATOR'] })
  @IsOptional()
  @IsIn(['ADMIN', 'OPERATOR'])
  role?: 'ADMIN' | 'OPERATOR';
}
