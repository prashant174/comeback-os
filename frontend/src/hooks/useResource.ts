import { useMutation, useQuery, useQueryClient, type QueryKey } from '@tanstack/react-query';
import { toast } from 'sonner';
import { apiError } from '@/lib/api';
import { resource, type Params } from '@/lib/resource';
import { useSettings } from './queries';
import { todayIn } from '@/lib/date';

/** List hook for a CRUD resource. Key = [path, params]. */
export function useList<T>(path: string, params: Params = {}, enabled = true) {
  return useQuery({ queryKey: [path, params], queryFn: () => resource<T>(path).list(params), enabled });
}

/** create / update / remove with toasts + cache invalidation of the resource and any extra keys. */
export function useResourceMutations<T>(path: string, opts: { invalidate?: QueryKey[]; noun?: string } = {}) {
  const qc = useQueryClient();
  const r = resource<T>(path);
  const done = () => {
    qc.invalidateQueries({ queryKey: [path] });
    qc.invalidateQueries({ queryKey: ['dashboard'] });
    for (const k of opts.invalidate ?? []) qc.invalidateQueries({ queryKey: k });
  };
  const noun = opts.noun ?? 'Item';
  return {
    create: useMutation({ mutationFn: (b: Record<string, unknown>) => r.create(b), onSuccess: () => { done(); toast.success(`${noun} added`); }, onError: (e) => toast.error(apiError(e)) }),
    update: useMutation({ mutationFn: ({ id, body }: { id: string; body: Record<string, unknown> }) => r.update(id, body), onSuccess: done, onError: (e) => toast.error(apiError(e)) }),
    remove: useMutation({ mutationFn: (id: string) => r.remove(id), onSuccess: () => { done(); toast.success(`${noun} deleted`); }, onError: (e) => toast.error(apiError(e)) }),
  };
}

/** Today's date key in the user's configured timezone. */
export function useToday() {
  const s = useSettings();
  return todayIn(s.data?.profile.personal.timezone || 'Asia/Kolkata');
}
