import { useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Dialog } from '@/components/ui/dialog';
import { Field, Input, Select } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { HABIT_ICONS } from '@/components/HabitIcon';
import { HABIT_CATEGORIES, type Habit } from '@/types';
import { cn } from '@/lib/utils';

const DAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const schema = z.object({
  name: z.string().trim().min(1, 'Give it a name').max(80),
  description: z.string().max(300).optional(),
  category: z.enum(HABIT_CATEGORIES),
  icon: z.string(),
  frequency: z.enum(['daily', 'weekly']),
  daysOfWeek: z.array(z.number()).min(1, 'Pick at least one day'),
});
export type HabitFormValues = z.infer<typeof schema>;

type Props = { open: boolean; onOpenChange: (o: boolean) => void; initial?: Habit | null; onSubmit: (v: HabitFormValues) => Promise<unknown>; };

export function HabitFormDialog({ open, onOpenChange, initial, onSubmit }: Props) {
  const { register, handleSubmit, control, watch, reset, formState: { errors, isSubmitting } } = useForm<HabitFormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', description: '', category: 'other', icon: 'check', frequency: 'daily', daysOfWeek: [0, 1, 2, 3, 4, 5, 6] },
  });

  useEffect(() => {
    if (open) reset(initial
      ? { name: initial.name, description: initial.description, category: initial.category, icon: initial.icon, frequency: initial.frequency, daysOfWeek: initial.daysOfWeek }
      : { name: '', description: '', category: 'other', icon: 'check', frequency: 'daily', daysOfWeek: [0, 1, 2, 3, 4, 5, 6] });
  }, [open, initial, reset]);

  const frequency = watch('frequency');

  const submit = handleSubmit(async (v) => {
    await onSubmit({ ...v, daysOfWeek: v.frequency === 'daily' ? [0, 1, 2, 3, 4, 5, 6] : v.daysOfWeek });
    onOpenChange(false);
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange} title={initial ? 'Edit habit' : 'New habit'}>
      <form onSubmit={submit} className="space-y-4" noValidate>
        <Field label="Name" htmlFor="h-name" error={errors.name?.message}>
          <Input id="h-name" autoFocus placeholder="e.g. Read 10 pages" aria-invalid={!!errors.name} {...register('name')} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Category" htmlFor="h-cat">
            <Select id="h-cat" {...register('category')}>
              {HABIT_CATEGORIES.map((c) => <option key={c} value={c}>{c[0].toUpperCase() + c.slice(1)}</option>)}
            </Select>
          </Field>
          <Field label="Repeat" htmlFor="h-freq">
            <Select id="h-freq" {...register('frequency')}>
              <option value="daily">Every day</option>
              <option value="weekly">Specific days</option>
            </Select>
          </Field>
        </div>
        {frequency === 'weekly' && (
          <Controller control={control} name="daysOfWeek" render={({ field }) => (
            <fieldset>
              <legend className="field-label mb-1.5">Days</legend>
              <div className="flex gap-1.5">
                {DAYS.map((d, i) => {
                  const on = field.value.includes(i);
                  return (
                    <button type="button" key={i} aria-pressed={on} aria-label={DAY_NAMES[i]}
                      onClick={() => field.onChange(on ? field.value.filter((x) => x !== i) : [...field.value, i].sort())}
                      className={cn('h-9 w-9 rounded-lg text-sm font-medium border', on ? 'bg-leaf text-white border-leaf dark:text-[#06140D]' : 'border-line text-muted hover:bg-sunken')}>
                      {d}
                    </button>
                  );
                })}
              </div>
              {errors.daysOfWeek && <p className="text-xs text-danger mt-1">{errors.daysOfWeek.message}</p>}
            </fieldset>
          )} />
        )}
        <Controller control={control} name="icon" render={({ field }) => (
          <fieldset>
            <legend className="field-label mb-1.5">Icon</legend>
            <div className="grid grid-cols-9 gap-1.5">
              {Object.entries(HABIT_ICONS).map(([k, I]) => (
                <button type="button" key={k} aria-label={k} aria-pressed={field.value === k} onClick={() => field.onChange(k)}
                  className={cn('h-9 rounded-lg grid place-items-center border', field.value === k ? 'border-leaf bg-leaf-soft text-leaf-ink' : 'border-transparent text-muted hover:bg-sunken')}>
                  <I className="h-4 w-4" />
                </button>
              ))}
            </div>
          </fieldset>
        )} />
        <Field label="Note (optional)" htmlFor="h-desc">
          <Input id="h-desc" placeholder="Why this matters to you" {...register('description')} />
        </Field>
        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button type="submit" loading={isSubmitting}>{initial ? 'Save habit' : 'Add habit'}</Button>
        </div>
      </form>
    </Dialog>
  );
}
