import { IsBoolean, IsOptional } from 'class-validator';
import { PickType, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';
import { CreateUserDto } from '../../users/dto/create-user.dto.js';

@ApiSchema({
  name: 'IniciarSesion',
  description: 'Credenciales y preferencia de duración de sesión.',
})
export class LoginRequestDto extends PickType(CreateUserDto, [
  'email',
  'password',
] as const) {
  @IsOptional()
  @IsBoolean()
  @ApiPropertyOptional({
    description: 'Mantiene la sesión hasta 7 días; sin marcar, hasta 24 horas',
    default: false,
  })
  remember?: boolean;
}
