import 'dotenv/config';
import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(5000),
  MONGO_URI: z.string().min(1).default('mongodb://127.0.0.1:27017/comeback_os'),
  JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET must be at least 32 chars'),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET must be at least 32 chars'),
  ACCESS_TOKEN_TTL: z.string().default('15m'),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().default(30),
  CLIENT_URL: z.string().default('http://localhost:5173'),
  ALLOW_REGISTRATION: z
    .string()
    .default('true')
    .transform((v) => v === 'true'),
  COOKIE_SECURE: z
    .string()
    .default('false')
    .transform((v) => v === 'true'),
  APP_TIMEZONE: z.string().default('Asia/Kolkata'),
  /** number of proxies in front of the API (Render = 1, Render behind Cloudflare = 2) */
  TRUST_PROXY: z.coerce.number().int().min(0).max(5).default(1),
  /** built frontend to serve from the API (single-origin deploy). Empty = don't serve. */
  FRONTEND_DIST: z.string().default(''),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error('❌ Invalid environment variables:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
export const isProd = env.NODE_ENV === 'production';
