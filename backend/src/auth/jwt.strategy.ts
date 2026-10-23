import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    private readonly authService: AuthService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET') ?? 'default_secret',
      passReqToCallback: true,
    });
  }

  async validate(
    req: { headers?: { authorization?: string } },
    payload: {
      sub: string;
      email: string;
      role?: 'ADMIN' | 'OPERATOR';
    },
  ) {
    const rawAuth = req.headers?.authorization;
    if (rawAuth) {
      const token = rawAuth.replace(/^Bearer\s+/i, '').trim();
      if (token && (await this.authService.isTokenRevoked(token))) {
        throw new UnauthorizedException(
          'Sesión cerrada. El token ha sido revocado.',
        );
      }
    }

    return {
      id: payload.sub,
      email: payload.email,
      role: payload.role ?? 'OPERATOR',
    };
  }
}
