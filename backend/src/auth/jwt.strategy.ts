import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET') ?? 'default_secret',
    });
  }

  validate(payload: {
    sub: string;
    email: string;
    role?: 'ADMIN' | 'OPERATOR';
  }) {
    return {
      id: payload.sub,
      email: payload.email,
      role: payload.role ?? 'OPERATOR',
    };
  }
}
