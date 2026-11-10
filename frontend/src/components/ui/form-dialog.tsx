import { useEffect, useMemo } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z, type ZodTypeAny } from 'zod';
import { Dialog } from './dialog';
import { Field, Input, Select } from './input';
import { Button } from './button';
import { Switch } from './misc';
import { cn } from '@/lib/utils';
import { DAY_LETTER } from '@/lib/date';

export type FieldDef = {
  name: string;
  label: string;
  type: 'text' | 'textarea' | 'number' | 'date' | 'time' | 'select' | 'multiselect' | 'checkbox' | 'tags' | 'days' | 'url';
  required?: boolean;
  min?: number;
  max?: number;
  step?: string;
  options?: { value: string; label: string }[];
  /** select values are numbers on the API */
  numeric?: boolean;
  hint?: string;
  placeholder?: string;
  full?: boolean;
};

const blankToUndef = (v: unknown) => (v === '' || v === null || v === undefined ? undefined : v);

/** Builds a zod schema from field definitions so every generic form is validated client-side too. */
function buildSchema(fields: FieldDef[]) {
  const shape: Record<string, ZodTypeAny> = {};
  for (const f of fields) {
    let s: ZodTypeAny;
    switch (f.type) {
      case 'number': {
        let n = z.number({ invalid_type_error: 'Enter a number', required_error: 'Required' });
        if (f.min !== undefined) n = n.min(f.min, `Min ${f.min}`);
        if (f.max !== undefined) n = n.max(f.max, `Max ${f.max}`);
        s = z.preprocess((v) => (blankToUndef(v) === undefined ? undefined : Number(v)), f.required ? n : n.optional().nullable());
        break;
      }
      case 'checkbox': s = z.boolean().default(false); break;
      case 'days': s = z.array(z.number()).min(1, 'Pick at least one day'); break;
      case 'multiselect': s = z.array(z.string()).default([]); break;
      case 'tags': s = z.union([z.string(), z.array(z.string())]).transform((v) => (Array.isArray(v) ? v : v.split(',').map((x) => x.trim()).filter(Boolean))); break;
      case 'date': s = f.required ? z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Pick a date') : z.string().optional().nullable().transform((v) => v || null); break;
      case 'time': s = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Pick a time'); break;
      case 'url': s = z.union([z.string().url('Enter a full URL (https://…)'), z.literal('')]).default(''); break;
      case 'select': s = f.numeric ? z.coerce.number() : z.string(); break;
      default: {
        let t = z.string().trim();
        if (f.max) t = t.max(f.max);
        s = f.required ? t.min(1, 'Required') : t.optional().default('');
      }
    }
    shape[f.name] = s;
  }
  return z.object(shape);
}

type Props = {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: string;
  description?: string;
  fields: FieldDef[];
  initial?: Record<string, unknown>;
  submitLabel: string;
  onSubmit: (values: Record<string, unknown>) => Promise<unknown> | unknown;
};

export function FormDialog({ open, onOpenChange, title, description, fields, initial, submitLabel, onSubmit }: Props) {
  const schema = useMemo(() => buildSchema(fields), [fields]);
  const defaults = useMemo(() => {
    const d: Record<string, unknown> = {};
    for (const f of fields) {
      const v = initial?.[f.name];
      d[f.name] = f.type === 'checkbox' ? Boolean(v) : f.type === 'tags' ? (Array.isArray(v) ? v.join(', ') : v ?? '') : f.type === 'days' ? (v ?? [1, 2, 3, 4, 5]) : f.type === 'multiselect' ? ((v as string[] | undefined) ?? []).map(String) : v ?? (f.type === 'select' ? f.options?.[0]?.value ?? '' : '');
      if (f.type === 'select' && v !== undefined && v !== null) d[f.name] = String(v);
    }
    return d;
  }, [fields, initial]);

  const { register, handleSubmit, control, reset, formState: { errors, isSubmitting } } = useForm<Record<string, unknown>>({ resolver: zodResolver(schema), defaultValues: defaults });
  useEffect(() => { if (open) reset(defaults); }, [open, defaults, reset]);

  const err = (n: string) => (errors[n]?.message as string | undefined) ?? undefined;

  return (
    <Dialog open={open} onOpenChange={onOpenChange} title={title} description={description} className="sm:w-[min(94vw,560px)]">
      <form noValidate className="grid sm:grid-cols-2 gap-4" onSubmit={handleSubmit(async (v) => { await onSubmit(v); onOpenChange(false); })}>
        {fields.map((f) => {
          const id = `fd-${f.name}`;
          const span = f.full || f.type === 'textarea' || f.type === 'days' ? 'sm:col-span-2' : '';
          if (f.type === 'checkbox') {
            return (
              <Controller key={f.name} control={control} name={f.name} render={({ field }) => (
                <label className={cn('flex items-center gap-3 text-sm', span)}>
                  <Switch checked={Boolean(field.value)} onCheckedChange={field.onChange} label={f.label} />{f.label}
                </label>
              )} />
            );
          }
          if (f.type === 'multiselect') {
            return (
              <Controller key={f.name} control={control} name={f.name} render={({ field }) => {
                const val = (field.value as string[]) ?? [];
                return (
                  <fieldset className="sm:col-span-2">
                    <legend className="field-label mb-1.5">{f.label}</legend>
                    {!f.options?.length ? <p className="hint">{f.hint ?? 'Nothing to choose yet.'}</p> : (
                      <div className="flex flex-wrap gap-1.5">
                        {f.options.map((o) => {
                          const on = val.includes(o.value);
                          return (
                            <button type="button" key={o.value} aria-pressed={on} onClick={() => field.onChange(on ? val.filter((x) => x !== o.value) : [...val, o.value])}
                              className={cn('h-8 px-3 rounded-full text-sm border', on ? 'bg-leaf-soft text-leaf-ink border-leaf/40' : 'border-line text-muted hover:bg-sunken')}>{o.label}</button>
                          );
                        })}
                      </div>
                    )}
                  </fieldset>
                );
              }} />
            );
          }
          if (f.type === 'days') {
            return (
              <Controller key={f.name} control={control} name={f.name} render={({ field }) => {
                const val = (field.value as number[]) ?? [];
                return (
                  <fieldset className={span}>
                    <legend className="field-label mb-1.5">{f.label}</legend>
                    <div className="flex gap-1.5">
                      {DAY_LETTER.map((d, i) => (
                        <button type="button" key={i} aria-pressed={val.includes(i)} onClick={() => field.onChange(val.includes(i) ? val.filter((x) => x !== i) : [...val, i].sort())}
                          className={cn('h-9 w-9 rounded-lg text-sm font-medium border', val.includes(i) ? 'bg-leaf text-white border-leaf dark:text-[#06140D]' : 'border-line text-muted hover:bg-sunken')}>{d}</button>
                      ))}
                    </div>
                    {err(f.name) && <p className="text-xs text-danger mt-1">{err(f.name)}</p>}
                  </fieldset>
                );
              }} />
            );
          }
          return (
            <Field key={f.name} label={f.label + (f.required ? '' : ' (optional)')} htmlFor={id} error={err(f.name)} hint={f.hint} className={span}>
              {f.type === 'textarea' ? (
                <textarea id={id} rows={4} placeholder={f.placeholder} {...register(f.name)}
                  className="w-full rounded-xl border border-line bg-surface px-3 py-2 text-sm text-ink focus-visible:ring-2 focus-visible:ring-leaf focus-visible:border-leaf" />
              ) : f.type === 'select' ? (
                <Select id={id} {...register(f.name)}>{f.options?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</Select>
              ) : (
                <Input id={id} type={f.type === 'tags' || f.type === 'url' ? 'text' : f.type} step={f.step} placeholder={f.placeholder} aria-invalid={!!err(f.name)} {...register(f.name)} />
              )}
            </Field>
          );
        })}
        <div className="sm:col-span-2 flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-1">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button type="submit" loading={isSubmitting}>{submitLabel}</Button>
        </div>
      </form>
    </Dialog>
  );
}
