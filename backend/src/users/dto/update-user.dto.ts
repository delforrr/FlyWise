import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength, IsOptional, IsEmail } from 'class-validator';

export class UpdateUserDto {
  @ApiProperty()
  @IsString()
  @MinLength(3, { message: 'El mail debe tener mas de 3 caracteres' })
  @IsOptional()
  @IsEmail()
  email!: string;

  @ApiProperty()
  @IsString()
  @MinLength(8, { message: 'La contraseña debe ser mayor a 8 caracteres' })
  @IsOptional()
  password!: string;
}
