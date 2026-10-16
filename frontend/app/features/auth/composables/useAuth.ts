import { ref } from 'vue';

export interface User {
  id: string;
  email: string;
  role: 'ADMIN' | 'OPERATOR';
}

export interface AuthResponse {
  accessToken: string;
  user: User;
}

export interface UseAuthOptions {
  mockFetch?: <T>(url: string, opts?: any) => Promise<T>;
  mockNavigateTo?: (url: string) => Promise<any>;
  cookieStorage?: { token: string | null };
}

/**
 * Composable de autenticación y gestión de sesión (JWT) para FlyWise.
 * Provee estado reactivo de usuario, token, login, logout y redirección protegida.
 */
export function useAuth(options?: UseAuthOptions) {
  const cookieToken = options?.cookieStorage
    ? options.cookieStorage.token
    : typeof useCookie !== 'undefined'
      ? useCookie<string | null>('auth_token').value
      : null;

  const user = ref<User | null>(null);
  const token = ref<string | null>(cookieToken ?? null);
  const isLoading = ref<boolean>(false);
  const error = ref<string | null>(null);

  const isAuthenticated = () => Boolean(token.value);

  const fetcher =
    options?.mockFetch ??
    (typeof $fetch !== 'undefined'
      ? ($fetch as <T>(url: string, opts?: any) => Promise<T>)
      : undefined);

  const navigator =
    options?.mockNavigateTo ??
    (typeof navigateTo !== 'undefined' ? navigateTo : undefined);

  async function login(credentials: { email: string; password: string }): Promise<boolean> {
    isLoading.value = true;
    error.value = null;

    try {
      if (!fetcher) {
        throw new Error('Cliente HTTP no disponible');
      }

      const response = await fetcher<AuthResponse>('/api/auth/login', {
        method: 'POST',
        body: credentials,
      });

      token.value = response.accessToken;
      user.value = response.user;

      if (options?.cookieStorage) {
        options.cookieStorage.token = response.accessToken;
      } else if (typeof useCookie !== 'undefined') {
        const cookie = useCookie<string | null>('auth_token');
        cookie.value = response.accessToken;
      }

      if (navigator) {
        await navigator('/admin');
      }
      return true;
    } catch (err: any) {
      error.value =
        err?.data?.message ||
        (err?.message && err.message !== 'Internal Server Error' && err.message !== 'Error'
          ? err.message
          : 'Error de autenticación');
      token.value = null;
      user.value = null;

      if (options?.cookieStorage) {
        options.cookieStorage.token = null;
      } else if (typeof useCookie !== 'undefined') {
        const cookie = useCookie<string | null>('auth_token');
        cookie.value = null;
      }
      return false;
    } finally {
      isLoading.value = false;
    }
  }

  async function logout(): Promise<void> {
    token.value = null;
    user.value = null;

    if (options?.cookieStorage) {
      options.cookieStorage.token = null;
    } else if (typeof useCookie !== 'undefined') {
      const cookie = useCookie<string | null>('auth_token');
      cookie.value = null;
    }

    if (navigator) {
      await navigator('/login');
    }
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
