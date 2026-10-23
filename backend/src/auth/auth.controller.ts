import {
  Controller,
  UseGuards,
  Get,
  Post,
  Request,
  Headers,
  HttpStatus,
  HttpCode,
  Body,
} from '@nestjs/common';
import { LoginRequestDto } from './dto/login-request.dto';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBody,
  ApiBearerAuth,
  ApiOAuth2,
} from '@nestjs/swagger';
import { LocalAuthGuard, JwtAuthGuard } from './auth.guard';
import { AuthService } from './auth.service';
import { CreateUserDto } from '../users/dto/create-user.dto';
import { CurrentUser } from '../users/decorators/current-user.decorator';
import { type UserDto } from '../users/dto/user.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @UseGuards(LocalAuthGuard)
  @Post('/login')
  @ApiOperation({
    summary: 'Autentica a un usuario y genera un token de acceso JWT',
  })
  @ApiBody({ type: LoginRequestDto })
  @ApiResponse({
    status: 200,
    description: 'Autenticación exitosa. Retorna el token de acceso.',
  })
  @ApiResponse({
    status: 401,
    description: 'Credenciales inválidas.',
  })
  @HttpCode(HttpStatus.OK)
  loginRequest(@CurrentUser() user: UserDto) {
    return this.authService.login(user);
  }

  @Post('/register')
  @ApiOperation({
    summary: 'Registra un nuevo usuario en la plataforma',
  })
  @ApiBody({ type: CreateUserDto })
  @ApiResponse({
    status: 201,
    description: 'Usuario registrado exitosamente.',
  })
  @ApiResponse({
    status: 409,
    description: 'Conflicto: el correo ya se encuentra registrado.',
  })
  async register(@Body() createUserDto: CreateUserDto) {
    return this.authService.register(createUserDto);
  }

  @ApiOAuth2([])
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get('/me')
  @ApiOperation({
    summary: 'Obtiene el perfil del usuario actualmente autenticado',
  })
  @ApiResponse({
    status: 200,
    description: 'Perfil del usuario autenticado.',
  })
  @ApiResponse({
    status: 401,
    description: 'No autorizado - Token JWT inválido o no provisto.',
  })
  getProfile(@CurrentUser() user: UserDto): UserDto {
    return user;
  }

  @ApiOAuth2([])
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('/logout')
  @ApiOperation({
    summary: 'Cierra la sesión del usuario actual invalidando credenciales',
  })
  @ApiResponse({
    status: 200,
    description: 'Sesión cerrada correctamente.',
  })
  @ApiResponse({
    status: 401,
    description: 'No autorizado - Token JWT inválido o no provisto.',
  })
  async logout(
    @Headers('authorization') authHeader?: string,
    @Request()
    req?: {
      logout?: (callback?: (err: unknown) => void) => unknown;
    },
  ) {
    if (typeof req?.logout === 'function') {
      try {
        req.logout(() => {});
      } catch {
        // Safe fallback if session engine is absent
      }
    }

    const token = authHeader?.replace(/^Bearer\s+/i, '').trim();
    if (token) {
      await this.authService.logout(token);
    }

    return { message: 'Sesión cerrada exitosamente. Token invalidado.' };
  }
}
