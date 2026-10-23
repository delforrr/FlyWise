import { ApiProperty } from '@nestjs/swagger';
import {
  IsAlphanumeric,
  IsEmail,
  IsNotEmpty,
  MinLength,
} from 'class-validator';

export class LoginRequestDto {
  @ApiProperty()
  @IsEmail({}, { message: 'Debe tener formato de email' })
  @IsNotEmpty({ message: 'El email no debe estár vacío' })
  email!: string;

  @ApiProperty()
  @MinLength(8, { message: 'La contraseña debe ser mayor a 8 caracteres' })
  @IsNotEmpty({ message: 'La contraseña no debe estar vacia' })
  @IsAlphanumeric()
  password!: string;
}
