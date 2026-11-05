import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const estado =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const exceptionResponse =
      exception instanceof HttpException
        ? exception.getResponse()
        : 'Internal Server Error';

    let message: string | string[] = 'Internal Server Error';
    let error = 'Internal Server Error';

    if (typeof exceptionResponse === 'string') {
      message = exceptionResponse;
    } else if (
      typeof exceptionResponse === 'object' &&
      exceptionResponse !== null
    ) {
      const resObj = exceptionResponse as Record<string, unknown>;
      message = (resObj.message as string | string[]) ?? message;
      error = (resObj.error as string) ?? error;
    }

    if (estado >= 500) {
      this.logger.error(
        `[${request.method}] ${request.url} - ${estado} - Error: ${exception instanceof Error ? exception.message : 'Unknown'}`,
      );
    }

    response.status(estado).json({
      statusCode: estado,
      timestamp: new Date().toISOString(),
      path: request.url,
      error,
      message,
    });
  }
}
