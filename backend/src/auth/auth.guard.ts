import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  ValidationPipe,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { LoginRequestDto } from './dto/login-request.dto.js';
import type { UserDto } from '../users/dto/user.dto.js';
import { firstValueFrom, isObservable } from 'rxjs';

@Injectable()
export class LocalAuthGuard extends AuthGuard('local') {
  async canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest<{
      body?: Record<string, unknown>;
    }>();
    if (req.body && 'username' in req.body) {
      const { username, ...body } = req.body;
      req.body = { ...body, email: body.email ?? username };
    }
    // Passport runs before controller pipes, so validate credentials here.
    const credentials: unknown = await new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }).transform(req.body, { type: 'body', metatype: LoginRequestDto });
    req.body = credentials as Record<string, unknown>;
    const result = super.canActivate(context);
    return isObservable(result) ? firstValueFrom(result) : result;
  }
}

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}

@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const { user } = context.switchToHttp().getRequest<{ user?: UserDto }>();
    if (user?.role !== 'ADMIN') {
      throw new ForbiddenException('Se requiere el rol ADMIN');
    }
    return true;
  }
}
