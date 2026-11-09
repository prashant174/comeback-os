import { z } from 'zod';

const password = z
  .string()
  .min(8, 'At least 8 characters')
  .max(128)
  .regex(/[A-Za-z]/, 'Must contain a letter')
  .regex(/\d/, 'Must contain a number');

export const registerSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().email().max(160),
  password,
});
export const loginSchema = z.object({ email: z.string().trim().email(), password: z.string().min(1).max(128) });
export const forgotSchema = z.object({ email: z.string().trim().email() });
export const resetSchema = z.object({ token: z.string().min(20).max(200), password });
export const changePasswordSchema = z.object({ currentPassword: z.string().min(1), newPassword: password });
export const updateMeSchema = z.object({ name: z.string().trim().min(2).max(80) });
