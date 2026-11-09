import * as D from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Button } from './button';

type Props = { open: boolean; onOpenChange: (o: boolean) => void; title: string; description?: string; children: ReactNode; className?: string };

export function Dialog({ open, onOpenChange, title, description, children, className }: Props) {
  return (
    <D.Root open={open} onOpenChange={onOpenChange}>
      <D.Portal>
        <D.Overlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px]" />
        <D.Content
          className={cn(
            'fixed z-50 bg-surface border border-line shadow-2xl p-5 sm:p-6 focus:outline-none',
            'inset-x-0 bottom-0 rounded-t-3xl max-h-[90vh] overflow-y-auto pb-safe',
            'sm:inset-auto sm:left-1/2 sm:top-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:w-[min(92vw,480px)] sm:rounded-2xl',
            className,
          )}
        >
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <D.Title className="font-display text-lg font-semibold">{title}</D.Title>
              {description ? <D.Description className="text-sm text-muted mt-1">{description}</D.Description> : <D.Description className="sr-only">{title}</D.Description>}
            </div>
            <D.Close asChild><Button variant="ghost" size="icon" aria-label="Close"><X className="h-4 w-4" /></Button></D.Close>
          </div>
          {children}
        </D.Content>
      </D.Portal>
    </D.Root>
  );
}

type ConfirmProps = {
  open: boolean; onOpenChange: (o: boolean) => void; title: string; description: string;
  confirmLabel: string; onConfirm: () => void | Promise<void>; loading?: boolean; tone?: 'danger' | 'primary';
};
export function ConfirmDialog({ open, onOpenChange, title, description, confirmLabel, onConfirm, loading, tone = 'danger' }: ConfirmProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange} title={title} description={description}>
      <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 mt-2">
        <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
        <Button variant={tone} loading={loading} onClick={() => onConfirm()}>{confirmLabel}</Button>
      </div>
    </Dialog>
  );
}
