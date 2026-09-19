<script setup lang="ts">
import { z } from "zod";
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
    label: "Correo Electrónico",
    placeholder: "admin@flywise.aero",
    required: true,
    size: "xl",
    defaultValue: "",
  },
  {
    name: "password",
    label: "Contraseña",
    type: "password",
    placeholder: "••••••••",
    required: true,
    size: "xl",
    defaultValue: "",
  },
  {
    name: "remember",
    label: "Recordar sesión en este equipo",
    type: "checkbox",
    defaultValue: false,
  },
];

const schema = z.object({
  email: z
    .string()
    .min(1, "El correo electrónico es requerido")
    .email("Formato de correo electrónico inválido"),
  password: z
    .string()
    .min(1, "La contraseña es requerida")
    .min(8, "La contraseña debe tener al menos 8 caracteres"),
  remember: z.boolean().optional(),
});

type Schema = z.output<typeof schema>;

function onSubmit(payload: FormSubmitEvent<Schema>) {
  console.log("Submitted login credentials:", payload);
}
</script>

<template>
  <PaperBezel class="max-w-xl" core-class="p-4 sm:p-7">
    <UAuthForm
          :schema="schema"
          :fields="fields"
          :validate-on="['blur', 'change']"
          title="Acceso Restringido"
          icon="i-lucide-shield-lock"
          :submit="{
            label: 'Autenticarse',
            variant: 'subtle',
            class: 'btn-hud-primary h-12 sm:h-13 text-base sm:text-lg font-semibold w-full justify-center shadow-lg active:scale-[0.98]',
          }"
          @submit="onSubmit"
        >
          <template #description>
            Acceso exclusivo para administradores y auditores de telemetría de FlyWise.
          </template>

          <template #password-hint>
            <ULink
              to="#"
              class="text-xs text-primary hover:underline font-semibold"
              tabindex="-1"
            >
              ¿Olvidaste tu contraseña?
            </ULink>
          </template>

          <template #validation>
            <UAlert
              v-if="hasError"
              color="error"
              icon="i-lucide-alert-triangle"
              title="Error de Autenticación"
              description="Las credenciales ingresadas son incorrectas o no cuentan con privilegios administrativos."
              class="mb-3"
            />
          </template>

          <template #footer>
            <div class="text-xs text-text-muted text-center pt-2">
              Volver a la página de
              <ULink to="/" class="text-primary hover:underline font-semibold">
                Bienvenida
              </ULink>.
            </div>
          </template>
        </UAuthForm>
  </PaperBezel>
</template>
