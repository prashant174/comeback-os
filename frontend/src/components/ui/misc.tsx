import * as S from '@radix-ui/react-switch';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('relative overflow-hidden rounded-xl bg-sunken', className)} aria-hidden>
    <div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-white/40 dark:via-white/5 to-transparent" />
  </div>;
}

export function Switch({ checked, onCheckedChange, id, label }: { checked: boolean; onCheckedChange: (v: boolean) => void; id?: string; label: string }) {
  return (
    <S.Root id={id} checked={checked} onCheckedChange={onCheckedChange} aria-label={label}
      className="relative h-6 w-11 shrink-0 rounded-full bg-line data-[state=checked]:bg-leaf transition-colors">
      <S.Thumb className="block h-5 w-5 translate-x-0.5 rounded-full bg-white shadow transition-transform data-[state=checked]:translate-x-[22px]" />
    </S.Root>
  );
}

export function EmptyState({ icon, title, body, action }: { icon: ReactNode; title: string; body: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center text-center py-14 px-6">
      <div className="h-12 w-12 rounded-2xl bg-leaf-soft text-leaf grid place-items-center mb-4">{icon}</div>
      <h3 className="font-display text-lg font-semibold">{title}</h3>
      <p className="text-sm text-muted mt-1 max-w-sm">{body}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-semibold">{title}</h1>
        {subtitle && <p className="text-muted mt-1">{subtitle}</p>}
      </div>
      {actions && <div className="flex gap-2">{actions}</div>}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="panel p-6 text-center">
      <p className="text-sm text-danger">{message}</p>
      {onRetry && <button onClick={onRetry} className="mt-3 text-sm font-medium text-leaf hover:underline">Try again</button>}
    </div>
  );
}
