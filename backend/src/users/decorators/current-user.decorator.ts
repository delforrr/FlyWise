import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { UserDto } from '../dto/user.dto.js';

export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): UserDto => {
    const request = context.switchToHttp().getRequest<{ user: UserDto }>();
    return request.user;
  },
);
