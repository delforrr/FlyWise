import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsByteLength,
  IsString,
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsOptional,
  MinLength,
} from 'class-validator';

@ApiSchema({
  name: 'CrearUsuario',
  description: 'Datos para crear un usuario.',
})
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
    description: 'Contraseña (mínimo 8 caracteres, máximo 72 bytes UTF-8)',
  })
  @MinLength(8, { message: 'La contraseña debe tener al menos 8 caracteres' })
  @IsNotEmpty({ message: 'La contraseña no debe estar vacia' })
  @IsString()
  @IsByteLength(0, 72, { message: 'La contraseña no debe superar 72 bytes' })
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
