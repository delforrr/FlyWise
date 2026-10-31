import { ConfigService } from '@nestjs/config';
import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import type { CookieOptions, Request, Response } from 'express';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { LoginRequestDto } from './dto/login-request.dto.js';

const user = {
  id: 'user-1',
  correo: 'admin@flywise.com',
  rol: 'ADMIN' as const,
};
const session = {
  refreshToken: 'refresh-token',
  remember: true,
  expiresAt: Date.now() + 7 * 86400000,
  response: { accessToken: 'jwt', user },
};

describe('AuthController', () => {
  const service = {
    createSession: jest.fn(),
    refresh: jest.fn(),
    getSession: jest.fn(),
    register: jest.fn(),
    logout: jest.fn(),
  };
  const res = {
    cookie: jest.fn<Response, [string, string, CookieOptions]>(),
    clearCookie: jest.fn(),
    setHeader: jest.fn(),
  };
  const response = res as unknown as Response;
  const controller = new AuthController(
    service as unknown as AuthService,
    new ConfigService({
      NODE_ENV: 'production',
      CORS_ORIGIN: 'https://flywise.example',
    }),
  );
  const request = (headers = {}) =>
    ({
      headers: { 'x-flywise-session': '1', ...headers },
    }) as unknown as Request;

  beforeEach(() => {
    jest.resetAllMocks();
    service.createSession.mockResolvedValue(session);
    service.refresh.mockResolvedValue(session);
  });

  it.each([false, true])(
    'envía cookie HttpOnly con persistencia solo cuando remember=%s',
    async (remember) => {
      service.createSession.mockResolvedValueOnce({ ...session, remember });
      const result = await controller.loginRequest(
        user,
        { correo: user.correo, password: 'password123', remember },
        request(),
        response,
      );
      expect(result).toEqual(session.response);
      expect(result).not.toHaveProperty('refreshToken');
      expect(service.createSession).toHaveBeenCalledWith(
        user,
        remember,
        undefined,
      );
      const options = res.cookie.mock.calls[0][2];
      expect(options).toMatchObject({
        httpOnly: true,
        secure: true,
        sameSite: 'lax',
        path: '/',
      });
      if (remember) expect(options.maxAge).toBeGreaterThan(6 * 86400000);
      else expect(options).not.toHaveProperty('maxAge');
      expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', 'no-store');
    },
  );

  it('rota la cookie y limpia únicamente sesiones rechazadas, no errores transitorios', async () => {
    const req = request({ cookie: 'other=value; refresh_token=refresh-token' });
    expect(await controller.refresh(req, response)).toEqual(session.response);
    expect(service.refresh).toHaveBeenCalledWith('refresh-token');
    service.refresh.mockRejectedValueOnce(new UnauthorizedException());
    await expect(controller.refresh(req, response)).rejects.toThrow(
      UnauthorizedException,
    );
    expect(res.clearCookie).toHaveBeenCalledWith(
      'refresh_token',
      expect.objectContaining({ path: '/' }),
    );
    res.clearCookie.mockClear();
    service.refresh.mockRejectedValueOnce(new Error('Redis unavailable'));
    await expect(controller.refresh(req, response)).rejects.toThrow(
      'Redis unavailable',
    );
    expect(res.clearCookie).not.toHaveBeenCalled();
  });

  it('valida SSR sin emitir JWT ni rotar la cookie', async () => {
    service.getSession.mockResolvedValueOnce(user);
    expect(
      await controller.getSession(
        request({ cookie: 'refresh_token=current' }),
        response,
      ),
    ).toEqual(user);
    expect(res.cookie).not.toHaveBeenCalled();
  });

  it('rechaza solicitudes de otro origen o sin la cabecera de sesión', async () => {
    await expect(
      controller.refresh(
        request({ origin: 'https://attacker.example' }),
        response,
      ),
    ).rejects.toThrow(ForbiddenException);
    await expect(
      controller.refresh(request({ 'x-flywise-session': undefined }), response),
    ).rejects.toThrow(ForbiddenException);
    expect(service.refresh).not.toHaveBeenCalled();
  });

  it('cierra la sesión con JWT vencido o ausente y borra la cookie', async () => {
    await controller.logout(
      'Bearer expired-jwt',
      request({ cookie: 'refresh_token=current' }),
      response,
    );
    expect(service.logout).toHaveBeenCalledWith('expired-jwt', 'current');
    expect(res.clearCookie).toHaveBeenCalledWith(
      'refresh_token',
      expect.objectContaining({ httpOnly: true, path: '/' }),
    );
    await controller.logout(
      undefined,
      request({ cookie: 'refresh_token=current' }),
      response,
    );
    expect(service.logout).toHaveBeenLastCalledWith(undefined, 'current');
  });

  it('conserva registro y perfil existentes', async () => {
    const dto = { correo: user.correo, password: 'password123' };
    service.register.mockResolvedValueOnce(user);
    expect(await controller.register(dto)).toEqual(user);
    expect(controller.getProfile(user)).toEqual(user);
  });

  it('valida remember como booleano y acepta contraseñas existentes con símbolos', () => {
    const body = { correo: user.correo, password: 'Password123!' };
    expect(
      validateSync(
        plainToInstance(LoginRequestDto, { ...body, remember: true }),
      ),
    ).toEqual([]);
    expect(
      validateSync(
        plainToInstance(LoginRequestDto, { ...body, remember: 'false' }),
      ),
    ).not.toEqual([]);
  });
});
