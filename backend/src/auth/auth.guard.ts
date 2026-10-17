import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class LocalAuthGuard extends AuthGuard('local') {
  canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest<{
      body?: Record<string, unknown>;
    }>();
    if (req?.body && !req.body.email && req.body.username) {
      req.body.email = req.body.username;
    }
    return super.canActivate(context);
  }
}

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
