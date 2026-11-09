import { forwardRef, type InputHTMLAttributes, type SelectHTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

const base =
  'w-full h-10 rounded-xl border border-line bg-surface px-3 text-sm text-ink placeholder:text-muted/70 transition-colors focus-visible:ring-2 focus-visible:ring-leaf focus-visible:ring-offset-0 focus-visible:border-leaf disabled:opacity-60 aria-[invalid=true]:border-danger';

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(({ className, ...props }, ref) => (
  <input ref={ref} className={cn(base, className)} {...props} />
));
Input.displayName = 'Input';

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(({ className, children, ...props }, ref) => (
  <select ref={ref} className={cn(base, 'appearance-none bg-[length:16px] bg-[right_10px_center] bg-no-repeat pr-8', className)}
    style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23888' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")" }}
    {...props}>
    {children}
  </select>
));
Select.displayName = 'Select';

type FieldProps = { label: string; htmlFor: string; error?: string; hint?: string; children: ReactNode; className?: string };
export function Field({ label, htmlFor, error, hint, children, className }: FieldProps) {
  return (
    <div className={cn('space-y-1.5', className)}>
      <label htmlFor={htmlFor} className="field-label block">{label}</label>
      {children}
      {error ? <p className="text-xs text-danger" role="alert">{error}</p> : hint ? <p className="hint">{hint}</p> : null}
    </div>
  );
}
