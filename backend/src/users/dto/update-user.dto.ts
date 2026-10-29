import { PartialType, ApiSchema } from '@nestjs/swagger';
import { CreateUserDto } from './create-user.dto.js';

@ApiSchema({
  name: 'ActualizarUsuario',
  description: 'Campos opcionales del usuario.',
})
export class UpdateUserDto extends PartialType(CreateUserDto) {}
