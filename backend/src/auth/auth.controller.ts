import { ConfigService } from '@nestjs/config';
import type {
  Request as ExpressRequest,
  Response,
  CookieOptions,
} from 'express';
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
  Res,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { LoginRequestDto } from './dto/login-request.dto';
import {
  ApiTags,
  ApiHeader,
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
  constructor(
    private readonly authService: AuthService,
    private readonly config: ConfigService,
  ) {}

  private cookieOptions(): CookieOptions {
    return {
      httpOnly: true,
      secure: this.config.get('NODE_ENV') === 'production',
      sameSite: 'lax',
      path: '/',
    };
  }

  private checkOrigin(req: ExpressRequest, requireHeader = true) {
    const origin = req.headers.origin;
    if (
      (requireHeader && req.headers['x-flywise-session'] !== '1') ||
      req.headers['sec-fetch-site'] === 'cross-site' ||
      (origin &&
        origin !== this.config.get('CORS_ORIGIN', 'http://localhost:3000') &&
        origin !== `${req.protocol}://${req.headers.host}`)
    ) {
      throw new ForbiddenException('Origen de sesión no permitido.');
    }
  }

  private refreshCookie(req: ExpressRequest) {
    return req.headers.cookie
      ?.split(';')
      .map((value) => value.trim())
      .find((value) => value.startsWith('refresh_token='))
      ?.slice('refresh_token='.length);
  }

  private sendSession(
    res: Response,
    session: Pick<
      Awaited<ReturnType<AuthService['createSession']>>,
      'refreshToken' | 'remember' | 'expiresAt' | 'response'
    >,
  ) {
    res.setHeader('Cache-Control', 'no-store');
    res.cookie('refresh_token', session.refreshToken, {
      ...this.cookieOptions(),
      ...(session.remember
        ? { maxAge: Math.max(0, session.expiresAt - Date.now()) }
        : {}),
    });
    return session.response;
  }

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
  async loginRequest(
    @CurrentUser() user: UserDto,
    @Body() body: LoginRequestDto,
    @Request() req: ExpressRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    this.checkOrigin(req, false);
    const session = await this.authService.createSession(
      user,
      body.remember ?? false,
      this.refreshCookie(req),
    );
    return this.sendSession(res, session);
  }

  @ApiHeader({
    name: 'X-FlyWise-Session',
    required: true,
    schema: { default: '1' },
  })
  @Get('/session')
  @ApiOperation({
    summary: 'Valida la sesión para proteger páginas SSR sin rotar la cookie',
  })
  async getSession(
    @Request() req: ExpressRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    this.checkOrigin(req);
    res.setHeader('Cache-Control', 'no-store');
    return this.authService.getSession(this.refreshCookie(req));
  }

  @ApiHeader({
    name: 'X-FlyWise-Session',
    required: true,
    schema: { default: '1' },
  })
  @Post('/refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Rota la sesión y emite un JWT de acceso nuevo' })
  async refresh(
    @Request() req: ExpressRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    this.checkOrigin(req);
    res.setHeader('Cache-Control', 'no-store');
    try {
      return this.sendSession(
        res,
        await this.authService.refresh(this.refreshCookie(req)),
      );
    } catch (cause: unknown) {
      if (cause instanceof UnauthorizedException)
        res.clearCookie('refresh_token', this.cookieOptions());
      throw cause;
    }
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

  @ApiHeader({
    name: 'X-FlyWise-Session',
    required: true,
    schema: { default: '1' },
  })
  @Post('/logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Revoca la sesión incluso si el JWT ya venció' })
  async logout(
    @Headers('authorization') authHeader: string | undefined,
    @Request() req: ExpressRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    this.checkOrigin(req);
    await this.authService.logout(
      authHeader?.replace(/^Bearer\s+/i, '').trim(),
      this.refreshCookie(req),
    );
    res.setHeader('Cache-Control', 'no-store');
    res.clearCookie('refresh_token', this.cookieOptions());
    return { message: 'Sesión cerrada exitosamente. Token invalidado.' };
  }
}
