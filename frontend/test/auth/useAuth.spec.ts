import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ref } from 'vue';

// ---------------------------------------------------------------------------
// Modelo de Referencia del Composable de Autenticación para Nuxt 4 + NestJS
// Ilustra la lógica de sesión, persistencia de tokens JWT y llamadas API
// ---------------------------------------------------------------------------
interface User {
  id: string;
  email: string;
  role: 'ADMIN' | 'OPERATOR';
}

interface AuthResponse {
  accessToken: string;
  user: User;
}

// Simulador del composable useAuth para la suite de pruebas unitarias
function createAuthComposable(deps: {
  mockFetch: ReturnType<typeof vi.fn>;
  mockNavigateTo: ReturnType<typeof vi.fn>;
  cookieStorage: { token: string | null };
}) {
  const user = ref<User | null>(null);
  const token = ref<string | null>(deps.cookieStorage.token);
  const isLoading = ref<boolean>(false);
  const error = ref<string | null>(null);

  const isAuthenticated = () => Boolean(token.value);

  async function login(credentials: { email: string; password: string }) {
    isLoading.value = true;
    error.value = null;

    try {
      const response = await deps.mockFetch<AuthResponse>('/api/auth/login', {
        method: 'POST',
        body: credentials,
      });

      token.value = response.accessToken;
      user.value = response.user;
      deps.cookieStorage.token = response.accessToken;

      await deps.mockNavigateTo('/admin');
      return true;
    } catch (err: any) {
      error.value = err.data?.message || 'Error de autenticación';
      token.value = null;
      user.value = null;
      deps.cookieStorage.token = null;
      return false;
    } finally {
      isLoading.value = false;
    }
  }

  async function logout() {
    token.value = null;
    user.value = null;
    deps.cookieStorage.token = null;
    await deps.mockNavigateTo('/login');
  }

  return {
    user,
    token,
    isLoading,
    error,
    isAuthenticated,
    login,
    logout,
  };
}

describe('useAuth — Suite de Pruebas Unitarias del Composable de Autenticación', () => {
  let mockFetch: ReturnType<typeof vi.fn>;
  let mockNavigateTo: ReturnType<typeof vi.fn>;
  let cookieStorage: { token: string | null };
  let auth: ReturnType<typeof createAuthComposable>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch = vi.fn();
    mockNavigateTo = vi.fn();
    cookieStorage = { token: null };

    auth = createAuthComposable({
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
      cookieStorage.token = 'existing-jwt-token-xyz';
      const existingAuth = createAuthComposable({
        mockFetch,
        mockNavigateTo,
        cookieStorage,
      });

      expect(existingAuth.isAuthenticated()).toBe(true);
      expect(existingAuth.token.value).toBe('existing-jwt-token-xyz');
    });
  });

  describe('Flujo de Inicio de Sesión (login)', () => {
    it('autentica exitosamente con credenciales válidas y redirige a /admin', async () => {
      const mockSuccessResponse: AuthResponse = {
        accessToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.sample',
        user: {
          id: 'user-001',
          email: 'admin@flywise.aero',
          role: 'ADMIN',
        },
      };

      mockFetch.mockResolvedValueOnce(mockSuccessResponse);

      const loginSuccess = await auth.login({
        email: 'admin@flywise.aero',
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
      expect(mockFetch).toHaveBeenCalledWith('/api/auth/login', {
        method: 'POST',
        body: {
          email: 'admin@flywise.aero',
          password: 'ValidPassword2026!',
        },
      });

      // Redirección hacia el panel administrativo
      expect(mockNavigateTo).toHaveBeenCalledWith('/admin');
    });

    it('gestiona credenciales incorrectas (401 Unauthorized) limpiando estado y seteando error', async () => {
      mockFetch.mockRejectedValueOnce({
        status: 401,
        data: {
          message: 'Credenciales inválidas o sin permisos de acceso',
        },
      });

      const loginSuccess = await auth.login({
        email: 'hacker@malicious.com',
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
        email: 'admin@flywise.aero',
        password: 'password123',
      });

      // Mientras la promesa está pendiente
      expect(auth.isLoading.value).toBe(true);

      // Resolvemos
      resolvePromise({
        accessToken: 'token-123',
        user: { id: '1', email: 'admin@flywise.aero', role: 'ADMIN' },
      });
      await loginPromise;

      // Una vez concluida
      expect(auth.isLoading.value).toBe(false);
    });
  });

  describe('Flujo de Cierre de Sesión (logout)', () => {
    it('revoca la sesión, limpia tokens de memoria/cookie y redirige a /login', async () => {
      // Estado previo autenticado
      cookieStorage.token = 'active-session-token';
      const activeAuth = createAuthComposable({
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
  });
});

