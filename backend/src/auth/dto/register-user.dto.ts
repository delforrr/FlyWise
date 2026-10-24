import { OmitType } from '@nestjs/swagger';
import { CreateUserDto } from '../../users/dto/create-user.dto.js';

export class RegisterUserDto extends OmitType(CreateUserDto, [
  'role',
] as const) {}
