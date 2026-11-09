import { api, unwrap } from '@/lib/api';
import type { Dashboard, Habit, Preferences, Profile, WaterEntry } from '@/types';

type DeepPartial<T> = { [K in keyof T]?: T[K] extends object ? (T[K] extends unknown[] ? T[K] : DeepPartial<T[K]>) : T[K] };

export const dashboardApi = { get: () => unwrap<Dashboard>(api.get('/dashboard')) };

export const settingsApi = {
  get: () => unwrap<{ profile: Profile; preferences: Preferences }>(api.get('/settings')),
  updateProfile: (body: DeepPartial<Profile>) => unwrap<Profile>(api.patch('/settings/profile', body)),
  updatePreferences: (body: Partial<Preferences>) => unwrap<Preferences>(api.patch('/settings/preferences', body)),
  reset: (section: 'profile' | 'preferences' | 'habits' | 'all') => unwrap(api.post('/settings/reset', { section })),
};

export type HabitInput = Pick<Habit, 'name' | 'category' | 'frequency' | 'daysOfWeek'> & { description?: string; icon?: string };

export const habitsApi = {
  list: (includeArchived = false) => unwrap<Habit[]>(api.get('/habits', { params: includeArchived ? { includeArchived: 'true' } : {} })),
  create: (body: HabitInput) => unwrap<Habit>(api.post('/habits', body)),
  update: (id: string, body: Partial<HabitInput> & { archived?: boolean }) => unwrap<Habit>(api.patch(`/habits/${id}`, body)),
  remove: (id: string) => unwrap(api.delete(`/habits/${id}`)),
  toggle: (id: string, completed: boolean, date?: string) => unwrap(api.post(`/habits/${id}/log`, { completed, ...(date ? { date } : {}) })),
  reorder: (ids: string[]) => unwrap(api.put('/habits/reorder', { ids })),
  heatmap: (days = 91) => unwrap<{ date: string; scheduled: number; done: number; ratio: number }[]>(api.get('/habits/heatmap', { params: { days } })),
};

export const waterApi = {
  day: (date?: string) => unwrap<{ date: string; totalMl: number; targetMl: number; entries: WaterEntry[] }>(api.get('/water', { params: date ? { date } : {} })),
  add: (amountMl: number) => unwrap<WaterEntry>(api.post('/water', { amountMl })),
  remove: (id: string) => unwrap(api.delete(`/water/${id}`)),
  history: (days = 14) => api.get('/water/history', { params: { days } }).then((r) => ({ rows: r.data.data as { date: string; totalMl: number }[], targetMl: r.data.meta.targetMl as number })),
};
