<script setup lang="ts">
import UserFormModal from "~/features/users/components/UserFormModal.vue";
import { useUsers } from "~/features/users/composables/useUsers";
import type {
  ManagedUser,
  UserForm,
} from "~/features/users/schemas/userSchemas";

definePageMeta({
  layout: "admin",
});
useSeoMeta({ title: "Usuarios · FlyWise" });

const {
  usuarios,
  currentUser,
  loading,
  saving,
  error,
  search,
  rol,
  filteredUsers,
  load,
  save,
  remove,
} = useUsers();
const formOpen = ref(false);
const editing = ref<ManagedUser | null>(null);
const deleting = ref<ManagedUser | null>(null);
const mutationError = ref("");
const notice = ref("");
const page = ref(1);
const pageSize = 10;
const pageCount = computed(() =>
  Math.max(1, Math.ceil(filteredUsers.value.length / pageSize)),
);
const rows = computed(() =>
  filteredUsers.value.slice((page.value - 1) * pageSize, page.value * pageSize),
);
watch([search, rol], () => {
  page.value = 1;
});
watch(pageCount, (count) => {
  page.value = Math.min(page.value, count);
});
onMounted(load);

function openForm(user: ManagedUser | null = null) {
  editing.value = user;
  mutationError.value = "";
  formOpen.value = true;
}

async function submit(form: UserForm) {
  mutationError.value = "";
  try {
    if (await save(form, editing.value?.id)) {
      notice.value = editing.value ? "Cambios guardados." : "Usuario creado.";
      formOpen.value = false;
    }
  } catch (cause: unknown) {
    mutationError.value =
      cause instanceof Error ? cause.message : "No pudimos guardar el usuario.";
  }
}

function confirmDelete(user: ManagedUser) {
  mutationError.value = "";
  deleting.value = user;
}

async function deleteUser() {
  if (!deleting.value) return;
  mutationError.value = "";
  try {
    if (await remove(deleting.value)) {
      notice.value = "Usuario eliminado.";
      deleting.value = null;
    }
  } catch (cause: unknown) {
    mutationError.value =
      cause instanceof Error
        ? cause.message
        : "No pudimos eliminar el usuario.";
  }
}

function formatDate(date?: string) {
  return date
    ? new Intl.DateTimeFormat("es-AR", {
        dateStyle: "medium",
        timeZone: "America/Argentina/Buenos_Aires",
      }).format(new Date(date))
    : "—";
}
</script>

<template>
  <div class="usuarios-screen space-y-6">
    <header class="flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 class="text-2xl font-semibold tracking-tight">Usuarios</h1>
        <p class="mt-2 text-sm text-text-muted">
          Cuentas y roles del equipo de operaciones de FlyWise.
        </p>
      </div>
      <UButton
        color="neutral"
        icon="i-lucide-plus"
        :disabled="loading || !!error"
        @click="openForm()"
        >Crear usuario</UButton
      >
    </header>

    <output v-if="notice" class="text-sm text-text-main">
      {{ notice }}
    </output>

    <!-- Una grilla: (ancho disponible - 24px) = listado flexible + guía de 272px. -->
    <div class="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_272px]">
      <section
        aria-label="Directorio de usuarios"
        class="min-w-0 rounded-lg bg-surface-card border border-border-subtle/50"
      >
        <div class="flex flex-wrap items-center justify-between gap-3 p-5">
          <h2 class="text-base font-semibold">
            Directorio
            <span
              v-if="!loading && !error"
              class="ml-2 text-sm font-normal text-text-muted tabular-nums"
              >{{ usuarios.length }} cuentas</span
            >
          </h2>
          <UButton
            color="neutral"
            variant="ghost"
            icon="i-lucide-refresh-cw"
            :loading="loading"
            :disabled="saving"
            @click="load"
            >Actualizar</UButton
          >
        </div>
        <div class="flex flex-col gap-3 px-5 pb-5 sm:flex-row">
          <UInput
            v-model="search"
            aria-label="Buscar usuarios por correo"
            icon="i-lucide-search"
            placeholder="Buscar por correo…"
            class="min-w-0 flex-1"
            :disabled="loading"
          />
          <USelect
            v-model="rol"
            aria-label="Filtrar por rol"
            :items="[
              { label: 'Todos los roles', value: 'all' },
              { label: 'Administradores', value: 'ADMIN' },
              { label: 'Operadores', value: 'OPERATOR' },
            ]"
            class="sm:w-48"
            :disabled="loading"
          />
        </div>

        <output
          v-if="loading"
          class="px-5 py-12 text-center text-sm text-text-muted"
        >
          Cargando usuarios…
        </output>
        <div
          v-else-if="error"
          role="alert"
          class="space-y-3 px-5 py-10 text-center"
        >
          <p class="text-sm text-error">{{ error }}</p>
          <UButton color="neutral" variant="outline" @click="load"
            >Reintentar</UButton
          >
        </div>
        <div v-else-if="!rows.length" class="space-y-3 px-5 py-12 text-center">
          <h3 class="text-base font-medium">
            {{ usuarios.length ? "Sin coincidencias" : "Todavía no hay usuarios" }}
          </h3>
          <p class="text-sm text-text-muted">
            {{
              usuarios.length
                ? "Probá con otro correo o cambiá el rol."
                : "Creá una cuenta para sumar a tu equipo de operaciones."
            }}
          </p>
          <UButton
            v-if="usuarios.length"
            color="neutral"
            variant="outline"
            @click="
              search = '';
              rol = 'all';
            "
            >Limpiar filtros</UButton
          >
        </div>
        <template v-else>
          <table class="w-full text-left text-sm">
            <caption class="sr-only">
              Cuentas registradas en FlyWise y sus roles
            </caption>
            <thead class="text-xs text-text-muted">
              <tr>
                <th scope="col" class="px-5 pb-3 font-medium">Usuario</th>
                <th
                  scope="col"
                  class="hidden px-3 pb-3 font-medium md:table-cell"
                >
                  Rol
                </th>
                <th
                  scope="col"
                  class="hidden px-3 pb-3 text-right font-medium lg:table-cell"
                >
                  Alta
                </th>
                <th scope="col" class="px-5 pb-3 text-right font-medium">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="user in rows"
                :key="user.id"
                class="border-t border-border-subtle/40"
              >
                <td class="w-full max-w-0 px-5 py-4 md:w-2/5">
                  <div class="flex items-center gap-3">
                    <span
                      class="hidden h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-accent text-xs font-medium sm:flex"
                      aria-hidden="true"
                      >{{ user.correo.slice(0, 2).toUpperCase() }}</span
                    >
                    <div class="min-w-0">
                      <p
                        class="break-all font-medium md:truncate"
                        :title="user.correo"
                      >
                        {{ user.correo }}
                      </p>
                      <span
                        v-if="user.id === currentUser?.id"
                        class="text-xs text-primary"
                        >Tu cuenta</span
                      >
                      <p class="mt-1 text-xs text-text-muted md:hidden">
                        {{
                          user.rol === "ADMIN" ? "Administrador" : "Operador"
                        }}
                      </p>
                    </div>
                  </div>
                </td>
                <td
                  class="hidden whitespace-nowrap px-3 py-4 text-text-muted md:table-cell"
                >
                  {{ user.rol === "ADMIN" ? "Administrador" : "Operador" }}
                </td>
                <td
                  class="hidden whitespace-nowrap px-3 py-4 text-right text-text-muted tabular-nums lg:table-cell"
                >
                  {{ formatDate(user.creadoEn) }}
                </td>
                <td class="w-24 whitespace-nowrap px-3 py-4">
                  <div class="flex items-center justify-end gap-1">
                    <UButton
                      color="neutral"
                      variant="ghost"
                      icon="i-lucide-pencil"
                      :aria-label="`Editar ${user.correo}`"
                      :disabled="saving"
                      @click="openForm(user)"
                    />
                    <UButton
                      color="neutral"
                      variant="ghost"
                      icon="i-lucide-trash-2"
                      :aria-label="`Eliminar ${user.correo}`"
                      :title="
                        user.id === currentUser?.id
                          ? 'No podés eliminar tu propia cuenta'
                          : 'Eliminar usuario'
                      "
                      :disabled="saving || user.id === currentUser?.id"
                      @click="confirmDelete(user)"
                    />
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
          <div
            class="flex flex-wrap items-center justify-between gap-3 border-t border-border-subtle/40 px-5 py-4 text-xs text-text-muted"
          >
            <span class="tabular-nums"
              >{{ (page - 1) * pageSize + 1 }}–{{
                Math.min(page * pageSize, filteredUsers.length)
              }}
              de {{ filteredUsers.length }} usuarios</span
            >
            <div v-if="pageCount > 1" class="flex gap-2">
              <UButton
                color="neutral"
                variant="outline"
                size="sm"
                :disabled="page === 1"
                aria-label="Página anterior"
                @click="page--"
                >Anterior</UButton
              >
              <UButton
                color="neutral"
                variant="outline"
                size="sm"
                :disabled="page === pageCount"
                aria-label="Página siguiente"
                @click="page++"
                >Siguiente</UButton
              >
            </div>
          </div>
        </template>
      </section>

      <aside
        class="space-y-6 rounded-lg bg-surface-accent/50 p-5"
        aria-label="Roles de operaciones"
      >
        <div>
          <UIcon
            name="i-lucide-shield-check"
            class="mb-3 size-5 text-text-muted"
          />
          <h2 class="text-base font-semibold">Roles de operaciones</h2>
          <p class="mt-2 text-sm text-text-muted">
            Cada cuenta tiene un rol asignado en la plataforma.
          </p>
        </div>
        <div>
          <h3 class="text-sm font-medium">Administrador</h3>
          <p class="mt-2 text-sm text-text-muted">
            Perfil administrativo del equipo FlyWise.
          </p>
        </div>
        <div>
          <h3 class="text-sm font-medium">Operador</h3>
          <p class="mt-2 text-sm text-text-muted">
            Perfil de trabajo para la operación diaria.
          </p>
        </div>
      </aside>
    </div>

    <UserFormModal
      v-model:open="formOpen"
      :user="editing"
      :saving="saving"
      :error="mutationError"
      @save="submit"
    />
    <UModal
      :open="!!deleting"
      title="Eliminar usuario"
      description="Esta acción es permanente y elimina la cuenta registrada."
      :dismissible="!saving"
      :close="!saving"
      @update:open="
        (value) => {
          if (!value) deleting = null;
        }
      "
    >
      <template #body>
        <p class="text-sm wrap-break-word">
          Vas a eliminar la cuenta <strong>{{ deleting?.correo }}</strong
          >. Para volver a usarla, será necesario crearla otra vez.
        </p>
        <UAlert
          v-if="mutationError"
          color="error"
          variant="soft"
          :description="mutationError"
          class="mt-4"
          role="alert"
        />
      </template>
      <template #footer>
        <div class="flex w-full justify-end gap-3">
          <UButton
            color="neutral"
            variant="outline"
            :disabled="saving"
            @click="deleting = null"
            >Cancelar</UButton
          >
          <UButton color="error" :loading="saving" @click="deleteUser"
            >Eliminar usuario</UButton
          >
        </div>
      </template>
    </UModal>
  </div>
</template>
