import request from 'supertest';
import mongoose from 'mongoose';
import { createApp } from '../src/app.js';

export const app = createApp();

export async function connectTestDB() {
  if (mongoose.connection.readyState !== 1) await mongoose.connect(process.env.MONGO_URI!);
}
export async function resetDB() {
  await mongoose.connection.db!.dropDatabase();
  await Promise.all(Object.values(mongoose.models).map((m) => m.syncIndexes()));
}
export async function closeDB() {
  await mongoose.disconnect();
}

let n = 0;
export async function registerUser(overrides: Partial<{ name: string; email: string; password: string }> = {}) {
  n++;
  const body = { name: 'Test User', email: `user${n}_${Date.now()}@test.dev`, password: 'Passw0rd!', ...overrides };
  const res = await request(app).post('/api/auth/register').send(body);
  const cookie = ([] as string[]).concat(res.headers['set-cookie'] ?? []);
  return { res, body, token: res.body?.data?.accessToken as string, cookie };
}

export const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
