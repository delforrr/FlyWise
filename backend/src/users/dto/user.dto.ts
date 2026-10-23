import { ApiProperty } from '@nestjs/swagger';

export class UserDto {
  @ApiProperty({
    example: 'd3b07384-d113-4a69-8d7b-9907f7b3b9b9',
    description: 'Identificador único del usuario (UUID)',
  })
  id!: string;

  @ApiProperty({
    example: 'admin@flywise.com',
    description: 'Correo electrónico del usuario',
  })
  email!: string;

  @ApiProperty({
    enum: ['ADMIN', 'OPERATOR'],
    example: 'ADMIN',
    description: 'Rol del usuario en la plataforma',
  })
  role?: 'ADMIN' | 'OPERATOR';

  @ApiProperty({
    example: '2026-10-16T20:00:00.000Z',
    description: 'Fecha de creación de la cuenta',
  })
  createdAt?: Date;
}
