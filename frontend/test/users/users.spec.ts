import { useAuth } from '../../app/features/auth/composables/useAuth';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createUserSchema, updateUserSchema, userSchema } from '../../app/features/users/schemas/userSchemas';
import { useUsers } from '../../app/features/users/composables/useUsers';

const account = { id: 'b6d404aa-a88a-412b-805c-acbca4ab9f3f', email: 'admin@flywise.com', role: 'ADMIN' as const, createdAt: '2026-10-01T12:00:00.000Z' };
const operator = { ...account, id: '63d328d7-28e5-44d1-9e6a-acf71d595148', email: 'operaciones@flywise.com', role: 'OPERATOR' as const };
const fetcher = vi.fn();
const loginToken = `header.${btoa(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 900 }))}.signature`;
let cookie: { value: string | null };

beforeEach(() => {
  vi.clearAllMocks();
  cookie = { value: null };
  useState<string | null>('auth_token', () => null).value = 'test-token';
  vi.stubGlobal('useCookie', () => cookie);
  vi.stubGlobal('$fetch', fetcher);
});

describe('esquemas de usuarios', () => {
  it('normaliza correo y rechaza credenciales y roles inválidos', () => {
    expect(createUserSchema.parse({ email: ' ADMIN@flywise.com ', password: 'password123', role: 'ADMIN' }).email).toBe('admin@flywise.com');
    for (const fields of [{ email: 'bad' }, { password: 'short' }, { password: 'password!' }, { role: 'ROOT' }]) {
      expect(createUserSchema.safeParse({ email: account.email, password: 'password123', role: 'OPERATOR', ...fields }).success).toBe(false);
    }
  });
  it('omite la contraseña vacía en edición y valida las respuestas', () => {
    expect(updateUserSchema.parse({ email: account.email, role: 'ADMIN', password: '' }).password).toBeUndefined();
    expect(updateUserSchema.safeParse({ email: account.email, role: 'ADMIN', password: 'short' }).success).toBe(false);
    expect(userSchema.safeParse({ ...account, role: 'ROOT' }).success).toBe(false);
    expect(userSchema.parse({ ...account, passwordHash: 'secret' })).not.toHaveProperty('passwordHash');
  });
});

describe('CRUD autenticado', () => {
  it('comparte el login con el CRUD y limpia todas las instancias cuando vence la sesión', async () => {
    cookie.value = null;
    const auth = useAuth();
    const otherAuth = useAuth();
    fetcher.mockResolvedValueOnce({ accessToken: loginToken, user: account });
    await auth.login({ email: account.email, password: 'password123' });
    expect(otherAuth.user.value).toEqual(account);
    expect(otherAuth.isAuthenticated()).toBe(true);
    fetcher.mockResolvedValueOnce(account).mockResolvedValueOnce([account]);
    const crud = useUsers();
    await crud.load();
    expect(crud.error.value).toBe('');
    expect(fetcher).toHaveBeenLastCalledWith('/api/users', expect.objectContaining({ headers: { Authorization: `Bearer ${loginToken}` } }));
    fetcher.mockRejectedValueOnce({ statusCode: 401 }).mockResolvedValueOnce([]).mockRejectedValueOnce({ statusCode: 401 });
    await crud.load();
    expect(auth.token.value).toBeNull();
    expect(otherAuth.user.value).toBeNull();
  });

  it('carga, filtra, crea, actualiza y elimina con JWT', async () => {
    fetcher.mockResolvedValueOnce(account).mockResolvedValueOnce([account]);
    const crud = useUsers();
    await crud.load();
    expect(crud.currentUser.value).toEqual(account);
    expect(fetcher).toHaveBeenCalledWith('/api/users', expect.objectContaining({ headers: { Authorization: 'Bearer test-token' } }));
    fetcher.mockResolvedValueOnce(operator);
    await crud.save({ email: operator.email, password: 'password123', role: 'OPERATOR' });
    crud.role.value = 'OPERATOR';
    crud.search.value = ' OPERACIONES ';
    expect(crud.filteredUsers.value).toEqual([operator]);
    fetcher.mockResolvedValueOnce({ ...operator, role: 'ADMIN' });
    await crud.save({ email: operator.email, password: '', role: 'ADMIN' }, operator.id);
    expect(fetcher).toHaveBeenLastCalledWith(`/api/users/${operator.id}`, expect.objectContaining({ method: 'PATCH', body: { email: operator.email, role: 'ADMIN', password: undefined } }));
    expect(crud.filteredUsers.value).toEqual([]);
    fetcher.mockResolvedValueOnce(undefined);
    await crud.remove(operator);
    expect(crud.users.value).toEqual([account]);
    await expect(crud.remove(account)).rejects.toThrow('propia cuenta');
  });
  it('conserva los datos ante un conflicto y libera el estado de guardado', async () => {
    const crud = useUsers();
    crud.users.value = [account];
    fetcher.mockRejectedValueOnce({ statusCode: 409 });
    await expect(crud.save({ email: account.email, password: 'password123', role: 'ADMIN' })).rejects.toThrow('otra cuenta');
    expect(crud.users.value).toEqual([account]);
    expect(crud.saving.value).toBe(false);
  });
  it('rechaza formularios antes de enviarlos y respuestas incompatibles', async () => {
    const crud = useUsers();
    await expect(crud.save({ email: 'bad', password: '', role: 'ADMIN' })).rejects.toThrow();
    expect(fetcher).not.toHaveBeenCalled();
    fetcher.mockResolvedValueOnce(account).mockResolvedValueOnce([{ ...operator, role: 'ROOT' }]);
    await crud.load();
    expect(crud.error.value).not.toBe('');
    expect(crud.users.value).toEqual([]);
  });
  it('redirige al login cuando vence la sesión', async () => {
    const crud = useUsers();
    fetcher.mockRejectedValueOnce({ statusCode: 401 }).mockResolvedValueOnce([]).mockRejectedValueOnce({ statusCode: 401 });
    await crud.load();
    expect(cookie.value).toBeNull();
    expect(navigateTo).toHaveBeenCalledWith('/login');
    expect(crud.loading.value).toBe(false);
  });
});
