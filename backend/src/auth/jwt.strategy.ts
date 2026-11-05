import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service.js';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    private readonly authService: AuthService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      audience: 'access',
      algorithms: ['HS256'],
      secretOrKey: configService.getOrThrow<string>('JWT_SECRET'),
      passReqToCallback: true,
    });
  }

  async validate(
    req: { headers?: { authorization?: string } },
    payload: {
      sub: string;
      sid?: string;
      correo: string;
      rol?: 'ADMIN' | 'OPERATOR';
    },
  ) {
    if (payload.sid && !(await this.authService.isSessionActive(payload.sid))) {
      throw new UnauthorizedException('Sesión revocada.');
    }
    const rawAuth = req.headers?.authorization;
    if (rawAuth) {
      const token = rawAuth.replace(/^Bearer\s+/i, '').trim();
      if (token && (await this.authService.isTokenRevoked(token))) {
        throw new UnauthorizedException(
          'Sesión cerrada. El token ha sido revocado.',
        );
      }
    }

    if (typeof payload.sub !== 'string' || !payload.sub) {
      throw new UnauthorizedException('Token sin usuario válido');
    }
    try {
      return await this.authService.getProfile(payload.sub);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw new UnauthorizedException('La cuenta ya no existe');
      }
      throw error;
    }
  }
}
