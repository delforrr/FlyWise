<script setup lang="ts">
import type { FormSubmitEvent } from '@nuxt/ui';
import type { z } from 'zod';
import { createUserSchema, updateUserSchema, type ManagedUser, type UserForm } from '../schemas/userSchemas';

const props = defineProps<{ open: boolean; user: ManagedUser | null; saving: boolean; error: string }>();
const emit = defineEmits<{ 'update:open': [open: boolean]; save: [data: UserForm] }>();
const state = reactive<UserForm>({ correo: '', password: '', rol: 'OPERATOR' });
watch(() => props.open, open => {
  if (open) Object.assign(state, { correo: props.user?.correo ?? '', password: '', rol: props.user?.rol ?? 'OPERATOR' });
  else state.password = '';
});

function submit(event: FormSubmitEvent<z.output<typeof updateUserSchema>>) {
  emit('save', { ...event.data, password: event.data.password ?? '' });
}
</script>

<template>
  <UModal :open="open" :title="user ? 'Editar usuario' : 'Crear usuario'" description="Datos de acceso a FlyWise." :dismissible="!saving" :close="!saving" @update:open="emit('update:open', $event)">
    <template #body>
      <UForm :schema="user ? updateUserSchema : createUserSchema" :state="state" class="space-y-5" @submit="submit">
        <UAlert v-if="error" color="error" variant="soft" :description="error" role="alert" />
        <UFormField label="Correo electrónico" name="correo" required>
          <UInput v-model="state.correo" type="email" autocomplete="off" placeholder="nombre@flywise.com" class="w-full" :disabled="saving" autofocus />
        </UFormField>
        <UFormField :label="user ? 'Nueva contraseña' : 'Contraseña'" name="password" :required="!user" :help="user ? 'Dejá el campo vacío para conservar la actual. Mínimo 8 caracteres.' : 'Mínimo 8 caracteres. Solo letras y números.'">
          <UInput v-model="state.password" type="password" autocomplete="new-password" class="w-full" :disabled="saving" />
        </UFormField>
        <UFormField label="Rol" name="rol" required>
          <USelect v-model="state.rol" :items="[{ label: 'Operador', value: 'OPERATOR' }, { label: 'Administrador', value: 'ADMIN' }]" class="w-full" :disabled="saving" />
        </UFormField>
        <div class="flex justify-end gap-3 pt-2">
          <UButton color="neutral" variant="outline" :disabled="saving" @click="emit('update:open', false)">Cancelar</UButton>
          <UButton type="submit" color="neutral" :loading="saving">{{ user ? 'Guardar cambios' : 'Crear usuario' }}</UButton>
        </div>
      </UForm>
    </template>
  </UModal>
</template>
