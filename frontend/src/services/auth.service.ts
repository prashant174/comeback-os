import { api, unwrap } from '@/lib/api';
import type { User } from '@/types';

type Session = { user: User; accessToken: string };

export const authApi = {
  config: () => unwrap<{ registrationOpen: boolean; firstRun: boolean }>(api.get('/auth/config')),
  login: (body: { email: string; password: string }) => unwrap<Session>(api.post('/auth/login', body)),
  register: (body: { name: string; email: string; password: string }) => unwrap<Session>(api.post('/auth/register', body)),
  logout: () => api.post('/auth/logout'),
  me: () => unwrap<User>(api.get('/auth/me')),
  updateMe: (body: { name: string }) => unwrap<User>(api.patch('/auth/me', body)),
  changePassword: (body: { currentPassword: string; newPassword: string }) => unwrap<{ message: string }>(api.post('/auth/change-password', body)),
  forgot: (email: string) => unwrap<{ message: string; devResetLink?: string }>(api.post('/auth/forgot-password', { email })),
  reset: (token: string, password: string) => unwrap<{ reset: boolean }>(api.post('/auth/reset-password', { token, password })),
};
