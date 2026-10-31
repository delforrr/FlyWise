import { OmitType, ApiSchema } from '@nestjs/swagger';
import { CreateUserDto } from '../../users/dto/create-user.dto.js';

@ApiSchema({
  name: 'RegistrarUsuario',
  description: 'Datos de registro; el rol asignado es OPERATOR.',
})
export class RegisterUserDto extends OmitType(CreateUserDto, [
  'rol',
] as const) {}
