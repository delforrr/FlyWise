import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Response, Request } from 'express';

@Injectable()
export class PerformanceInterceptor implements NestInterceptor {
  private readonly logger = new Logger(PerformanceInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const start = performance.now();
    const httpCtx = context.switchToHttp();
    const response = httpCtx.getResponse<Response>();
    const request = httpCtx.getRequest<Request>();

    return next.handle().pipe(
      tap(() => {
        const duration = Math.round(performance.now() - start);
        if (response && typeof response.setHeader === 'function') {
          response.setHeader('X-Response-Time', `${duration}ms`);
        }

        if (duration > 150) {
          this.logger.warn(
            `[RNF-01 Latencia > 150ms] ${request.method} ${request.url} tomó ${duration}ms`,
          );
        }
      }),
    );
  }
}
