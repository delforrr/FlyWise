import {
  Controller,
  UseGuards,
  Post,
  Request,
  HttpStatus,
  HttpCode,
  Body,
} from '@nestjs/common';
import { LoginRequestDto } from './dto/login-request.dto';
import { ApiBody } from '@nestjs/swagger';
import { LocalAuthGuard } from './auth.guard';
import { AuthService } from './auth.service';
import { CreateUserDto } from '../users/dto/create-user.dto';
import { CurrentUser } from '../users/decorators/current-user.decorator';
import { type UserDto } from '../users/dto/user.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @UseGuards(LocalAuthGuard)
  @Post('/login')
  @ApiBody({ type: LoginRequestDto })
  @HttpCode(HttpStatus.OK)
  async loginRequest(@CurrentUser() user: UserDto) {
    return this.authService.login(user);
  }

  @Post('/register')
  async register(@Body() createUserDto: CreateUserDto) {
    return this.authService.register(createUserDto);
  }

  @UseGuards(LocalAuthGuard)
  @Post('/logout')
  logout(@Request() req: { logout: () => unknown }) {
    return req.logout();
  }
}
