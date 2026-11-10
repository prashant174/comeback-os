import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { toast } from 'sonner';
import { Ban, CheckCircle2, Copy, Download, KeyRound, LogOut, Megaphone, Search, ShieldCheck, Trash2, UserPlus } from 'lucide-react';
import { api, apiError } from '@/lib/api';
import { download, get } from '@/lib/resource';
import { Button } from '@/components/ui/button';
import { Field, Input, Select } from '@/components/ui/input';
import { Dialog } from '@/components/ui/dialog';
import { PageHeader, Skeleton, Switch } from '@/components/ui/misc';
import { Chip, PageTabs, Panel, Progress, Stat, TabPanel, axisTick, chartTooltip } from '@/components/ui/kit';
import { prettyDate } from '@/lib/date';
import { cn } from '@/lib/utils';

type Overview = {
  users: { total: number; admins: number; disabled: number; newLast7Days: number; activeLast7Days: number };
  storage: { usedBytes: number; limitBytes: number; pct: number; collections: { name: string; count: number; bytes: number }[] };
  server: { uptimeSec: number; node: string; rssMb: number; heapMb: number; env: string };
  settings: { registrationOpen: boolean; registrationSource: 'env' | 'admin'; announcement: { text: string; tone: 'info' | 'warning'; active: boolean } };
};
type AdminUser = { _id: string; name: string; email: string; role: string; isActive: boolean; createdAt: string; lastLoginAt: string | null; lastSeenAt: string | null; lastActivityAt: string | null; activeSessions: number; entries: number; photos: number; photoBytes: number };
type Audit = { _id: string; action: string; targetEmail: string | null; createdAt: string; admin: { email: string } | null; details: unknown };

const mb = (b: number) => (b >= 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.round(b / 1024)} KB`);
const ago = (iso: string | null) => {
  if (!iso) return 'never';
  const m = Math.round((Date.now() - Date.parse(iso)) / 60000);
  return m < 60 ? `${Math.max(1, m)}m ago` : m < 1440 ? `${Math.round(m / 60)}h ago` : `${Math.round(m / 1440)}d ago`;
};
const uptime = (s: number) => (s >= 86400 ? `${Math.floor(s / 86400)}d ${Math.floor((s % 86400) / 3600)}h` : s >= 3600 ? `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m` : `${Math.floor(s / 60)}m`);

function TempPasswordDialog({ data, onClose }: { data: { email: string; password: string } | null; onClose: () => void }) {
  return (
    <Dialog open={!!data} onOpenChange={(o) => !o && onClose()} title="Temporary password" description="Shown only once. Send it privately; they should change it in Settings → Account after logging in.">
      {data && (
        <div className="space-y-3">
          <p className="text-sm text-muted">{data.email}</p>
          <div className="flex gap-2">
            <code className="flex-1 rounded-xl bg-sunken px-3 py-2.5 font-mono text-sm select-all">{data.password}</code>
            <Button variant="outline" onClick={() => navigator.clipboard.writeText(`Comeback OS login\nEmail: ${data.email}\nPassword: ${data.password}\n${location.origin}`).then(() => toast.success('Copied'))}><Copy className="h-4 w-4" />Copy</Button>
          </div>
          <div className="flex justify-end"><Button onClick={onClose}>Done</Button></div>
        </div>
      )}
    </Dialog>
  );
}

/* ---------------- Overview ---------------- */
function OverviewTab() {
  const o = useQuery({ queryKey: ['admin-overview'], queryFn: () => get<Overview>('/admin/overview'), refetchInterval: 60_000 });
  const a = useQuery({ queryKey: ['admin-activity'], queryFn: () => get<{ date: string; activeUsers: number; signups: number }[]>('/admin/activity', { days: 30 }) });
  if (o.isLoading || !o.data) return <Skeleton className="h-80" />;
  const d = o.data;
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat label="Users" value={d.users.total} sub={`${d.users.disabled} disabled`} />
        <Stat label="Active (7 days)" value={d.users.activeLast7Days} sub="logged or ticked anything" />
        <Stat label="New (7 days)" value={d.users.newLast7Days} />
        <Stat label="Server uptime" value={uptime(d.server.uptimeSec)} sub={`${d.server.node} · ${d.server.rssMb} MB RAM`} />
      </div>
      <div className="grid lg:grid-cols-[1.4fr_1fr] gap-5">
        <Panel title="Activity · 30 days" action={
          <div className="flex gap-4 text-xs text-muted">
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-leaf" />Active users</span>
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-water" />Sign-ups</span>
          </div>}>
          <div className="h-56 -ml-2"><ResponsiveContainer><BarChart data={a.data ?? []}><CartesianGrid vertical={false} stroke="hsl(var(--line))" />
            <XAxis dataKey="date" tickFormatter={(x) => prettyDate(x, { day: 'numeric', month: 'short' })} tick={axisTick} tickLine={false} axisLine={false} minTickGap={20} />
            <YAxis allowDecimals={false} tick={axisTick} tickLine={false} axisLine={false} width={28} />
            <Tooltip {...chartTooltip} labelFormatter={(x) => prettyDate(String(x), { weekday: 'short', day: 'numeric', month: 'short' })} formatter={(v: number, n) => [v, n === 'activeUsers' ? 'Active users' : 'Sign-ups']} />
            <Bar dataKey="activeUsers" fill="hsl(var(--leaf))" radius={[4, 4, 1, 1]} maxBarSize={16} /><Bar dataKey="signups" fill="hsl(var(--water))" radius={[4, 4, 1, 1]} maxBarSize={16} />
          </BarChart></ResponsiveContainer></div>
        </Panel>
        <Panel title="Database storage">
          <p className="font-display text-2xl font-semibold num">{mb(d.storage.usedBytes)}<span className="text-base text-muted"> / {mb(d.storage.limitBytes)}</span></p>
          <Progress value={d.storage.usedBytes} max={d.storage.limitBytes} tone={d.storage.pct > 85 ? 'danger' : d.storage.pct > 65 ? 'amber' : 'leaf'} className="mt-2 h-2.5" label="Storage used" />
          <p className="text-xs text-muted mt-2">{d.storage.pct}% of the MongoDB Atlas free tier (approximate — Atlas’ own meter is authoritative).</p>
          <ul className="mt-4 space-y-1.5 text-sm">
            {d.storage.collections.slice(0, 8).map((c) => (
              <li key={c.name} className="flex justify-between gap-3"><span className="truncate text-muted">{c.name}</span><span className="num">{c.count} · {mb(c.bytes)}</span></li>
            ))}
          </ul>
        </Panel>
      </div>
    </div>
  );
}

/* ---------------- Users ---------------- */
function UsersTab() {
  const qc = useQueryClient();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('all');
  const users = useQuery({ queryKey: ['admin-users', q, status], queryFn: () => api.get('/admin/users', { params: { q: q || undefined, status, limit: 100 } }).then((r) => r.data.data as AdminUser[]) });
  const [temp, setTemp] = useState<{ email: string; password: string } | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [newUser, setNewUser] = useState({ name: '', email: '' });
  const [del, setDel] = useState<AdminUser | null>(null);
  const [confirm, setConfirm] = useState('');
  const refresh = () => { qc.invalidateQueries({ queryKey: ['admin-users'] }); qc.invalidateQueries({ queryKey: ['admin-overview'] }); qc.invalidateQueries({ queryKey: ['admin-audit'] }); };
  const act = useMutation({
    mutationFn: async ({ u, action }: { u: AdminUser; action: 'disable' | 'enable' | 'reset' | 'logout' }) => {
      if (action === 'reset') return { pw: (await api.post(`/admin/users/${u._id}/reset-password`)).data.data.tempPassword as string, u };
      if (action === 'logout') { await api.post(`/admin/users/${u._id}/logout`); return { u }; }
      await api.patch(`/admin/users/${u._id}`, { isActive: action === 'enable' });
      return { u };
    },
    onSuccess: (r, v) => { refresh(); if ('pw' in r && r.pw) setTemp({ email: r.u.email, password: r.pw }); else toast.success({ disable: 'Account disabled and logged out', enable: 'Account enabled', logout: 'Logged out of all devices', reset: '' }[v.action]); },
    onError: (e) => toast.error(apiError(e)),
  });
  const create = useMutation({
    mutationFn: () => api.post('/admin/users', newUser).then((r) => r.data.data as { user: AdminUser; tempPassword: string }),
    onSuccess: (r) => { refresh(); setCreateOpen(false); setNewUser({ name: '', email: '' }); setTemp({ email: r.user.email, password: r.tempPassword }); },
    onError: (e) => toast.error(apiError(e)),
  });
  const remove = useMutation({
    mutationFn: () => api.delete(`/admin/users/${del!._id}`, { data: { confirmEmail: confirm } }).then((r) => r.data.data as { documents: number; files: number }),
    onSuccess: (r) => { refresh(); toast.success(`Deleted account, ${r.documents} records and ${r.files} photos`); setDel(null); setConfirm(''); },
    onError: (e) => toast.error(apiError(e)),
  });

  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-4">
        <div className="relative flex-1 min-w-[200px]"><Search className="h-4 w-4 text-muted absolute left-3 top-3" /><Input className="pl-9" placeholder="Search name or email" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search users" /></div>
        <Select value={status} onChange={(e) => setStatus(e.target.value)} className="w-36" aria-label="Status"><option value="all">All</option><option value="active">Active</option><option value="disabled">Disabled</option></Select>
        <Button variant="outline" onClick={() => download('/admin/users/export', {}, 'comeback-users.csv').catch((e) => toast.error(apiError(e)))}><Download className="h-4 w-4" />CSV</Button>
        <Button onClick={() => setCreateOpen(true)}><UserPlus className="h-4 w-4" />Add friend</Button>
      </div>
      <div className="panel overflow-x-auto">
        <table className="w-full text-sm min-w-[880px]">
          <thead><tr className="text-xs text-muted text-left border-b border-line">{['User', 'Status', 'Joined', 'Last seen', 'Last activity', 'Entries', 'Photos', ''].map((h) => <th key={h} className="font-normal px-4 py-2.5">{h}</th>)}</tr></thead>
          <tbody className="divide-y divide-line">
            {users.isLoading ? <tr><td colSpan={8} className="p-4"><Skeleton className="h-24" /></td></tr> : users.data?.map((u) => (
              <tr key={u._id} className={cn(!u.isActive && 'opacity-60')}>
                <td className="px-4 py-2.5"><p className="font-medium">{u.name}</p><p className="text-xs text-muted">{u.email}</p></td>
                <td className="px-4 py-2.5">{u.role === 'admin' ? <Chip tone="water"><ShieldCheck className="h-3 w-3" />admin</Chip> : u.isActive ? <Chip tone="leaf">active</Chip> : <Chip tone="danger">disabled</Chip>}</td>
                <td className="px-4 py-2.5 text-muted">{prettyDate(u.createdAt.slice(0, 10), { day: 'numeric', month: 'short' })}</td>
                <td className="px-4 py-2.5 text-muted" title={u.lastSeenAt ?? ''}>{ago(u.lastSeenAt)}{u.activeSessions ? <span className="text-xs"> · {u.activeSessions} device{u.activeSessions > 1 ? 's' : ''}</span> : null}</td>
                <td className="px-4 py-2.5 text-muted">{ago(u.lastActivityAt)}</td>
                <td className="px-4 py-2.5 num">{u.entries}</td>
                <td className="px-4 py-2.5 num text-muted">{u.photos ? `${u.photos} · ${mb(u.photoBytes)}` : '—'}</td>
                <td className="px-4 py-2.5 text-right whitespace-nowrap">
                  {u.role !== 'admin' && (
                    <>
                      <Button variant="ghost" size="icon" title="Reset password" aria-label={`Reset password for ${u.email}`} onClick={() => act.mutate({ u, action: 'reset' })}><KeyRound className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" title="Log out everywhere" aria-label={`Log out ${u.email}`} onClick={() => act.mutate({ u, action: 'logout' })}><LogOut className="h-4 w-4" /></Button>
                      {u.isActive
                        ? <Button variant="ghost" size="icon" title="Disable account" aria-label={`Disable ${u.email}`} onClick={() => act.mutate({ u, action: 'disable' })}><Ban className="h-4 w-4" /></Button>
                        : <Button variant="ghost" size="icon" title="Enable account" aria-label={`Enable ${u.email}`} onClick={() => act.mutate({ u, action: 'enable' })}><CheckCircle2 className="h-4 w-4" /></Button>}
                      <Button variant="ghost" size="icon" title="Delete account" aria-label={`Delete ${u.email}`} onClick={() => setDel(u)}><Trash2 className="h-4 w-4 text-danger" /></Button>
                    </>
                  )}
                </td>
              </tr>
            ))}
            {users.data?.length === 0 && <tr><td colSpan={8} className="px-4 py-8 text-center text-muted">No users match.</td></tr>}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted mt-3">Only usage metadata is shown here. Users’ journal entries, meals, weights, expenses and photos stay private to them.</p>

      <Dialog open={createOpen} onOpenChange={setCreateOpen} title="Add a friend" description="Creates the account with starter data and a temporary password — works even when sign-ups are closed.">
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); create.mutate(); }}>
          <Field label="Name" htmlFor="nu-name"><Input id="nu-name" value={newUser.name} onChange={(e) => setNewUser({ ...newUser, name: e.target.value })} required minLength={2} /></Field>
          <Field label="Email" htmlFor="nu-email"><Input id="nu-email" type="email" value={newUser.email} onChange={(e) => setNewUser({ ...newUser, email: e.target.value })} required /></Field>
          <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button><Button type="submit" loading={create.isPending}>Create account</Button></div>
        </form>
      </Dialog>
      <Dialog open={!!del} onOpenChange={(o) => { if (!o) { setDel(null); setConfirm(''); } }} title="Delete account permanently?" description="Removes the account and every record and photo it owns. This cannot be undone.">
        <div className="space-y-4">
          <Field label={`Type ${del?.email} to confirm`} htmlFor="del-confirm"><Input id="del-confirm" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="off" /></Field>
          <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setDel(null)}>Cancel</Button><Button variant="danger" disabled={confirm.trim().toLowerCase() !== del?.email} loading={remove.isPending} onClick={() => remove.mutate()}>Delete forever</Button></div>
        </div>
      </Dialog>
      <TempPasswordDialog data={temp} onClose={() => setTemp(null)} />
    </div>
  );
}

/* ---------------- Settings & broadcast ---------------- */
function SettingsTab() {
  const qc = useQueryClient();
  const o = useQuery({ queryKey: ['admin-overview'], queryFn: () => get<Overview>('/admin/overview') });
  const [ann, setAnn] = useState<Overview['settings']['announcement'] | null>(null);
  const [msg, setMsg] = useState({ title: '', body: '' });
  const cur = ann ?? o.data?.settings.announcement ?? { text: '', tone: 'info' as const, active: false };
  const save = useMutation({
    mutationFn: (body: Record<string, unknown>) => api.put('/admin/settings', body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-overview'] }); qc.invalidateQueries({ queryKey: ['auth-config'] }); qc.invalidateQueries({ queryKey: ['admin-audit'] }); toast.success('Saved'); },
    onError: (e) => toast.error(apiError(e)),
  });
  const send = useMutation({
    mutationFn: () => api.post('/admin/broadcast', msg).then((r) => r.data.data.sent as number),
    onSuccess: (n) => { toast.success(`Sent to ${n} users`); setMsg({ title: '', body: '' }); qc.invalidateQueries({ queryKey: ['admin-audit'] }); },
    onError: (e) => toast.error(apiError(e)),
  });
  if (!o.data) return <Skeleton className="h-60" />;
  const s = o.data.settings;
  return (
    <div className="grid lg:grid-cols-2 gap-5 items-start">
      <Panel title="Sign-ups">
        <label className="flex items-center gap-3 text-sm">
          <Switch checked={s.registrationOpen} onCheckedChange={(v) => save.mutate({ registrationOpen: v })} label="Allow new sign-ups" />
          {s.registrationOpen ? 'Anyone with the link can create an account' : 'Closed — add friends from the Users tab'}
        </label>
        {s.registrationSource === 'admin' && <button className="text-xs text-muted hover:text-ink mt-3" onClick={() => save.mutate({ registrationOpen: null })}>Reset to the ALLOW_REGISTRATION setting on the server</button>}
      </Panel>
      <Panel title="Announcement banner" action={<Megaphone className="h-4 w-4 text-muted" />}>
        <div className="space-y-3">
          <textarea value={cur.text} onChange={(e) => setAnn({ ...cur, text: e.target.value })} maxLength={300} rows={3} placeholder="e.g. New version is live — please test the Nutrition page!" aria-label="Announcement text"
            className="w-full rounded-xl border border-line bg-surface px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-leaf" />
          <div className="flex flex-wrap items-center gap-3">
            <Select value={cur.tone} onChange={(e) => setAnn({ ...cur, tone: e.target.value as 'info' | 'warning' })} className="w-32 h-9" aria-label="Tone"><option value="info">Info</option><option value="warning">Warning</option></Select>
            <label className="flex items-center gap-2 text-sm"><Switch checked={cur.active} onCheckedChange={(v) => setAnn({ ...cur, active: v })} label="Show banner" />Show to everyone</label>
            <Button size="sm" className="ml-auto" loading={save.isPending} onClick={() => save.mutate({ announcement: cur })}>Save banner</Button>
          </div>
        </div>
      </Panel>
      <Panel title="Send a notification to all users" className="lg:col-span-2">
        <form className="grid sm:grid-cols-[1fr_1.5fr_auto] gap-3 items-end" onSubmit={(e) => { e.preventDefault(); send.mutate(); }}>
          <Field label="Title" htmlFor="bc-t"><Input id="bc-t" value={msg.title} onChange={(e) => setMsg({ ...msg, title: e.target.value })} maxLength={120} required /></Field>
          <Field label="Message" htmlFor="bc-b"><Input id="bc-b" value={msg.body} onChange={(e) => setMsg({ ...msg, body: e.target.value })} maxLength={500} /></Field>
          <Button type="submit" loading={send.isPending}>Send</Button>
        </form>
        <p className="text-xs text-muted mt-2">Appears in each active user’s notification bell.</p>
      </Panel>
    </div>
  );
}

/* ---------------- Audit log ---------------- */
const ACTION_LABEL: Record<string, string> = { 'user.create': 'Created account', 'user.disable': 'Disabled', 'user.enable': 'Enabled', 'user.update': 'Updated', 'user.reset_password': 'Reset password', 'user.logout_all': 'Logged out everywhere', 'user.delete': 'Deleted account', 'settings.update': 'Changed settings', broadcast: 'Sent notification', 'users.export': 'Exported users' };
function AuditTab() {
  const q = useQuery({ queryKey: ['admin-audit'], queryFn: () => get<Audit[]>('/admin/audit', { limit: 100 }) });
  if (q.isLoading) return <Skeleton className="h-40" />;
  return (
    <Panel bodyClass="px-0">
      {!q.data?.length ? <p className="px-5 text-sm text-muted">No admin actions yet.</p> : (
        <ul className="divide-y divide-line">{q.data.map((a) => (
          <li key={a._id} className="flex items-center gap-3 px-5 py-2.5 text-sm">
            <span className="w-28 text-xs text-muted shrink-0">{new Date(a.createdAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}</span>
            <span className="font-medium">{ACTION_LABEL[a.action] ?? a.action}</span>
            {a.targetEmail && <span className="text-muted truncate">{a.targetEmail}</span>}
          </li>
        ))}</ul>
      )}
    </Panel>
  );
}


type Feedback = { _id: string; type: 'bug' | 'idea' | 'other'; message: string; page: string; userAgent: string; status: 'open' | 'resolved'; adminNote: string; createdAt: string; user: { name: string; email: string } | null };

function FeedbackTab() {
  const qc = useQueryClient();
  const [status, setStatus] = useState<'open' | 'resolved' | 'all'>('open');
  const q = useQuery({ queryKey: ['admin-feedback', status], queryFn: () => api.get('/admin/feedback', { params: { status } }).then((r) => ({ items: r.data.data as Feedback[], open: r.data.meta.open as number })) });
  const [notes, setNotes] = useState<Record<string, string>>({});
  const upd = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Record<string, string> }) => api.patch(`/admin/feedback/${id}`, body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-feedback'] }); toast.success('Feedback updated'); },
    onError: (e) => toast.error(apiError(e)),
  });
  const device = (ua: string) => (/iphone|ipad/i.test(ua) ? 'iPhone' : /android/i.test(ua) ? 'Android' : /windows/i.test(ua) ? 'Windows' : /mac/i.test(ua) ? 'Mac' : 'Other');
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Select value={status} onChange={(e) => setStatus(e.target.value as typeof status)} className="w-40" aria-label="Status">
          <option value="open">Open</option><option value="resolved">Resolved</option><option value="all">All</option>
        </Select>
        <span className="text-sm text-muted">{q.data?.open ?? 0} open</span>
      </div>
      {q.isLoading ? <Skeleton className="h-40" /> : !q.data?.items.length ? <p className="text-sm text-muted">No feedback here. Testers send it from their profile menu → Send feedback.</p> : q.data.items.map((f) => (
        <section key={f._id} className="panel p-5">
          <div className="flex flex-wrap items-center gap-2">
            <Chip tone={f.type === 'bug' ? 'danger' : f.type === 'idea' ? 'leaf' : 'neutral'}>{f.type}</Chip>
            {f.status === 'resolved' && <Chip tone="leaf">resolved</Chip>}
            <span className="text-sm font-medium">{f.user?.name ?? 'Deleted user'}</span>
            <span className="text-xs text-muted">{f.user?.email} · {prettyDate(f.createdAt.slice(0, 10), { day: 'numeric', month: 'short' })} · {f.page || '—'} · {device(f.userAgent)}</span>
          </div>
          <p className="text-sm mt-3 whitespace-pre-wrap">{f.message}</p>
          <div className="flex flex-wrap gap-2 mt-4">
            <Input className="flex-1 min-w-[200px] h-9" placeholder="Note back to the tester (they can see it)" aria-label="Admin note"
              value={notes[f._id] ?? f.adminNote} onChange={(e) => setNotes({ ...notes, [f._id]: e.target.value })} maxLength={500} />
            {f.status === 'open'
              ? <Button size="sm" onClick={() => upd.mutate({ id: f._id, body: { status: 'resolved', adminNote: notes[f._id] ?? f.adminNote } })}><CheckCircle2 className="h-4 w-4" />Resolve</Button>
              : <Button size="sm" variant="outline" onClick={() => upd.mutate({ id: f._id, body: { status: 'open' } })}>Reopen</Button>}
          </div>
        </section>
      ))}
    </div>
  );
}

export default function AdminPage() {
  const [tab, setTab] = useState('overview');
  return (
    <div>
      <PageHeader title="Admin" subtitle="Testers, usage and app settings." />
      <PageTabs value={tab} onChange={setTab} tabs={[{ v: 'overview', label: 'Overview' }, { v: 'users', label: 'Users' }, { v: 'feedback', label: 'Feedback' }, { v: 'settings', label: 'Settings & broadcast' }, { v: 'audit', label: 'Audit log' }]}>
        <TabPanel value="overview"><OverviewTab /></TabPanel>
        <TabPanel value="users"><UsersTab /></TabPanel>
        <TabPanel value="feedback"><FeedbackTab /></TabPanel>
        <TabPanel value="settings"><SettingsTab /></TabPanel>
        <TabPanel value="audit"><AuditTab /></TabPanel>
      </PageTabs>
    </div>
  );
}
