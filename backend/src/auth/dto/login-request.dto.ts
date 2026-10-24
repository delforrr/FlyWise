import { IsBoolean, IsOptional } from 'class-validator';
import { PickType } from '@nestjs/swagger';
import { CreateUserDto } from '../../users/dto/create-user.dto.js';

export class LoginRequestDto extends PickType(CreateUserDto, [
  'email',
  'password',
] as const) {
  @IsOptional()
  @IsBoolean()
  remember?: boolean;
}
