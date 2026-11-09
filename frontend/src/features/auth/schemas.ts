import { z } from 'zod';

export const passwordRule = z.string().min(8, 'At least 8 characters').regex(/[A-Za-z]/, 'Include a letter').regex(/\d/, 'Include a number');
export const loginSchema = z.object({ email: z.string().email('Enter a valid email'), password: z.string().min(1, 'Enter your password') });
export const registerSchema = z.object({ name: z.string().trim().min(2, 'At least 2 characters'), email: z.string().email('Enter a valid email'), password: passwordRule });
export const forgotSchema = z.object({ email: z.string().email('Enter a valid email') });
export const resetSchema = z.object({ password: passwordRule, confirm: z.string() }).refine((v) => v.password === v.confirm, { message: 'Passwords do not match', path: ['confirm'] });
