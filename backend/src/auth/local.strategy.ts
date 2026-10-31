import { Strategy } from 'passport-local';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service.js';
import type { UserDto } from '../users/dto/user.dto.js';

@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy) {
  constructor(private authService: AuthService) {
    super({ usernameField: 'correo' });
  }

  async validate(correo: string, password: string): Promise<UserDto> {
    const user = await this.authService.validateUser(correo, password);
    if (!user) {
      throw new UnauthorizedException();
    }
    return user;
  }
}
