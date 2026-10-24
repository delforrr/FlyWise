import type { ManagedUser } from '../features/users/schemas/userSchemas';

function request(token: string | null, path = '', method: 'GET' | 'POST' | 'PATCH' | 'DELETE' = 'GET', body?: object) {
  return $fetch<unknown>(`/api/users${path}`, {
    method, body, headers: { Authorization: `Bearer ${token}` },
  });
}

export const userService = {
  list: (token: string | null) => request(token),
  create: (token: string | null, body: object) => request(token, '', 'POST', body),
  update: (token: string | null, id: ManagedUser['id'], body: object) => request(token, `/${id}`, 'PATCH', body),
  remove: (token: string | null, id: ManagedUser['id']) => request(token, `/${id}`, 'DELETE'),
};
