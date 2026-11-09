import { useEffect, useState, type ReactNode } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowDown, ArrowUp, Pencil, Plus, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Field, Input, Select } from '@/components/ui/input';
import { Switch } from '@/components/ui/misc';
import { ConfirmDialog } from '@/components/ui/dialog';
import { settingsApi } from '@/services/data.service';
import { authApi } from '@/services/auth.service';
import { useAuth } from '@/context/AuthContext';
import { useTheme, type Theme } from '@/context/ThemeContext';
import { apiError } from '@/lib/api';
import { keys } from '@/hooks/queries';
import { cn } from '@/lib/utils';
import type { Preferences, Profile, Widget } from '@/types';
import { AuthedImage } from '@/components/AuthedImage';
import { api as apiClient } from '@/lib/api';
import { BellRing, Camera, Download, Share } from 'lucide-react';
import { compressImage } from '@/lib/image';
import { useInstallPrompt } from '@/lib/pwa';
import { useList, useResourceMutations } from '@/hooks/useResource';
import { FormDialog, type FieldDef } from '@/components/ui/form-dialog';
import { BROWSER_NOTIF_KEY } from '@/components/layout/NotificationBell';
import { DAY_SHORT, to12h } from '@/lib/date';
import type { Reminder } from '@/types';

const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use HH:MM');
const num = (min: number, max: number) => z.coerce.number({ invalid_type_error: 'Enter a number' }).min(min).max(max);

export function Card({ title, description, children, footer }: { title: string; description?: string; children: ReactNode; footer?: ReactNode }) {
  return (
    <section className="panel">
      <div className="p-5 sm:p-6">
        <h2 className="text-base font-semibold">{title}</h2>
        {description && <p className="text-sm text-muted mt-1">{description}</p>}
        <div className="mt-5">{children}</div>
      </div>
      {footer && <div className="px-5 sm:px-6 py-3 border-t border-line bg-sunken/40 rounded-b-2xl flex justify-end">{footer}</div>}
    </section>
  );
}

function useSaveProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: settingsApi.updateProfile,
    onSuccess: () => { qc.invalidateQueries({ queryKey: keys.settings }); qc.invalidateQueries({ queryKey: keys.dashboard }); qc.invalidateQueries({ queryKey: ['water'] }); toast.success('Settings saved'); },
    onError: (e) => toast.error(apiError(e, 'Could not save')),
  });
}

/* ---------------- Account ---------------- */
export function AccountSection() {
  const { user, setUser, clearSession } = useAuth();
  const nameForm = useForm<{ name: string }>({ resolver: zodResolver(z.object({ name: z.string().trim().min(2) })), values: { name: user?.name ?? '' } });
  const pwSchema = z.object({
    currentPassword: z.string().min(1, 'Required'),
    newPassword: z.string().min(8, 'At least 8 characters').regex(/[A-Za-z]/, 'Include a letter').regex(/\d/, 'Include a number'),
  });
  const pwForm = useForm<z.infer<typeof pwSchema>>({ resolver: zodResolver(pwSchema) });

  return (
    <div className="space-y-5">
      <InstallAppCard />
      <AvatarCard />
      <Card title="Profile" description={user?.email}
        footer={<Button form="name-form" type="submit" loading={nameForm.formState.isSubmitting}>Save name</Button>}>
        <form id="name-form" onSubmit={nameForm.handleSubmit(async (v) => {
          try { setUser(await authApi.updateMe(v)); toast.success('Name updated'); } catch (e) { toast.error(apiError(e)); }
        })}>
          <Field label="Display name" htmlFor="acc-name" error={nameForm.formState.errors.name?.message}>
            <Input id="acc-name" {...nameForm.register('name')} />
          </Field>
        </form>
      </Card>
      <Card title="Change password" description="You'll be logged out everywhere after changing it."
        footer={<Button form="pw-form" type="submit" loading={pwForm.formState.isSubmitting}>Change password</Button>}>
        <form id="pw-form" className="grid sm:grid-cols-2 gap-4" onSubmit={pwForm.handleSubmit(async (v) => {
          try { await authApi.changePassword(v); toast.success('Password changed. Log in again.'); clearSession(); } catch (e) { toast.error(apiError(e)); }
        })}>
          <Field label="Current password" htmlFor="pw-cur" error={pwForm.formState.errors.currentPassword?.message}>
            <Input id="pw-cur" type="password" autoComplete="current-password" {...pwForm.register('currentPassword')} />
          </Field>
          <Field label="New password" htmlFor="pw-new" error={pwForm.formState.errors.newPassword?.message}>
            <Input id="pw-new" type="password" autoComplete="new-password" {...pwForm.register('newPassword')} />
          </Field>
        </form>
      </Card>
    </div>
  );
}

/* ---------------- Personal / body ---------------- */
const personalSchema = z.object({
  ageRange: z.string().max(20), gender: z.string().max(30),
  heightCm: num(50, 260), currentWeightKg: num(20, 400),
  fitnessGoal: z.string(), dietType: z.string(), cooking: z.string(), workoutLocation: z.string(),
  equipment: z.string(), timezone: z.string().min(1), monthlyBudget: num(0, 10_000_000),
});

export function PersonalSection({ profile }: { profile: Profile }) {
  const save = useSaveProfile();
  const p = profile.personal;
  const { register, handleSubmit, formState: { errors } } = useForm<z.infer<typeof personalSchema>>({
    resolver: zodResolver(personalSchema),
    values: {
      ageRange: p.ageRange ?? '', gender: p.gender ?? '', heightCm: p.heightCm ?? 0, currentWeightKg: p.currentWeightKg ?? 0,
      fitnessGoal: p.fitnessGoal ?? '', dietType: p.dietType ?? '', cooking: p.cooking ?? '', workoutLocation: p.workoutLocation ?? '',
      equipment: p.equipment.join(', '), timezone: p.timezone, monthlyBudget: p.monthlyBudget,
    },
  });
  const zones = typeof Intl.supportedValuesOf === 'function' ? Intl.supportedValuesOf('timeZone') : [p.timezone];

  return (
    <Card title="Personal & body" description="Used for targets, recommendations and the AI assistant later."
      footer={<Button form="personal-form" type="submit" loading={save.isPending}>Save changes</Button>}>
      <form id="personal-form" className="grid sm:grid-cols-2 gap-4" onSubmit={handleSubmit((v) => save.mutate({
        personal: { ...v, ageRange: v.ageRange || null, gender: v.gender || null, equipment: v.equipment.split(',').map((s) => s.trim()).filter(Boolean) },
      }))}>
        <Field label="Height (cm)" htmlFor="p-h" error={errors.heightCm?.message}><Input id="p-h" type="number" step="0.1" {...register('heightCm')} /></Field>
        <Field label="Current weight (kg)" htmlFor="p-w" error={errors.currentWeightKg?.message}><Input id="p-w" type="number" step="0.1" {...register('currentWeightKg')} /></Field>
        <Field label="Age range" htmlFor="p-age"><Input id="p-age" {...register('ageRange')} /></Field>
        <Field label="Gender" htmlFor="p-g"><Select id="p-g" {...register('gender')}><option value="">Prefer not to say</option><option value="male">Male</option><option value="female">Female</option><option value="other">Other</option></Select></Field>
        <Field label="Fitness goal" htmlFor="p-goal"><Select id="p-goal" {...register('fitnessGoal')}>
          <option value="lean_muscle_gain">Lean muscle gain</option><option value="fat_loss">Fat loss</option><option value="maintenance">Maintenance</option><option value="endurance">Endurance</option>
        </Select></Field>
        <Field label="Diet" htmlFor="p-diet"><Select id="p-diet" {...register('dietType')}>
          <option value="vegetarian_eggs">Vegetarian + eggs</option><option value="vegetarian">Vegetarian</option><option value="vegan">Vegan</option><option value="non_vegetarian">Non-vegetarian</option>
        </Select></Field>
        <Field label="Cooking" htmlFor="p-cook"><Select id="p-cook" {...register('cooking')}><option value="self">Self-cooking</option><option value="mess">Mess / tiffin</option><option value="family">Family cooks</option><option value="mixed">Mixed</option></Select></Field>
        <Field label="Workout location" htmlFor="p-loc"><Select id="p-loc" {...register('workoutLocation')}><option value="home">Home</option><option value="gym">Gym</option><option value="outdoor">Outdoor</option></Select></Field>
        <Field label="Equipment" htmlFor="p-eq" hint="Comma separated. Leave empty for bodyweight only."><Input id="p-eq" placeholder="e.g. resistance band, pull-up bar" {...register('equipment')} /></Field>
        <Field label="Monthly self-improvement budget (₹)" htmlFor="p-bud" error={errors.monthlyBudget?.message}><Input id="p-bud" type="number" {...register('monthlyBudget')} /></Field>
        <Field label="Timezone" htmlFor="p-tz" className="sm:col-span-2"><Select id="p-tz" {...register('timezone')}>{zones.map((z) => <option key={z} value={z}>{z}</option>)}</Select></Field>
      </form>
    </Card>
  );
}

/* ---------------- Targets ---------------- */
const targetsSchema = z.object({
  proteinMinG: num(0, 500), proteinMaxG: num(0, 500), waterMl: num(0, 10000),
  sleepHours: num(0, 14), studyMinutesPerDay: num(0, 1440), workoutMinutesPerDay: num(0, 600),
}).refine((v) => v.proteinMinG <= v.proteinMaxG, { message: 'Min must be ≤ max', path: ['proteinMinG'] });

export function TargetsSection({ profile }: { profile: Profile }) {
  const save = useSaveProfile();
  const { register, handleSubmit, formState: { errors } } = useForm<z.infer<typeof targetsSchema>>({ resolver: zodResolver(targetsSchema), values: profile.targets });
  const fields: [keyof Profile['targets'], string, string?][] = [
    ['proteinMinG', 'Protein min (g/day)'], ['proteinMaxG', 'Protein max (g/day)'],
    ['waterMl', 'Water (ml/day)', 'Drives the water ring and dashboard score'], ['sleepHours', 'Sleep (hours)'],
    ['studyMinutesPerDay', 'Study (min/day)'], ['workoutMinutesPerDay', 'Workout (min/day)'],
  ];
  return (
    <Card title="Daily targets" description="Every progress bar and score is measured against these."
      footer={<Button form="targets-form" type="submit" loading={save.isPending}>Save targets</Button>}>
      <form id="targets-form" className="grid sm:grid-cols-2 gap-4" onSubmit={handleSubmit((v) => save.mutate({ targets: v }))}>
        {fields.map(([k, label, hint]) => (
          <Field key={k} label={label} htmlFor={`t-${k}`} error={errors[k]?.message} hint={hint}>
            <Input id={`t-${k}`} type="number" step={k === 'sleepHours' ? '0.25' : '1'} {...register(k)} />
          </Field>
        ))}
      </form>
    </Card>
  );
}

/* ---------------- Schedule ---------------- */
const scheduleSchema = z.object({
  wakeUp: hhmm, sleep: hhmm,
  blocks: z.array(z.object({ key: z.string(), label: z.string().trim().min(1, 'Required').max(60), start: hhmm, end: hhmm })
    .refine((b) => b.start < b.end, { message: 'End must be after start', path: ['end'] })),
});

export function ScheduleSection({ profile }: { profile: Profile }) {
  const save = useSaveProfile();
  const { register, control, handleSubmit, formState: { errors } } = useForm<z.infer<typeof scheduleSchema>>({ resolver: zodResolver(scheduleSchema), values: profile.schedule });
  const { fields, append, remove, move } = useFieldArray({ control, name: 'blocks' });

  return (
    <Card title="Daily schedule" description="Wake-up and sleep targets, and the blocks used to seed your weekday routine. Day-by-day routines live on the Daily routine page."
      footer={<Button form="schedule-form" type="submit" loading={save.isPending}>Save schedule</Button>}>
      <form id="schedule-form" onSubmit={handleSubmit((v) => save.mutate({ schedule: v }))} className="space-y-5">
        <div className="grid grid-cols-2 gap-4 max-w-sm">
          <Field label="Wake up" htmlFor="s-wake" error={errors.wakeUp?.message}><Input id="s-wake" type="time" {...register('wakeUp')} /></Field>
          <Field label="Sleep" htmlFor="s-sleep" error={errors.sleep?.message}><Input id="s-sleep" type="time" {...register('sleep')} /></Field>
        </div>
        <div>
          <p className="field-label mb-2">Time blocks</p>
          <ul className="space-y-2">
            {fields.map((f, i) => (
              <li key={f.id} className="grid grid-cols-[1fr_auto] sm:grid-cols-[1fr_120px_120px_auto] gap-2 items-start">
                <div className="col-span-2 sm:col-span-1">
                  <Input aria-label={`Block ${i + 1} name`} {...register(`blocks.${i}.label`)} aria-invalid={!!errors.blocks?.[i]?.label} />
                </div>
                <Input type="time" aria-label="Start" {...register(`blocks.${i}.start`)} />
                <div>
                  <Input type="time" aria-label="End" {...register(`blocks.${i}.end`)} aria-invalid={!!errors.blocks?.[i]?.end} />
                  {errors.blocks?.[i]?.end && <p className="text-xs text-danger mt-1">{errors.blocks[i]?.end?.message}</p>}
                </div>
                <div className="flex col-start-2 row-start-2 sm:col-start-auto sm:row-start-auto">
                  <Button type="button" variant="ghost" size="icon" disabled={i === 0} onClick={() => move(i, i - 1)} aria-label="Move up"><ArrowUp className="h-4 w-4" /></Button>
                  <Button type="button" variant="ghost" size="icon" disabled={i === fields.length - 1} onClick={() => move(i, i + 1)} aria-label="Move down"><ArrowDown className="h-4 w-4" /></Button>
                  <Button type="button" variant="ghost" size="icon" onClick={() => remove(i)} aria-label="Remove block"><Trash2 className="h-4 w-4" /></Button>
                </div>
              </li>
            ))}
          </ul>
          <Button type="button" variant="outline" size="sm" className="mt-3"
            onClick={() => append({ key: `block_${Date.now()}`, label: '', start: '12:00', end: '12:30' })}>
            <Plus className="h-4 w-4" />Add block
          </Button>
        </div>
      </form>
    </Card>
  );
}

/* ---------------- Career goals ---------------- */
export function CareerSection({ profile }: { profile: Profile }) {
  const save = useSaveProfile();
  const [goals, setGoals] = useState(profile.careerGoals);
  const [draft, setDraft] = useState('');
  useEffect(() => setGoals(profile.careerGoals), [profile.careerGoals]);
  const add = () => { const g = draft.trim(); if (g && !goals.includes(g)) setGoals([...goals, g]); setDraft(''); };

  return (
    <Card title="Career focus" description="Skills you're building. The Learning module (phase 3) turns these into paths."
      footer={<Button onClick={() => save.mutate({ careerGoals: goals })} loading={save.isPending}>Save focus areas</Button>}>
      <div className="flex flex-wrap gap-2 mb-4">
        {goals.map((g) => (
          <span key={g} className="inline-flex items-center gap-1.5 h-8 pl-3 pr-1.5 rounded-full bg-leaf-soft text-leaf-ink text-sm">
            {g}
            <button onClick={() => setGoals(goals.filter((x) => x !== g))} aria-label={`Remove ${g}`} className="h-5 w-5 rounded-full grid place-items-center hover:bg-leaf/20"><X className="h-3 w-3" /></button>
          </span>
        ))}
        {goals.length === 0 && <p className="text-sm text-muted">No focus areas yet.</p>}
      </div>
      <form className="flex gap-2 max-w-md" onSubmit={(e) => { e.preventDefault(); add(); }}>
        <Input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="e.g. FastAPI" aria-label="New focus area" maxLength={80} />
        <Button type="submit" variant="outline">Add</Button>
      </form>
    </Card>
  );
}

/* ---------------- Dashboard widgets + water quick add ---------------- */
const WIDGET_LABELS: Record<string, string> = { score: "Today's score", habits: "Today's habits", water: 'Water', schedule: "Today's routine", weekly: 'Last 7 days chart', profile: 'Targets', workout: 'Workout', nutrition: 'Protein & nutrition', study: 'Study', sleep: 'Sleep', finance: 'Spending', goals: 'Goals' };

export function DashboardSection({ prefs }: { prefs: Preferences }) {
  const qc = useQueryClient();
  const [widgets, setWidgets] = useState<Widget[]>(prefs.dashboardWidgets);
  const [quick, setQuick] = useState(prefs.waterQuickAdd.join(', '));
  useEffect(() => { setWidgets(prefs.dashboardWidgets); setQuick(prefs.waterQuickAdd.join(', ')); }, [prefs]);

  const save = useMutation({
    mutationFn: settingsApi.updatePreferences,
    onSuccess: () => { qc.invalidateQueries({ queryKey: keys.settings }); qc.invalidateQueries({ queryKey: keys.dashboard }); toast.success('Dashboard updated'); },
    onError: (e) => toast.error(apiError(e)),
  });

  const update = (i: number, patch: Partial<Widget>) => setWidgets(widgets.map((w, j) => (j === i ? { ...w, ...patch } : w)));
  const move = (i: number, d: -1 | 1) => { const n = [...widgets]; [n[i], n[i + d]] = [n[i + d], n[i]]; setWidgets(n); };

  const saveQuick = () => {
    const vals = quick.split(',').map((s) => Number(s.trim())).filter((n) => Number.isInteger(n) && n >= 10 && n <= 2000);
    if (!vals.length || vals.length > 6) return toast.error('Enter 1–6 amounts between 10 and 2000 ml, comma separated');
    save.mutate({ waterQuickAdd: vals });
  };

  return (
    <div className="space-y-5">
      <Card title="Dashboard widgets" description="Show, hide, reorder and resize. Width applies on large screens."
        footer={<Button onClick={() => save.mutate({ dashboardWidgets: widgets })} loading={save.isPending}>Save layout</Button>}>
        <ul className="divide-y divide-line -my-2">
          {widgets.map((w, i) => (
            <li key={w.key} className="flex items-center gap-3 py-2.5">
              <Switch checked={w.visible} onCheckedChange={(v) => update(i, { visible: v })} label={`Show ${WIDGET_LABELS[w.key] ?? w.key}`} />
              <span className={cn('flex-1 text-sm', !w.visible && 'text-muted')}>{WIDGET_LABELS[w.key] ?? w.key}</span>
              <Select value={w.size} onChange={(e) => update(i, { size: e.target.value as Widget['size'] })} className="w-28 h-8" aria-label="Width">
                <option value="sm">Narrow</option><option value="md">Half</option><option value="lg">Full</option>
              </Select>
              <Button variant="ghost" size="icon" disabled={i === 0} onClick={() => move(i, -1)} aria-label="Move up"><ArrowUp className="h-4 w-4" /></Button>
              <Button variant="ghost" size="icon" disabled={i === widgets.length - 1} onClick={() => move(i, 1)} aria-label="Move down"><ArrowDown className="h-4 w-4" /></Button>
            </li>
          ))}
        </ul>
      </Card>
      <Card title="Water quick-add buttons" footer={<Button onClick={saveQuick} loading={save.isPending}>Save buttons</Button>}>
        <Field label="Amounts in ml" htmlFor="q-add" hint="Comma separated, up to 6. Example: 150, 250, 500">
          <Input id="q-add" value={quick} onChange={(e) => setQuick(e.target.value)} className="max-w-xs" />
        </Field>
      </Card>
    </div>
  );
}

/* ---------------- Appearance ---------------- */
export function AppearanceSection() {
  const { theme, setTheme } = useTheme();
  const opts: { v: Theme; label: string }[] = [{ v: 'light', label: 'Light' }, { v: 'dark', label: 'Dark' }, { v: 'system', label: 'Match system' }];
  return (
    <Card title="Theme" description="Saved on this device.">
      <div className="grid grid-cols-3 gap-3 max-w-md" role="radiogroup" aria-label="Theme">
        {opts.map((o) => (
          <button key={o.v} role="radio" aria-checked={theme === o.v} onClick={() => { setTheme(o.v); settingsApi.updatePreferences({ theme: o.v }).catch(() => {}); }}
            className={cn('rounded-xl border-2 p-3 text-sm text-left', theme === o.v ? 'border-leaf' : 'border-line hover:border-muted/40')}>
            <span className={cn('block h-10 rounded-lg mb-2 border border-line',
              o.v === 'light' ? 'bg-[#F4F6F3]' : o.v === 'dark' ? 'bg-[#0E1311]' : 'bg-gradient-to-r from-[#F4F6F3] from-50% to-[#0E1311] to-50%')} />
            {o.label}
          </button>
        ))}
      </div>
    </Card>
  );
}

/* ---------------- Reset ---------------- */
export function ResetSection() {
  const qc = useQueryClient();
  const [section, setSection] = useState<null | 'profile' | 'preferences' | 'habits' | 'all'>(null);
  const reset = useMutation({
    mutationFn: settingsApi.reset,
    onSuccess: () => { qc.invalidateQueries(); toast.success('Reset to defaults'); setSection(null); },
    onError: (e) => toast.error(apiError(e)),
  });
  const items: { k: 'profile' | 'preferences' | 'habits' | 'all'; title: string; body: string }[] = [
    { k: 'profile', title: 'Profile, targets & schedule', body: 'Body details, daily targets, time blocks and career focus.' },
    { k: 'preferences', title: 'Dashboard & preferences', body: 'Widget layout and water quick-add buttons.' },
    { k: 'habits', title: 'Habits', body: 'Removes your current habits and restores the 10 defaults. History of old habits is kept but hidden.' },
    { k: 'all', title: 'Everything above', body: 'Full reset of settings and habits. Logged water and habit history stay.' },
  ];
  return (
    <Card title="Reset to defaults" description="Restores the starting configuration. This can't be undone.">
      <ul className="divide-y divide-line -my-2">
        {items.map((it) => (
          <li key={it.k} className="flex items-center gap-4 py-3">
            <div className="flex-1"><p className="text-sm font-medium">{it.title}</p><p className="text-xs text-muted mt-0.5">{it.body}</p></div>
            <Button variant="outline" size="sm" className="text-danger" onClick={() => setSection(it.k)}>Reset</Button>
          </li>
        ))}
      </ul>
      <ConfirmDialog open={!!section} onOpenChange={(o) => !o && setSection(null)}
        title="Reset to defaults?" description={items.find((i) => i.k === section)?.body ?? ''}
        confirmLabel="Reset" loading={reset.isPending} onConfirm={() => { if (section) reset.mutate(section); }} />
    </Card>
  );
}

/* ---------------- Profile photo ---------------- */

export function AvatarCard() {
  const { user, setUser } = useAuth();
  const [busy, setBusy] = useState(false);
  const upload = async (f: File) => {
    const fd = new FormData(); fd.append('avatar', await compressImage(f, 512));
    setBusy(true);
    try { const r = await apiClient.post('/settings/avatar', fd); setUser(r.data.data); toast.success('Photo updated'); }
    catch (e) { toast.error(apiError(e)); } finally { setBusy(false); }
  };
  const remove = async () => { try { const r = await apiClient.delete('/settings/avatar'); setUser(r.data.data); } catch (e) { toast.error(apiError(e)); } };
  return (
    <Card title="Profile photo" description="JPEG, PNG or WebP up to 5 MB. Only you can see it.">
      <div className="flex items-center gap-4">
        {user?.avatarUrl ? <AuthedImage src={user.avatarUrl} alt="Your profile photo" className="h-16 w-16 rounded-full object-cover" />
          : <div className="h-16 w-16 rounded-full bg-leaf-soft text-leaf-ink grid place-items-center text-xl font-semibold">{user?.name?.[0]?.toUpperCase()}</div>}
        <label className={cn('inline-flex items-center gap-2 h-9 px-3 text-sm rounded-lg border border-line cursor-pointer hover:bg-sunken', busy && 'opacity-50 pointer-events-none')}>
          <Camera className="h-4 w-4" />{busy ? 'Uploading…' : 'Upload photo'}
          <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = ''; }} />
        </label>
        {user?.avatarUrl && <Button variant="ghost" size="sm" onClick={remove}>Remove</Button>}
      </div>
    </Card>
  );
}

/* ---------------- Reminders ---------------- */
const REMINDER_FIELDS: FieldDef[] = [
  { name: 'title', label: 'Reminder', type: 'text', required: true, max: 80, full: true },
  { name: 'type', label: 'Type', type: 'select', options: ['wake', 'workout', 'meal', 'water', 'study', 'sleep', 'review', 'budget', 'other'].map((v) => ({ value: v, label: v[0].toUpperCase() + v.slice(1) })) },
  { name: 'time', label: 'Time', type: 'time', required: true },
  { name: 'days', label: 'Days', type: 'days' },
  { name: 'enabled', label: 'Enabled', type: 'checkbox' },
];
export function RemindersSection() {
  const list = useList<Reminder>('/reminders', { limit: 100 });
  const m = useResourceMutations<Reminder>('/reminders', { noun: 'Reminder' });
  const [edit, setEdit] = useState<Reminder | null>(null);
  const [open, setOpen] = useState(false);
  const supported = typeof Notification !== 'undefined';
  const [browser, setBrowser] = useState(() => { try { return localStorage.getItem(BROWSER_NOTIF_KEY) === '1' && supported && Notification.permission === 'granted'; } catch { return false; } });
  const toggleBrowser = async (on: boolean) => {
    if (on) {
      const p = await Notification.requestPermission();
      if (p !== 'granted') return toast.error('Notifications are blocked for this site in your browser settings.');
    }
    try { localStorage.setItem(BROWSER_NOTIF_KEY, on ? '1' : '0'); } catch { /* ignore */ }
    setBrowser(on);
  };
  return (
    <div className="space-y-5">
      <Card title="Browser notifications" description="Shows reminders as system notifications while Comeback OS is open in a tab. When the app is closed, reminders still appear in the bell next time you open it.">
        <label className="flex items-center gap-3 text-sm">
          <Switch checked={browser} onCheckedChange={toggleBrowser} label="Browser notifications" />
          {supported ? 'Show browser notifications on this device' : 'Not supported in this browser'}
        </label>
      </Card>
      <Card title="Reminders" description="Fired by the server in your timezone and delivered to the notification bell.">
        <ul className="divide-y divide-line -my-2">
          {list.data?.items.map((r) => (
            <li key={r._id} className="flex items-center gap-3 py-2.5">
              <Switch checked={r.enabled} onCheckedChange={(v) => m.update.mutate({ id: r._id, body: { enabled: v } })} label={`Enable ${r.title}`} />
              <span className="w-20 text-sm font-medium num">{to12h(r.time)}</span>
              <div className="flex-1 min-w-0"><p className={cn('text-sm truncate', !r.enabled && 'text-muted')}>{r.title}</p><p className="text-xs text-muted">{r.days.length === 7 ? 'Every day' : r.days.map((d) => DAY_SHORT[d]).join(', ')}</p></div>
              <Button variant="ghost" size="icon" aria-label={`Edit ${r.title}`} onClick={() => { setEdit(r); setOpen(true); }}><Pencil className="h-4 w-4" /></Button>
              <Button variant="ghost" size="icon" aria-label={`Delete ${r.title}`} onClick={() => m.remove.mutate(r._id)}><Trash2 className="h-4 w-4" /></Button>
            </li>
          ))}
        </ul>
        <Button variant="outline" size="sm" className="mt-4" onClick={() => { setEdit(null); setOpen(true); }}><BellRing className="h-4 w-4" />Add reminder</Button>
      </Card>
      <FormDialog open={open} onOpenChange={setOpen} title={edit ? 'Edit reminder' : 'New reminder'} fields={REMINDER_FIELDS} submitLabel={edit ? 'Save reminder' : 'Add reminder'}
        initial={edit ?? { time: '09:00', days: [0, 1, 2, 3, 4, 5, 6], enabled: true, type: 'other' }}
        onSubmit={(v) => edit ? m.update.mutateAsync({ id: edit._id, body: v }) : m.create.mutateAsync(v)} />
    </div>
  );
}

/* ---------------- Install app ---------------- */
export function InstallAppCard() {
  const { canPrompt, installed, ios, prompt } = useInstallPrompt();
  return (
    <Card title="Install on your phone" description="Adds Comeback OS to your home screen. It opens full-screen like a normal app and loads instantly.">
      {installed ? <p className="text-sm text-leaf font-medium">Installed — you're using the app version.</p>
        : canPrompt ? <Button onClick={async () => { if (await prompt()) toast.success('Installed. Find Comeback on your home screen.'); }}><Download className="h-4 w-4" />Install app</Button>
        : ios ? (
          <ol className="text-sm space-y-1.5 list-decimal pl-5">
            <li>Open this site in <b>Safari</b>.</li>
            <li>Tap <Share className="inline h-4 w-4 -mt-0.5" /> <b>Share</b>, then <b>Add to Home Screen</b>.</li>
            <li>Tap <b>Add</b>. Open Comeback from the new icon.</li>
          </ol>
        ) : (
          <ol className="text-sm space-y-1.5 list-decimal pl-5">
            <li>Open this site in <b>Chrome</b> on your phone (must be the https link).</li>
            <li>Tap the <b>⋮</b> menu → <b>Install app</b> or <b>Add to Home screen</b>.</li>
          </ol>
        )}
    </Card>
  );
}
