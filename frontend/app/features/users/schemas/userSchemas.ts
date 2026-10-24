import { z } from 'zod';

export const userRoleSchema = z.enum(['ADMIN', 'OPERATOR']);
const email = z.string().trim().toLowerCase().email('Ingresá un correo válido.');
const password = z.string().trim().min(8, 'Usá al menos 8 caracteres.');

export const createUserSchema = z.object({
  email,
  password: password.regex(/^[a-zA-Z0-9]+$/, 'Usá solo letras y números.'),
  role: userRoleSchema,
});

export const updateUserSchema = z.object({
  email,
  password: z.union([z.literal(''), password]).transform(value => value || undefined),
  role: userRoleSchema,
});

export const userSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  role: userRoleSchema,
  createdAt: z.string().datetime().optional(),
});

export type ManagedUser = z.infer<typeof userSchema>;
export type UserForm = z.input<typeof createUserSchema>;
