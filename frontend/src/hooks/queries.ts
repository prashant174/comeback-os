import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { dashboardApi, habitsApi, settingsApi, waterApi, type HabitInput } from '@/services/data.service';
import { apiError } from '@/lib/api';
import type { Dashboard, Habit } from '@/types';

export const keys = {
  dashboard: ['dashboard'] as const,
  habits: (archived = false) => ['habits', { archived }] as const,
  heatmap: ['habits', 'heatmap'] as const,
  water: ['water', 'today'] as const,
  waterHistory: (d: number) => ['water', 'history', d] as const,
  settings: ['settings'] as const,
};

export const useDashboard = () => useQuery({ queryKey: keys.dashboard, queryFn: dashboardApi.get });
export const useHabits = (archived = false) => useQuery({ queryKey: keys.habits(archived), queryFn: () => habitsApi.list(archived) });
export const useHeatmap = () => useQuery({ queryKey: keys.heatmap, queryFn: () => habitsApi.heatmap(91) });
export const useWaterToday = () => useQuery({ queryKey: keys.water, queryFn: () => waterApi.day() });
export const useWaterHistory = (days = 14) => useQuery({ queryKey: keys.waterHistory(days), queryFn: () => waterApi.history(days) });
export const useSettings = () => useQuery({ queryKey: keys.settings, queryFn: settingsApi.get });

/** Optimistically flips a habit in both the habits list and dashboard caches. */
export function useToggleHabit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, completed }: { id: string; completed: boolean }) => habitsApi.toggle(id, completed),
    onMutate: async ({ id, completed }) => {
      await qc.cancelQueries({ queryKey: ['habits'] });
      await qc.cancelQueries({ queryKey: keys.dashboard });
      const prevHabits = qc.getQueryData<Habit[]>(keys.habits(false));
      const prevDash = qc.getQueryData<Dashboard>(keys.dashboard);
      qc.setQueryData<Habit[]>(keys.habits(false), (old) => old?.map((h) => (h._id === id ? { ...h, completedToday: completed } : h)));
      qc.setQueryData<Dashboard>(keys.dashboard, (old) => {
        if (!old) return old;
        const items = old.habits.items.map((h) => (h._id === id ? { ...h, completedToday: completed } : h));
        return { ...old, habits: { ...old.habits, items, done: items.filter((h) => h.completedToday).length } };
      });
      return { prevHabits, prevDash };
    },
    onError: (e, _v, ctx) => {
      if (ctx?.prevHabits) qc.setQueryData(keys.habits(false), ctx.prevHabits);
      if (ctx?.prevDash) qc.setQueryData(keys.dashboard, ctx.prevDash);
      toast.error(apiError(e, 'Could not update habit'));
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['habits'] });
      qc.invalidateQueries({ queryKey: keys.dashboard });
    },
  });
}

export function useHabitMutations() {
  const qc = useQueryClient();
  const done = () => { qc.invalidateQueries({ queryKey: ['habits'] }); qc.invalidateQueries({ queryKey: keys.dashboard }); };
  return {
    create: useMutation({ mutationFn: (b: HabitInput) => habitsApi.create(b), onSuccess: () => { done(); toast.success('Habit added'); }, onError: (e) => toast.error(apiError(e)) }),
    update: useMutation({ mutationFn: ({ id, body }: { id: string; body: Partial<HabitInput> & { archived?: boolean } }) => habitsApi.update(id, body), onSuccess: done, onError: (e) => toast.error(apiError(e)) }),
    remove: useMutation({ mutationFn: (id: string) => habitsApi.remove(id), onSuccess: () => { done(); toast.success('Habit deleted'); }, onError: (e) => toast.error(apiError(e)) }),
    reorder: useMutation({ mutationFn: (ids: string[]) => habitsApi.reorder(ids), onSuccess: done, onError: (e) => toast.error(apiError(e)) }),
  };
}

export function useWaterMutations() {
  const qc = useQueryClient();
  const done = () => { qc.invalidateQueries({ queryKey: ['water'] }); qc.invalidateQueries({ queryKey: keys.dashboard }); };
  return {
    add: useMutation({
      mutationFn: (ml: number) => waterApi.add(ml),
      onMutate: async (ml) => {
        await qc.cancelQueries({ queryKey: keys.dashboard });
        const prev = qc.getQueryData<Dashboard>(keys.dashboard);
        qc.setQueryData<Dashboard>(keys.dashboard, (o) => (o ? { ...o, water: { ...o.water, totalMl: o.water.totalMl + ml } } : o));
        return { prev };
      },
      onError: (e, _v, ctx) => { if (ctx?.prev) qc.setQueryData(keys.dashboard, ctx.prev); toast.error(apiError(e, 'Could not add water')); },
      onSettled: done,
    }),
    remove: useMutation({ mutationFn: (id: string) => waterApi.remove(id), onSuccess: done, onError: (e) => toast.error(apiError(e)) }),
  };
}
