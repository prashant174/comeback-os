import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as DM from '@radix-ui/react-dropdown-menu';
import { Bell, CheckCheck } from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { AppNotification } from '@/types';
import { showSystemNotification } from '@/lib/pwa';

const ago = (iso: string) => {
  const m = Math.round((Date.now() - Date.parse(iso)) / 60000);
  return m < 1 ? 'just now' : m < 60 ? `${m}m ago` : m < 1440 ? `${Math.round(m / 60)}h ago` : `${Math.round(m / 1440)}d ago`;
};
export const BROWSER_NOTIF_KEY = 'cbos-browser-notifs';

/**
 * Polls in-app notifications every minute. If the user enabled browser
 * notifications (Settings → Reminders) and granted permission, new unread
 * ones are also shown as system notifications — only while the app is open.
 */
export function NotificationBell() {
  const qc = useQueryClient();
  const nav = useNavigate();
  const seen = useRef<Set<string> | null>(null);
  const q = useQuery({
    queryKey: ['notifications'],
    queryFn: () => api.get('/notifications').then((r) => ({ items: r.data.data as AppNotification[], unread: r.data.meta.unread as number })),
    refetchInterval: 60_000,
    refetchIntervalInBackground: true,
  });
  const readAll = useMutation({ mutationFn: () => api.post('/notifications/read-all'), onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }) });
  const readOne = useMutation({ mutationFn: (id: string) => api.patch(`/notifications/${id}/read`), onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }) });

  useEffect(() => {
    const items = q.data?.items;
    if (!items) return;
    if (seen.current === null) { seen.current = new Set(items.map((n) => n._id)); return; } // don't replay old ones on load
    const fresh = items.filter((n) => !n.readAt && !seen.current!.has(n._id));
    fresh.forEach((n) => seen.current!.add(n._id));
    let enabled = false;
    try { enabled = localStorage.getItem(BROWSER_NOTIF_KEY) === '1'; } catch { /* ignore */ }
    if (enabled) for (const n of fresh) showSystemNotification(n.title, n.body, n._id, n.link ?? '/');
  }, [q.data]);

  const unread = q.data?.unread ?? 0;
  return (
    <DM.Root>
      <DM.Trigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label={unread ? `${unread} unread notifications` : 'Notifications'}>
          <Bell className="h-[18px] w-[18px]" />
          {unread > 0 && <span className="absolute top-1 right-1 min-w-4 h-4 px-1 rounded-full bg-danger text-white text-[10px] font-semibold grid place-items-center num">{unread > 9 ? '9+' : unread}</span>}
        </Button>
      </DM.Trigger>
      <DM.Portal>
        <DM.Content align="end" sideOffset={8} className="z-50 w-[min(92vw,360px)] panel shadow-xl p-0 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-line">
            <p className="text-sm font-semibold">Notifications</p>
            {unread > 0 && <button onClick={() => readAll.mutate()} className="text-xs text-leaf flex items-center gap-1 hover:underline"><CheckCheck className="h-3.5 w-3.5" />Mark all read</button>}
          </div>
          <div className="max-h-[60vh] overflow-y-auto">
            {!q.data?.items.length ? <p className="px-4 py-8 text-sm text-muted text-center">No notifications yet. Reminders you set show up here.</p> : q.data.items.map((n) => (
              <DM.Item key={n._id} onSelect={() => { if (!n.readAt) readOne.mutate(n._id); if (n.link) nav(n.link); }}
                className={cn('flex gap-3 px-4 py-3 border-b border-line last:border-0 outline-none cursor-pointer data-[highlighted]:bg-sunken', !n.readAt && 'bg-leaf-soft/40')}>
                <span className={cn('mt-1.5 h-2 w-2 rounded-full shrink-0', n.readAt ? 'bg-transparent' : 'bg-leaf')} />
                <div className="min-w-0"><p className="text-sm font-medium">{n.title}</p>{n.body && <p className="text-xs text-muted mt-0.5">{n.body}</p>}<p className="text-[11px] text-muted mt-1">{ago(n.createdAt)}</p></div>
              </DM.Item>
            ))}
          </div>
        </DM.Content>
      </DM.Portal>
    </DM.Root>
  );
}
