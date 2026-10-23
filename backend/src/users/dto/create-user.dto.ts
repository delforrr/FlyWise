import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsAlphanumeric,
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsOptional,
  MinLength,
} from 'class-validator';

export class CreateUserDto {
  @ApiProperty({
    example: 'operator@flywise.com',
    description: 'Correo electrónico del usuario',
  })
  @IsEmail({}, { message: 'Debe tener formato de email' })
  @IsNotEmpty({ message: 'El email no debe estár vacío' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  email!: string;

  @ApiProperty({
    example: 'password123',
    description: 'Contraseña (mínimo 8 caracteres alfanuméricos)',
  })
  @MinLength(8, { message: 'La contraseña debe ser mayor a 8 caracteres' })
  @IsNotEmpty({ message: 'La contraseña no debe estar vacia' })
  @IsAlphanumeric()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  password!: string;

  @ApiPropertyOptional({
    enum: ['ADMIN', 'OPERATOR'],
    default: 'OPERATOR',
    description: 'Rol del usuario en la plataforma',
  })
  @IsOptional()
  @IsIn(['ADMIN', 'OPERATOR'])
  role?: 'ADMIN' | 'OPERATOR';
}
