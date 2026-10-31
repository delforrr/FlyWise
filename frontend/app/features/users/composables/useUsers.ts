import { authService } from '../../../services/authService';
import { userService } from '../../../services/userService';
import { useAuth } from '../../auth/composables/useAuth';
import { computed, ref } from 'vue';
import { ZodError } from 'zod';
import { createUserSchema, updateUserSchema, userSchema, type ManagedUser, type UserForm } from '../schemas/userSchemas';

export function useUsers() {
  const { user: sessionUser, authenticatedRequest } = useAuth();
  const usuarios = ref<ManagedUser[]>([]);
  const currentUser = ref<ManagedUser | null>(null);
  const loading = ref(true);
  const saving = ref(false);
  const error = ref('');
  const search = ref('');
  const rol = ref('all');
  const filteredUsers = computed(() => usuarios.value.filter(user =>
    user.correo.toLowerCase().includes(search.value.trim().toLowerCase()) &&
    (rol.value === 'all' || user.rol === rol.value),
  ));

  async function request(action: (accessToken: string | null) => Promise<unknown>) {
    try {
      return await authenticatedRequest(action);
    } catch (cause: unknown) {
      const estado = (cause as { statusCode?: number }).statusCode;
      if (estado === 409) throw new Error('Ese correo ya pertenece a otra cuenta.');
      if (estado === 403) throw new Error('No tenés permiso para realizar esta acción.');
      if (estado === 404) throw new Error('La cuenta ya no existe. Actualizá el listado.');
      if (cause instanceof Error && !estado) throw cause;
      throw new Error('No pudimos completar la solicitud. Intentá nuevamente.');
    }
  }

  async function load() {
    loading.value = true;
    error.value = '';
    try {
      const [profile, rows] = await Promise.all([request(token => authService.getProfile(token)), request(token => userService.list(token))]);
      currentUser.value = userSchema.parse(profile);
      sessionUser.value = currentUser.value;
      usuarios.value = userSchema.array().parse(rows);
    } catch (cause: unknown) {
      error.value = cause instanceof ZodError ? 'La API devolvió datos de usuarios incompatibles.' : cause instanceof Error ? cause.message : 'No pudimos cargar los usuarios.';
    } finally {
      loading.value = false;
    }
  }

  async function save(form: UserForm, id?: string) {
    if (saving.value) return false;
    saving.value = true;
    try {
      const body = (id ? updateUserSchema : createUserSchema).parse(form);
      const user = userSchema.parse(await request(token => id ? userService.update(token, id, body) : userService.create(token, body)));
      if (id) usuarios.value = usuarios.value.map(row => row.id === id ? user : row);
      else usuarios.value.unshift(user);
      if (id === currentUser.value?.id) {
        currentUser.value = user;
        sessionUser.value = user;
      }
      return true;
    } finally {
      saving.value = false;
    }
  }

  async function remove(user: ManagedUser) {
    if (saving.value) return false;
    if (user.id === currentUser.value?.id) throw new Error('No podés eliminar tu propia cuenta desde esta pantalla.');
    saving.value = true;
    try {
      await request(token => userService.remove(token, user.id));
      usuarios.value = usuarios.value.filter(row => row.id !== user.id);
      return true;
    } finally {
      saving.value = false;
    }
  }

  return { usuarios, currentUser, loading, saving, error, search, rol, filteredUsers, load, save, remove };
}
