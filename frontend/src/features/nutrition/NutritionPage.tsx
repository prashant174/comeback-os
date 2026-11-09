import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bar, BarChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { toast } from 'sonner';
import { AlertTriangle, BadgeCheck, ClipboardCopy, Pencil, Plus, Trash2, Wand2 } from 'lucide-react';
import { api, apiError } from '@/lib/api';
import { get, post, put } from '@/lib/resource';
import { useList, useResourceMutations, useToday } from '@/hooks/useResource';
import { useSettings } from '@/hooks/queries';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/input';
import { Dialog, ConfirmDialog } from '@/components/ui/dialog';
import { FormDialog, type FieldDef } from '@/components/ui/form-dialog';
import { PageHeader, Skeleton } from '@/components/ui/misc';
import { Chip, DateNav, PageTabs, Panel, Progress, Segmented, TabPanel, axisTick, chartTooltip, dateTitle } from '@/components/ui/kit';
import { DAY_SHORT, prettyDate, shortDay, weekdayOf } from '@/lib/date';
import { cn } from '@/lib/utils';
import { MEAL_TYPES, type Food, type Macros, type MealEntry, type MealPlan, type MealType, type NutritionDay } from '@/types';

const MEAL_LABEL: Record<MealType, string> = { breakfast: 'Breakfast', lunch: 'Lunch', snacks: 'Snacks', dinner: 'Dinner' };
const macrosFor = (f: Food | undefined, g: number): Macros => {
  const k = g / 100;
  return { kcal: Math.round((f?.per100g.kcal ?? 0) * k), protein: +((f?.per100g.protein ?? 0) * k).toFixed(1), carbs: +((f?.per100g.carbs ?? 0) * k).toFixed(1), fat: +((f?.per100g.fat ?? 0) * k).toFixed(1), fiber: +((f?.per100g.fiber ?? 0) * k).toFixed(1) };
};
const useFoods = () => useList<Food>('/nutrition/foods', { limit: 500 });

/* ---------------- Add food dialog (log or plan) ---------------- */
function AddFoodDialog({ open, onOpenChange, title, onAdd }: { open: boolean; onOpenChange: (o: boolean) => void; title: string; onAdd: (foodId: string, grams: number) => Promise<unknown> }) {
  const foods = useFoods();
  const [q, setQ] = useState('');
  const [foodId, setFoodId] = useState('');
  const [mode, setMode] = useState<'g' | 'unit'>('g');
  const [amount, setAmount] = useState('100');
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (open) { setQ(''); setFoodId(''); setAmount('100'); setMode('g'); } }, [open]);
  const filtered = (foods.data?.items ?? []).filter((f) => f.name.toLowerCase().includes(q.toLowerCase()));
  const food = foods.data?.items.find((f) => f._id === foodId);
  const grams = mode === 'unit' && food?.gramsPerUnit ? Number(amount) * food.gramsPerUnit : Number(amount);
  const m = macrosFor(food, grams || 0);
  return (
    <Dialog open={open} onOpenChange={onOpenChange} title={title}>
      <div className="space-y-4">
        <Input placeholder="Search foods" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search foods" autoFocus />
        <ul className="max-h-56 overflow-y-auto -mx-2 panel rounded-xl p-1" role="listbox" aria-label="Foods">
          {filtered.map((f) => (
            <li key={f._id}>
              <button role="option" aria-selected={foodId === f._id} onClick={() => { setFoodId(f._id); if (f.gramsPerUnit) { setMode('unit'); setAmount('1'); } else { setMode('g'); setAmount('100'); } }}
                className={cn('w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-sm text-left', foodId === f._id ? 'bg-leaf-soft text-leaf-ink' : 'hover:bg-sunken')}>
                <span className="truncate">{f.name}</span><span className="text-xs text-muted num shrink-0">{f.per100g.protein}g P /100g</span>
              </button>
            </li>
          ))}
          {!filtered.length && <li className="px-3 py-4 text-sm text-muted">No match. Add it in the Foods tab.</li>}
        </ul>
        {food && (
          <>
            <div className="flex items-end gap-3">
              <Field label={mode === 'g' ? 'Grams' : `Number of ${food.unitName || 'units'}`} htmlFor="af-amt" className="flex-1">
                <Input id="af-amt" type="number" min={0} step={mode === 'g' ? '1' : '0.5'} value={amount} onChange={(e) => setAmount(e.target.value)} />
              </Field>
              {food.gramsPerUnit > 0 && <Segmented label="Unit" value={mode} onChange={(v) => { setMode(v); setAmount(v === 'g' ? String(food.gramsPerUnit) : '1'); }} options={[{ v: 'unit', label: food.unitName || 'unit' }, { v: 'g', label: 'grams' }]} />}
            </div>
            <div className="grid grid-cols-4 gap-2 text-center">
              {([['Protein', `${m.protein} g`], ['Calories', m.kcal], ['Carbs', `${m.carbs} g`], ['Fat', `${m.fat} g`]] as const).map(([k, v]) => (
                <div key={k} className="rounded-xl bg-sunken py-2"><p className="text-[11px] text-muted">{k}</p><p className="font-semibold num text-sm">{v}</p></div>
              ))}
            </div>
            {!food.verified && <p className="text-xs text-amber flex gap-1.5"><AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-px" />Estimated values. Correct them in Foods if you have the label.</p>}
          </>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button disabled={!food || !(grams > 0)} loading={busy} onClick={async () => { setBusy(true); try { await onAdd(foodId, Math.round(grams)); onOpenChange(false); } finally { setBusy(false); } }}>Add food</Button>
        </div>
      </div>
    </Dialog>
  );
}

/* ---------------- Today ---------------- */
function TodayTab() {
  const today = useToday();
  const [date, setDate] = useState(today);
  useEffect(() => setDate(today), [today]);
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['nutrition-day', date], queryFn: () => get<NutritionDay>('/nutrition/day', { date }) });
  const refresh = () => { qc.invalidateQueries({ queryKey: ['nutrition-day'] }); qc.invalidateQueries({ queryKey: ['dashboard'] }); qc.invalidateQueries({ queryKey: ['nutrition-series'] }); };
  const add = useMutation({ mutationFn: (b: { mealType: MealType; food: string; quantityG: number }) => post('/nutrition/entries', { ...b, date }), onSuccess: refresh, onError: (e) => toast.error(apiError(e)) });
  const del = useMutation({ mutationFn: (id: string) => api.delete(`/nutrition/entries/${id}`), onSuccess: refresh, onError: (e) => toast.error(apiError(e)) });
  const apply = useMutation({ mutationFn: (mealType?: MealType) => post<MealEntry[]>(`/nutrition/plan/${weekdayOf(date)}/apply`, { date, mealType }), onSuccess: (r) => { refresh(); toast.success(`Added ${r.length} items from your ${DAY_SHORT[weekdayOf(date)]} plan`); }, onError: (e) => toast.error(apiError(e)) });
  const [adding, setAdding] = useState<MealType | null>(null);
  const d = q.data;
  const pMin = d?.targets.proteinMinG ?? 0;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3 justify-between">
        <DateNav date={date} onChange={setDate} max={today} />
        <Button variant="outline" onClick={() => apply.mutate(undefined)} loading={apply.isPending}><Wand2 className="h-4 w-4" />Log {dateTitle(date, today).toLowerCase()}’s plan</Button>
      </div>
      {q.isLoading || !d ? <Skeleton className="h-40" /> : (
        <section className="panel p-5 sm:p-6 rounded-3xl grid md:grid-cols-[1.2fr_1fr] gap-6 items-center">
          <div>
            <p className="text-sm text-muted">Protein</p>
            <p className="font-display text-4xl font-semibold num mt-1">{d.totals.protein}<span className="text-lg text-muted"> / {pMin}–{d.targets.proteinMaxG} g</span></p>
            <Progress value={d.totals.protein} max={pMin || 1} className="mt-3 h-3" label="Protein progress" />
            <p className="text-sm text-muted mt-2">{d.totals.protein >= pMin ? 'Target reached.' : `${(pMin - d.totals.protein).toFixed(1)} g to go.`}</p>
          </div>
          <dl className="grid grid-cols-2 gap-3">
            {([['Calories', `${d.totals.kcal} kcal`], ['Carbs', `${d.totals.carbs} g`], ['Fat', `${d.totals.fat} g`], ['Fiber', `${d.totals.fiber} g`]] as const).map(([k, v]) => (
              <div key={k} className="rounded-xl bg-sunken px-3 py-2.5"><dt className="text-xs text-muted">{k}</dt><dd className="font-semibold num">{v}</dd></div>
            ))}
          </dl>
          {d.hasEstimates && <p className="md:col-span-2 text-xs text-amber flex gap-1.5"><AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-px" />Some foods use estimated reference values, so totals are approximate. Mark foods as verified after checking labels.</p>}
        </section>
      )}
      <div className="grid md:grid-cols-2 gap-5">
        {MEAL_TYPES.map((mt) => {
          const meal = d?.meals[mt];
          return (
            <Panel key={mt} title={MEAL_LABEL[mt]} action={<span className="text-xs text-muted num">{meal ? `${meal.totals.protein} g P · ${meal.totals.kcal} kcal` : ''}</span>}>
              {!meal?.entries.length ? (
                <div className="flex gap-2 flex-wrap">
                  <Button size="sm" variant="outline" onClick={() => setAdding(mt)}><Plus className="h-4 w-4" />Add food</Button>
                  <Button size="sm" variant="ghost" onClick={() => apply.mutate(mt)}>Use plan</Button>
                </div>
              ) : (
                <>
                  <ul className="divide-y divide-line -mx-5">
                    {meal.entries.map((e) => (
                      <li key={e._id} className="flex items-center gap-3 px-5 py-2">
                        <div className="flex-1 min-w-0"><p className="text-sm truncate">{e.foodName}{e.estimated && <span className="text-amber" title="Estimated values"> *</span>}</p><p className="text-xs text-muted num">{e.quantityG} g · {e.macros.protein} g P · {e.macros.kcal} kcal</p></div>
                        <Button variant="ghost" size="icon" aria-label={`Remove ${e.foodName}`} onClick={() => del.mutate(e._id)}><Trash2 className="h-4 w-4 text-muted" /></Button>
                      </li>
                    ))}
                  </ul>
                  <Button size="sm" variant="ghost" className="mt-2 -ml-2" onClick={() => setAdding(mt)}><Plus className="h-4 w-4" />Add food</Button>
                </>
              )}
            </Panel>
          );
        })}
      </div>
      <AddFoodDialog open={!!adding} onOpenChange={(o) => !o && setAdding(null)} title={`Add to ${adding ? MEAL_LABEL[adding].toLowerCase() : ''}`}
        onAdd={(food, quantityG) => add.mutateAsync({ mealType: adding!, food, quantityG })} />
    </div>
  );
}

/* ---------------- Weekly plan ---------------- */
function PlanTab() {
  const today = useToday();
  const qc = useQueryClient();
  const plans = useQuery({ queryKey: ['meal-plan'], queryFn: () => get<MealPlan[]>('/nutrition/plan') });
  const foods = useFoods();
  const [dow, setDow] = useState(weekdayOf(today));
  const [adding, setAdding] = useState<MealType | null>(null);
  const plan = plans.data?.find((p) => p.dayOfWeek === dow);
  const fmap = useMemo(() => new Map(foods.data?.items.map((f) => [f._id, f])), [foods.data]);
  const save = useMutation({
    mutationFn: (items: { mealType: MealType; food: string; quantityG: number }[]) => put(`/nutrition/plan/${dow}`, { items }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['meal-plan'] }); qc.invalidateQueries({ queryKey: ['grocery'] }); },
    onError: (e) => toast.error(apiError(e)),
  });
  const items = plan?.items ?? [];
  const total = items.reduce((s, i) => { const m = macrosFor(fmap.get(i.food), i.quantityG); return { protein: s.protein + m.protein, kcal: s.kcal + m.kcal }; }, { protein: 0, kcal: 0 });
  const simple = (list: typeof items) => list.map((i) => ({ mealType: i.mealType, food: i.food, quantityG: i.quantityG }));

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <Segmented label="Day" value={dow} onChange={setDow} options={[1, 2, 3, 4, 5, 6, 0].map((d) => ({ v: d, label: DAY_SHORT[d] }))} />
        <p className="text-sm text-muted num">≈ {total.protein.toFixed(0)} g protein · {total.kcal} kcal</p>
      </div>
      {plans.isLoading ? <Skeleton className="h-60" /> : (
        <div className="grid md:grid-cols-2 gap-5">
          {MEAL_TYPES.map((mt) => (
            <Panel key={mt} title={MEAL_LABEL[mt]} action={<Button size="sm" variant="ghost" onClick={() => setAdding(mt)}><Plus className="h-4 w-4" />Add</Button>}>
              <ul className="space-y-1.5">
                {items.map((it, idx) => it.mealType !== mt ? null : (
                  <li key={idx} className="flex items-center gap-2 text-sm">
                    <span className="flex-1 truncate">{it.foodName}</span>
                    <Input type="number" className="w-20 h-8" aria-label={`${it.foodName} grams`} defaultValue={it.quantityG}
                      onBlur={(e) => { const g = Number(e.target.value); if (g > 0 && g !== it.quantityG) save.mutate(simple(items.map((x, j) => j === idx ? { ...x, quantityG: g } : x))); }} />
                    <span className="text-xs text-muted w-4">g</span>
                    <Button variant="ghost" size="icon" aria-label={`Remove ${it.foodName}`} onClick={() => save.mutate(simple(items.filter((_, j) => j !== idx)))}><Trash2 className="h-4 w-4 text-muted" /></Button>
                  </li>
                ))}
                {!items.some((i) => i.mealType === mt) && <li className="text-sm text-muted">Nothing planned.</li>}
              </ul>
            </Panel>
          ))}
        </div>
      )}
      <AddFoodDialog open={!!adding} onOpenChange={(o) => !o && setAdding(null)} title={`Add to ${DAY_SHORT[dow]} ${adding ?? ''}`}
        onAdd={(food, quantityG) => save.mutateAsync([...simple(items), { mealType: adding!, food, quantityG }])} />
    </div>
  );
}

/* ---------------- Foods ---------------- */
const FOOD_FIELDS: FieldDef[] = [
  { name: 'name', label: 'Name', type: 'text', required: true, max: 80, full: true },
  { name: 'category', label: 'Category', type: 'select', options: ['protein', 'dairy', 'legume', 'grain', 'vegetable', 'fruit', 'nuts', 'snack', 'other'].map((v) => ({ value: v, label: v[0].toUpperCase() + v.slice(1) })) },
  { name: 'kcal', label: 'Calories / 100 g', type: 'number', required: true, min: 0, max: 1000 },
  { name: 'protein', label: 'Protein g / 100 g', type: 'number', required: true, min: 0, max: 100, step: '0.1' },
  { name: 'carbs', label: 'Carbs g / 100 g', type: 'number', required: true, min: 0, max: 100, step: '0.1' },
  { name: 'fat', label: 'Fat g / 100 g', type: 'number', required: true, min: 0, max: 100, step: '0.1' },
  { name: 'fiber', label: 'Fiber g / 100 g', type: 'number', required: true, min: 0, max: 100, step: '0.1' },
  { name: 'unitName', label: 'Unit name', type: 'text', placeholder: 'egg, roti, glass', max: 20 },
  { name: 'gramsPerUnit', label: 'Grams per unit', type: 'number', min: 0, max: 2000 },
  { name: 'source', label: 'Source', type: 'text', placeholder: 'Pack label, IFCT 2017…', max: 160, full: true },
  { name: 'verified', label: 'I checked these values against a reliable source', type: 'checkbox', full: true },
];
function FoodsTab() {
  const [q, setQ] = useState('');
  const list = useList<Food>('/nutrition/foods', { limit: 500, q: q || undefined });
  const m = useResourceMutations<Food>('/nutrition/foods', { noun: 'Food' });
  const [edit, setEdit] = useState<Food | null>(null);
  const [open, setOpen] = useState(false);
  const [del, setDel] = useState<Food | null>(null);
  const toBody = (v: Record<string, unknown>) => ({ name: v.name, category: v.category, unitName: v.unitName, gramsPerUnit: v.gramsPerUnit ?? 0, source: v.source || 'Added by you', verified: v.verified,
    per100g: { kcal: v.kcal, protein: v.protein, carbs: v.carbs, fat: v.fat, fiber: v.fiber } });
  return (
    <div>
      <div className="flex gap-2 mb-4">
        <Input placeholder="Search foods" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-xs" aria-label="Search foods" />
        <Button className="ml-auto" onClick={() => { setEdit(null); setOpen(true); }}><Plus className="h-4 w-4" />New food</Button>
      </div>
      <div className="panel overflow-x-auto">
        <table className="w-full text-sm min-w-[720px]">
          <thead><tr className="text-xs text-muted text-left border-b border-line">{['Food', 'kcal', 'Protein', 'Carbs', 'Fat', 'Fiber', 'Data', ''].map((h) => <th key={h} className="font-normal px-4 py-2.5">{h}</th>)}</tr></thead>
          <tbody className="divide-y divide-line">
            {list.data?.items.map((f) => (
              <tr key={f._id}>
                <td className="px-4 py-2"><p className="font-medium">{f.name}</p><p className="text-xs text-muted">{f.category}{f.unitName ? ` · 1 ${f.unitName} = ${f.gramsPerUnit} g` : ''}</p></td>
                {[f.per100g.kcal, f.per100g.protein, f.per100g.carbs, f.per100g.fat, f.per100g.fiber].map((v, i) => <td key={i} className="px-4 py-2 num">{v}</td>)}
                <td className="px-4 py-2">{f.verified ? <Chip tone="leaf"><BadgeCheck className="h-3 w-3" />Verified</Chip> : <span title={f.source}><Chip tone="amber">Estimate</Chip></span>}</td>
                <td className="px-4 py-2 text-right whitespace-nowrap">
                  <Button variant="ghost" size="icon" aria-label={`Edit ${f.name}`} onClick={() => { setEdit(f); setOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" aria-label={`Delete ${f.name}`} onClick={() => setDel(f)}><Trash2 className="h-4 w-4" /></Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted mt-3">Values are per 100 g of the food as you weigh it (dry weight for dals, rice, oats). Starter values are estimates — edit them from your pack labels and tick “verified”.</p>
      <FormDialog open={open} onOpenChange={setOpen} title={edit ? 'Edit food' : 'New food'} fields={FOOD_FIELDS} submitLabel={edit ? 'Save food' : 'Add food'}
        initial={edit ? { ...edit, ...edit.per100g } : { source: 'Added by you' }}
        onSubmit={(v) => edit ? m.update.mutateAsync({ id: edit._id, body: toBody(v) }) : m.create.mutateAsync(toBody(v))} />
      <ConfirmDialog open={!!del} onOpenChange={(o) => !o && setDel(null)} title={`Delete “${del?.name}”?`} description="Past meal logs keep their numbers. Remove it from your weekly plan separately."
        confirmLabel="Delete food" onConfirm={async () => { if (del) await m.remove.mutateAsync(del._id); setDel(null); }} />
    </div>
  );
}

/* ---------------- Grocery ---------------- */
function GroceryTab() {
  const q = useQuery({ queryKey: ['grocery'], queryFn: () => get<{ food: string; name: string; category: string; grams: number; units: number | null; unitName: string }[]>('/nutrition/grocery') });
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const fmt = (i: { grams: number; units: number | null; unitName: string }) => i.units ? `${i.units} × ${i.unitName}` : i.grams >= 1000 ? `${(i.grams / 1000).toFixed(2)} kg` : `${i.grams} g`;
  const copy = () => {
    const text = (q.data ?? []).map((i) => `- ${i.name}: ${fmt(i)}`).join('\n');
    navigator.clipboard.writeText(`Grocery list (weekly plan)\n${text}`).then(() => toast.success('Copied to clipboard'), () => toast.error('Clipboard not available'));
  };
  const groups = Object.entries((q.data ?? []).reduce<Record<string, NonNullable<typeof q.data>>>((acc, i) => { (acc[i.category] ??= []).push(i); return acc; }, {}));
  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-4">
        <p className="text-sm text-muted">Totals for one week of your meal plan. Tick what you already have.</p>
        <Button variant="outline" onClick={copy}><ClipboardCopy className="h-4 w-4" />Copy list</Button>
      </div>
      {q.isLoading ? <Skeleton className="h-60" /> : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {groups.map(([cat, items]) => (
            <Panel key={cat} title={cat[0].toUpperCase() + cat.slice(1)}>
              <ul className="space-y-1">
                {items.map((i) => (
                  <li key={i.food}>
                    <label className="flex items-center gap-3 py-1 text-sm cursor-pointer">
                      <input type="checkbox" className="h-4 w-4 accent-[hsl(var(--leaf))]" checked={checked.has(i.food)}
                        onChange={() => setChecked((s) => { const n = new Set(s); if (n.has(i.food)) n.delete(i.food); else n.add(i.food); return n; })} />
                      <span className={cn('flex-1', checked.has(i.food) && 'line-through text-muted')}>{i.name}</span>
                      <span className="text-muted num text-xs">{fmt(i)}</span>
                    </label>
                  </li>
                ))}
              </ul>
            </Panel>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------------- Trends ---------------- */
function TrendsTab() {
  const [days, setDays] = useState(7);
  const q = useQuery({ queryKey: ['nutrition-series', days], queryFn: () => get<(Macros & { date: string })[]>('/nutrition/series', { days }) });
  const s = useSettings();
  const target = s.data?.profile.targets.proteinMinG ?? 0;
  const logged = q.data?.filter((x) => x.kcal > 0) ?? [];
  const avg = (k: keyof Macros) => logged.length ? (logged.reduce((t, x) => t + x[k], 0) / logged.length).toFixed(k === 'kcal' ? 0 : 1) : '—';
  return (
    <div className="space-y-5">
      <Segmented label="Range" value={days} onChange={setDays} options={[{ v: 7, label: '7 days' }, { v: 30, label: '30 days' }]} />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {([['Avg protein', `${avg('protein')} g`], ['Avg calories', avg('kcal')], ['Days on protein target', target ? logged.filter((x) => x.protein >= target).length : '—'], ['Days logged', logged.length]] as const).map(([k, v]) => (
          <div key={k} className="panel p-4"><p className="text-xs text-muted">{k}</p><p className="font-display text-2xl font-semibold num mt-1">{v}</p></div>
        ))}
      </div>
      <Panel title="Protein per day">
        <div className="h-64 -ml-2"><ResponsiveContainer><BarChart data={q.data ?? []}><CartesianGrid vertical={false} stroke="hsl(var(--line))" />
          <XAxis dataKey="date" tickFormatter={(d) => (days <= 7 ? shortDay(d) : prettyDate(d, { day: 'numeric' }))} tick={axisTick} tickLine={false} axisLine={false} />
          <YAxis tick={axisTick} tickLine={false} axisLine={false} width={32} />
          <Tooltip {...chartTooltip} labelFormatter={(d) => prettyDate(String(d), { weekday: 'short', day: 'numeric', month: 'short' })} formatter={(v: number) => [`${v} g`, 'Protein']} />
          {target > 0 && <ReferenceLine y={target} stroke="hsl(var(--muted))" strokeDasharray="4 4" />}
          <Bar dataKey="protein" fill="hsl(var(--leaf))" radius={[6, 6, 2, 2]} maxBarSize={28} /></BarChart></ResponsiveContainer></div>
      </Panel>
    </div>
  );
}

export default function NutritionPage() {
  const [tab, setTab] = useState('today');
  return (
    <div>
      <PageHeader title="Nutrition" subtitle="Vegetarian + eggs, measured against your protein target." />
      <PageTabs value={tab} onChange={setTab} tabs={[{ v: 'today', label: 'Today' }, { v: 'plan', label: 'Weekly plan' }, { v: 'foods', label: 'Foods' }, { v: 'grocery', label: 'Grocery list' }, { v: 'trends', label: 'Trends' }]}>
        <TabPanel value="today"><TodayTab /></TabPanel>
        <TabPanel value="plan"><PlanTab /></TabPanel>
        <TabPanel value="foods"><FoodsTab /></TabPanel>
        <TabPanel value="grocery"><GroceryTab /></TabPanel>
        <TabPanel value="trends"><TrendsTab /></TabPanel>
      </PageTabs>
    </div>
  );
}
