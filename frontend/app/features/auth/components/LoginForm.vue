<script setup lang="ts">
import * as validate from "zod";
import type { FormSubmitEvent, AuthFormField } from "@nuxt/ui";

interface Props {
  hasError?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  hasError: false,
});

const fields: AuthFormField[] = [
  {
    name: "email",
    type: "email",
    label: "Email",
    placeholder: "Enter your email",
    required: true,
    size: "xl",
  },
  {
    name: "password",
    label: "Password",
    type: "password",
    placeholder: "Enter your password",
    required: true,
    size: "xl",
  },
  {
    name: "remember",
    label: "Remember me",
    type: "checkbox",
  },
];

const schema = validate.object({
  email: validate.email("Invalid email"),
  password: validate
    .string("Password is required")
    .min(8, "Must be at least 8 characters"),
});

type Schema = validate.output<typeof schema>;

function onSubmit(payload: FormSubmitEvent<Schema>) {
  console.log("Submitted", payload);
}
</script>

<template>
  <div class="flex flex-col items-center justify-center gap-4 p-4">
    <UPageCard spotlight class="w-full max-w-xl p-4">
      <UAuthForm
        :schema="schema"
        :fields="fields"
        title="Acceso Restringido"
        icon="i-lucide-lock"
        :submit="{
          label: 'Autenticarse',
          variant: 'subtle',
          class: 'btn-hud-primary h-12 text-lg',
        }"
        @submit="onSubmit"
      >
        <template #description>
          Debés ser administrador para acceder al panel de admin.
        </template>
        <template #password-hint>
          <ULink to="#" class="text-primary font-medium" tabindex="-1"
            >Forgot password?</ULink
          >
        </template>
        <template #validation>
          <UAlert
            v-if="hasError"
            color="error"
            icon="i-lucide-info"
            title="Error signing in"
          />
        </template>
        <template #footer>
          Volver a la página de
          <ULink to="#" class="text-primary font-medium">Bienvenida</ULink>.
        </template>
      </UAuthForm>
    </UPageCard>
  </div>
</template>
