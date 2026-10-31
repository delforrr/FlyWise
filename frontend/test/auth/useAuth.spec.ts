import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  useAuth,
  type Usuario,
  type AuthResponse,
} from '../../app/features/auth/composables/useAuth';

const validToken = `header.${btoa(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 900 }))}.signature`;

describe('useAuth — Suite de Pruebas Unitarias del Composable de Autenticación', () => {
  let mockFetch: ReturnType<typeof vi.fn>;
  let mockNavigateTo: ReturnType<typeof vi.fn>;
  let cookieStorage: { token: string | null };
  let auth: ReturnType<typeof useAuth>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch = vi.fn();
    mockNavigateTo = vi.fn();
    cookieStorage = { token: null };

    auth = useAuth({
      mockFetch,
      mockNavigateTo,
      cookieStorage,
    });
  });

  describe('Estado inicial y comprobación de sesión', () => {
    it('inicia en estado no autenticado cuando no hay cookies persistidas', () => {
      expect(auth.isAuthenticated()).toBe(false);
      expect(auth.token.value).toBeNull();
      expect(auth.user.value).toBeNull();
      expect(auth.error.value).toBeNull();
      expect(auth.isLoading.value).toBe(false);
    });

    it('inicia como autenticado si ya existe un token almacenado en cookies', () => {
      cookieStorage.token = validToken;
      const existingAuth = useAuth({
        mockFetch,
        mockNavigateTo,
        cookieStorage,
      });

      expect(existingAuth.isAuthenticated()).toBe(true);
      expect(existingAuth.token.value).toBe(validToken);
    });
  });

  describe('Flujo de Inicio de Sesión (login)', () => {
    it('autentica exitosamente con credenciales válidas y redirige a /admin', async () => {
      const mockSuccessResponse: AuthResponse = {
        accessToken: validToken,
        user: {
          id: 'user-001',
          correo: 'admin@flywise.aero',
          rol: 'ADMIN',
        },
      };

      mockFetch.mockResolvedValueOnce(mockSuccessResponse);

      const loginSuccess = await auth.login({
        correo: 'admin@flywise.aero',
        password: 'ValidPassword2026!',
      });

      // Aserciones de resolución exitosa
      expect(loginSuccess).toBe(true);
      expect(auth.token.value).toBe(mockSuccessResponse.accessToken);
      expect(auth.user.value).toEqual(mockSuccessResponse.user);
      expect(auth.isAuthenticated()).toBe(true);
      expect(cookieStorage.token).toBe(mockSuccessResponse.accessToken);
      expect(auth.error.value).toBeNull();

      // Verificación de contrato con el backend
      expect(mockFetch).toHaveBeenCalledWith('/api/autenticacion/iniciar-sesion', {
        method: 'POST',
        headers: { 'X-FlyWise-Session': '1' },
        body: {
          correo: 'admin@flywise.aero',
          password: 'ValidPassword2026!',
        },
      });

      // Redirección hacia el panel administrativo
      expect(mockNavigateTo).toHaveBeenCalledWith('/admin');
    });

    it('gestiona credenciales incorrectas (401 Unauthorized) limpiando estado y seteando error', async () => {
      mockFetch.mockRejectedValueOnce({
        estado: 401,
        data: {
          message: 'Credenciales inválidas o sin permisos de acceso',
        },
      });

      const loginSuccess = await auth.login({
        correo: 'hacker@malicious.com',
        password: 'wrong-password',
      });

      expect(loginSuccess).toBe(false);
      expect(auth.isAuthenticated()).toBe(false);
      expect(auth.token.value).toBeNull();
      expect(auth.user.value).toBeNull();
      expect(cookieStorage.token).toBeNull();
      expect(auth.error.value).toBe('Credenciales inválidas o sin permisos de acceso');
      expect(mockNavigateTo).not.toHaveBeenCalled();
    });

    it('controla la bandera isLoading durante la resolución de la promesa', async () => {
      let resolvePromise: (value: any) => void = () => {};
      const pendingPromise = new Promise((resolve) => {
        resolvePromise = resolve;
      });

      mockFetch.mockReturnValueOnce(pendingPromise);

      const loginPromise = auth.login({
        correo: 'admin@flywise.aero',
        password: 'password123',
      });

      // Mientras la promesa está pendiente
      expect(auth.isLoading.value).toBe(true);

      // Resolvemos
      resolvePromise({
        accessToken: 'token-123',
        user: { id: '1', correo: 'admin@flywise.aero', rol: 'ADMIN' },
      });
      await loginPromise;

      // Una vez concluida
      expect(auth.isLoading.value).toBe(false);
    });

    it('gestiona errores 500 sin mensaje explícito utilizando el fallback "Error de autenticación"', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Internal Server Error'));

      const loginSuccess = await auth.login({
        correo: 'admin@flywise.aero',
        password: 'Password123!',
      });

      expect(loginSuccess).toBe(false);
      expect(auth.isAuthenticated()).toBe(false);
      expect(auth.error.value).toBe('Error de autenticación');
      expect(mockNavigateTo).not.toHaveBeenCalled();
    });

    it('soporta usuarios con rol OPERATOR así como ADMIN', async () => {
      const operatorResponse: AuthResponse = {
        accessToken: 'operator-token-jwt',
        user: { id: 'u-operator', correo: 'op@flywise.aero', rol: 'OPERATOR' },
      };
      mockFetch.mockResolvedValueOnce(operatorResponse);

      const loginSuccess = await auth.login({
        correo: 'op@flywise.aero',
        password: 'Password123!',
      });

      expect(loginSuccess).toBe(true);
      expect(auth.user.value?.rol).toBe('OPERATOR');
      expect(cookieStorage.token).toBe('operator-token-jwt');
    });

    it('limpia errores previos al reintentar un nuevo inicio de sesión', async () => {
      mockFetch.mockRejectedValueOnce({ data: { message: 'Fallo 1' } });
      await auth.login({ correo: 'a@b.com', password: '123' });
      expect(auth.error.value).toBe('Fallo 1');

      let resolveLogin: any;
      mockFetch.mockReturnValueOnce(new Promise((r) => { resolveLogin = r; }));
      const promise = auth.login({ correo: 'a@b.com', password: '123' });

      // Durante la nueva solicitud el error debe haberse reseteado a null
      expect(auth.error.value).toBeNull();

      resolveLogin({ accessToken: 'ok', user: { id: '1', correo: 'a@b.com', rol: 'ADMIN' } });
      await promise;
      expect(auth.error.value).toBeNull();
    });

    it('soporta inicios de sesión sucesivos reemplazando credenciales previas limpiamente', async () => {
      mockFetch.mockResolvedValueOnce({
        accessToken: 'token-admin',
        user: { id: 'u-1', correo: 'admin1@flywise.aero', rol: 'ADMIN' },
      });
      await auth.login({ correo: 'admin1@flywise.aero', password: 'p1' });
      expect(auth.token.value).toBe('token-admin');

      mockFetch.mockResolvedValueOnce({
        accessToken: 'token-operator',
        user: { id: 'u-2', correo: 'op@flywise.aero', rol: 'OPERATOR' },
      });
      await auth.login({ correo: 'op@flywise.aero', password: 'p2' });
      expect(auth.token.value).toBe('token-operator');
      expect(auth.user.value?.correo).toBe('op@flywise.aero');
      expect(cookieStorage.token).toBe('token-operator');
    });
  });

  describe('Flujo de Cierre de Sesión (logout)', () => {
    it('revoca la sesión, limpia tokens de memoria/cookie y redirige a /login', async () => {
      cookieStorage.token = 'activa-session-token';
      const activeAuth = useAuth({
        mockFetch,
        mockNavigateTo,
        cookieStorage,
      });

      await activeAuth.logout();

      expect(activeAuth.isAuthenticated()).toBe(false);
      expect(activeAuth.token.value).toBeNull();
      expect(activeAuth.user.value).toBeNull();
      expect(cookieStorage.token).toBeNull();
      expect(mockNavigateTo).toHaveBeenCalledWith('/login');
    });

    it('permite ejecutar logout() en estado no autenticado sin fallos colaterales', async () => {
      await auth.logout();

      expect(auth.isAuthenticated()).toBe(false);
      expect(auth.token.value).toBeNull();
      expect(auth.user.value).toBeNull();
      expect(cookieStorage.token).toBeNull();
      expect(mockNavigateTo).toHaveBeenCalledWith('/login');
    });
  });
});


describe('sesión recordada y renovación', () => {
  const user = { id: '1', correo: 'admin@flywise.aero', rol: 'ADMIN' as const };

  it('envía remember al backend y restaura una sesión sin un JWT en memoria', async () => {
    const fetcher = vi.fn().mockResolvedValue({ accessToken: 'restored', user });
    const auth = useAuth({ mockFetch: fetcher, mockNavigateTo: vi.fn(), cookieStorage: { token: null } });
    expect(await auth.restoreSession()).toBe(true);
    expect(auth.token.value).toBe('restored');
    expect(auth.user.value).toEqual(user);
    expect(fetcher).toHaveBeenCalledWith('/api/autenticacion/renovar', expect.objectContaining({ method: 'POST' }));
    await auth.login({ correo: user.correo, password: 'password123', remember: true });
    expect(fetcher).toHaveBeenLastCalledWith('/api/autenticacion/iniciar-sesion', expect.objectContaining({ body: { correo: user.correo, password: 'password123', remember: true } }));
  });

  it('renueva una sola vez las solicitudes simultáneas y reintenta con el JWT nuevo', async () => {
    let resolveRefresh!: (value: AuthResponse) => void;
    const fetcher = vi.fn().mockReturnValue(new Promise<AuthResponse>(resolve => { resolveRefresh = resolve; }));
    const auth = useAuth({ mockFetch: fetcher, mockNavigateTo: vi.fn(), cookieStorage: { token: 'expired' } });
    const first = vi.fn().mockRejectedValueOnce({ statusCode: 401 }).mockResolvedValueOnce('first');
    const second = vi.fn().mockRejectedValueOnce({ statusCode: 401 }).mockResolvedValueOnce('second');
    const requests = [auth.authenticatedRequest(first), auth.authenticatedRequest(second)];
    await Promise.resolve();
    resolveRefresh({ accessToken: 'renewed', user });
    expect(await Promise.all(requests)).toEqual(['first', 'second']);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(first).toHaveBeenLastCalledWith('renewed');
    expect(second).toHaveBeenLastCalledWith('renewed');
  });

  it('redirige solo si refresh rechaza la sesión y conserva el estado ante fallas de red', async () => {
    const fetcher = vi.fn().mockRejectedValueOnce({ statusCode: 503 }).mockRejectedValueOnce({ statusCode: 401 });
    const navigate = vi.fn();
    const auth = useAuth({ mockFetch: fetcher, mockNavigateTo: navigate, cookieStorage: { token: 'expired' } });
    await expect(auth.restoreSession()).rejects.toEqual({ statusCode: 503 });
    expect(auth.token.value).toBe('expired');
    expect(await auth.restoreSession()).toBe(false);
    expect(auth.token.value).toBeNull();
    expect(navigate).not.toHaveBeenCalled();
  });

  it('no renueva indefinidamente si el reintento vuelve a fallar con 401', async () => {
    const fetcher = vi.fn().mockResolvedValueOnce({ accessToken: 'renewed', user });
    const navigate = vi.fn();
    const auth = useAuth({ mockFetch: fetcher, mockNavigateTo: navigate, cookieStorage: { token: 'expired' } });
    const action = vi.fn().mockRejectedValue({ statusCode: 401 });
    await expect(auth.authenticatedRequest(action)).rejects.toThrow('sesión');
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(action).toHaveBeenCalledTimes(2);
    expect(navigate).toHaveBeenCalledWith('/login');
  });

  it('revoca en el backend antes de borrar la sesión y conserva el estado si logout falla', async () => {
    const fetcher = vi.fn().mockRejectedValueOnce({ statusCode: 503 }).mockResolvedValueOnce({});
    const navigate = vi.fn();
    const auth = useAuth({ mockFetch: fetcher, mockNavigateTo: navigate, cookieStorage: { token: 'activa' } });
    await expect(auth.logout()).rejects.toEqual({ statusCode: 503 });
    expect(auth.token.value).toBe('activa');
    await auth.logout();
    expect(auth.token.value).toBeNull();
    expect(fetcher).toHaveBeenLastCalledWith('/api/autenticacion/cerrar-sesion', expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Bearer activa' }) }));
    expect(navigate).toHaveBeenCalledWith('/login');
  });
});

 it('no considera autenticado un JWT vencido o malformado', () => {
   const storage = { token: `header.${btoa(JSON.stringify({ exp: 1 }))}.signature` };
   const auth = useAuth({ cookieStorage: storage, mockFetch: vi.fn(), mockNavigateTo: vi.fn() });
   expect(auth.isAuthenticated()).toBe(false);
   storage.token = 'malformed';
   expect(auth.isAuthenticated()).toBe(false);
 });
