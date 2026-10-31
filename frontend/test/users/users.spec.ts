import { useAuth } from '../../app/features/auth/composables/useAuth';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createUserSchema, updateUserSchema, userSchema } from '../../app/features/users/schemas/userSchemas';
import { useUsers } from '../../app/features/users/composables/useUsers';

const account = { id: 'b6d404aa-a88a-412b-805c-acbca4ab9f3f', correo: 'admin@flywise.com', rol: 'ADMIN' as const, creadoEn: '2026-10-01T12:00:00.000Z' };
const operator = { ...account, id: '63d328d7-28e5-44d1-9e6a-acf71d595148', correo: 'operaciones@flywise.com', rol: 'OPERATOR' as const };
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
    expect(createUserSchema.parse({ correo: ' ADMIN@flywise.com ', password: 'password123', rol: 'ADMIN' }).correo).toBe('admin@flywise.com');
    for (const fields of [{ correo: 'bad' }, { password: 'short' }, { password: 'password!' }, { rol: 'ROOT' }]) {
      expect(createUserSchema.safeParse({ correo: account.correo, password: 'password123', rol: 'OPERATOR', ...fields }).success).toBe(false);
    }
  });
  it('omite la contraseña vacía en edición y valida las respuestas', () => {
    expect(updateUserSchema.parse({ correo: account.correo, rol: 'ADMIN', password: '' }).password).toBeUndefined();
    expect(updateUserSchema.safeParse({ correo: account.correo, rol: 'ADMIN', password: 'short' }).success).toBe(false);
    expect(userSchema.safeParse({ ...account, rol: 'ROOT' }).success).toBe(false);
    expect(userSchema.parse({ ...account, hashContrasena: 'secret' })).not.toHaveProperty('hashContrasena');
  });
});

describe('CRUD autenticado', () => {
  it('comparte el login con el CRUD y limpia todas las instancias cuando vence la sesión', async () => {
    cookie.value = null;
    const auth = useAuth();
    const otherAuth = useAuth();
    fetcher.mockResolvedValueOnce({ accessToken: loginToken, user: account });
    await auth.login({ correo: account.correo, password: 'password123' });
    expect(otherAuth.user.value).toEqual(account);
    expect(otherAuth.isAuthenticated()).toBe(true);
    fetcher.mockResolvedValueOnce(account).mockResolvedValueOnce([account]);
    const crud = useUsers();
    await crud.load();
    expect(crud.error.value).toBe('');
    expect(fetcher).toHaveBeenLastCalledWith('/api/usuarios', expect.objectContaining({ headers: { Authorization: `Bearer ${loginToken}` } }));
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
    expect(fetcher).toHaveBeenCalledWith('/api/usuarios', expect.objectContaining({ headers: { Authorization: 'Bearer test-token' } }));
    fetcher.mockResolvedValueOnce(operator);
    await crud.save({ correo: operator.correo, password: 'password123', rol: 'OPERATOR' });
    crud.rol.value = 'OPERATOR';
    crud.search.value = ' OPERACIONES ';
    expect(crud.filteredUsers.value).toEqual([operator]);
    fetcher.mockResolvedValueOnce({ ...operator, rol: 'ADMIN' });
    await crud.save({ correo: operator.correo, password: '', rol: 'ADMIN' }, operator.id);
    expect(fetcher).toHaveBeenLastCalledWith(`/api/usuarios/${operator.id}`, expect.objectContaining({ method: 'PATCH', body: { correo: operator.correo, rol: 'ADMIN', password: undefined } }));
    expect(crud.filteredUsers.value).toEqual([]);
    fetcher.mockResolvedValueOnce(undefined);
    await crud.remove(operator);
    expect(crud.usuarios.value).toEqual([account]);
    await expect(crud.remove(account)).rejects.toThrow('propia cuenta');
  });
  it('conserva los datos ante un conflicto y libera el estado de guardado', async () => {
    const crud = useUsers();
    crud.usuarios.value = [account];
    fetcher.mockRejectedValueOnce({ statusCode: 409 });
    await expect(crud.save({ correo: account.correo, password: 'password123', rol: 'ADMIN' })).rejects.toThrow('otra cuenta');
    expect(crud.usuarios.value).toEqual([account]);
    expect(crud.saving.value).toBe(false);
  });
  it('rechaza formularios antes de enviarlos y respuestas incompatibles', async () => {
    const crud = useUsers();
    await expect(crud.save({ correo: 'bad', password: '', rol: 'ADMIN' })).rejects.toThrow();
    expect(fetcher).not.toHaveBeenCalled();
    fetcher.mockResolvedValueOnce(account).mockResolvedValueOnce([{ ...operator, rol: 'ROOT' }]);
    await crud.load();
    expect(crud.error.value).not.toBe('');
    expect(crud.usuarios.value).toEqual([]);
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
