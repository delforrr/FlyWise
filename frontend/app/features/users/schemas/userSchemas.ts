import { z } from 'zod';

export const userRoleSchema = z.enum(['ADMIN', 'OPERATOR']);
const correo = z.string().trim().toLowerCase().email('Ingresá un correo válido.');
const password = z.string().trim().min(8, 'Usá al menos 8 caracteres.');

export const createUserSchema = z.object({
  correo,
  password: password.regex(/^[a-zA-Z0-9]+$/, 'Usá solo letras y números.'),
  rol: userRoleSchema,
});

export const updateUserSchema = z.object({
  correo,
  password: z.union([z.literal(''), password]).transform(value => value || undefined),
  rol: userRoleSchema,
});

export const userSchema = z.object({
  id: z.string().uuid(),
  correo: z.string().email(),
  rol: userRoleSchema,
  creadoEn: z.string().datetime().optional(),
});

export type ManagedUser = z.infer<typeof userSchema>;
export type UserForm = z.input<typeof createUserSchema>;
