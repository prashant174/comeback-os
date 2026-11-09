import type { ReactNode } from 'react';
import { Logo } from '@/components/Logo';

export function AuthShell({ title, subtitle, children, footer }: { title: string; subtitle: string; children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="min-h-dvh grid lg:grid-cols-[1fr_1.05fr]">
      <section className="hidden lg:flex flex-col justify-between p-12 bg-sunken border-r border-line relative overflow-hidden">
        <Logo />
        <div className="relative z-10 max-w-md">
          <p className="font-display text-[44px] leading-[1.05] font-semibold tracking-tight">
            Build yourself. Track your progress. Become better every day.
          </p>
          <p className="text-muted mt-5 leading-relaxed">
            Habits, water, workouts, food, learning and money — one place, measured against targets you set.
          </p>
        </div>
        <svg viewBox="0 0 400 400" className="absolute -right-24 -bottom-24 w-[460px] opacity-90" aria-hidden>
          {[170, 135, 100].map((r, i) => (
            <g key={r}>
              <circle cx="200" cy="200" r={r} fill="none" className="stroke-line" strokeWidth="18" />
              <circle cx="200" cy="200" r={r} fill="none" strokeWidth="18" strokeLinecap="round"
                className={i === 1 ? 'stroke-water' : 'stroke-leaf'}
                strokeDasharray={`${2 * Math.PI * r * [0.72, 0.55, 0.88][i]} 2000`} transform="rotate(-90 200 200)" />
            </g>
          ))}
        </svg>
        <p className="text-xs text-muted relative z-10">Your data stays in your own database.</p>
      </section>
      <section className="flex items-center justify-center px-5 py-12">
        <div className="w-full max-w-[380px]">
          <div className="lg:hidden mb-10"><Logo /></div>
          <h1 className="text-[28px] font-semibold">{title}</h1>
          <p className="text-muted mt-1.5 mb-8">{subtitle}</p>
          {children}
          {footer && <div className="mt-8 text-sm text-muted">{footer}</div>}
        </div>
      </section>
    </div>
  );
}
