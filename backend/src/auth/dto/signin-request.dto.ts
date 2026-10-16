import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsAlphanumeric,
  IsEmail,
  IsNotEmpty,
  MinLength,
} from 'class-validator';

export class SigninRequestDto {
  @ApiProperty()
  @IsEmail({}, { message: 'Debe tener formato de email' })
  @IsNotEmpty({ message: 'El email no debe estár vacío' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  email!: string;

  @ApiProperty()
  @MinLength(8, { message: 'La contraseña debe ser mayor a 8 caracteres' })
  @IsNotEmpty({ message: 'La contraseña no debe estar vacia' })
  @IsAlphanumeric()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  password!: string;
}
