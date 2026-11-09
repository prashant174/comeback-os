import { useEffect, useRef, useState } from 'react';
import { Pause, Play, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { beep } from '@/lib/beep';

/** Countdown rest timer. Beeps and vibrates (where supported) at zero. */
export function RestTimer({ seconds = 60 }: { seconds?: number }) {
  const [total, setTotal] = useState(seconds);
  const [left, setLeft] = useState(seconds);
  const [running, setRunning] = useState(false);
  const ref = useRef<number>();
  useEffect(() => { setTotal(seconds); setLeft(seconds); }, [seconds]);
  useEffect(() => {
    if (!running) return;
    ref.current = window.setInterval(() => setLeft((l) => {
      if (l <= 1) { setRunning(false); beep(); navigator.vibrate?.(300); return 0; }
      return l - 1;
    }), 1000);
    return () => clearInterval(ref.current);
  }, [running]);
  const p = total ? left / total : 0;
  const r = 26, c = 2 * Math.PI * r;
  return (
    <div className="flex items-center gap-3">
      <svg viewBox="0 0 64 64" className="h-14 w-14" aria-hidden>
        <circle cx="32" cy="32" r={r} fill="none" className="stroke-sunken" strokeWidth="6" />
        <circle cx="32" cy="32" r={r} fill="none" className="stroke-leaf transition-[stroke-dasharray] duration-1000 ease-linear" strokeWidth="6" strokeLinecap="round" strokeDasharray={`${p * c} ${c}`} transform="rotate(-90 32 32)" />
      </svg>
      <div>
        <p className="font-display text-xl font-semibold num" aria-live="polite">{Math.floor(left / 60)}:{String(left % 60).padStart(2, '0')}</p>
        <div className="flex gap-1 mt-1">
          <Button type="button" size="sm" variant="secondary" onClick={() => { if (left === 0) setLeft(total); setRunning((x) => !x); }} aria-label={running ? 'Pause timer' : 'Start rest timer'}>
            {running ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}{running ? 'Pause' : 'Rest'}
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => { setRunning(false); setLeft(total); }} aria-label="Reset timer"><RotateCcw className="h-3.5 w-3.5" /></Button>
          {[30, 60, 90].map((s) => <Button key={s} type="button" size="sm" variant="ghost" className="px-2 text-xs" onClick={() => { setRunning(false); setTotal(s); setLeft(s); }}>{s}s</Button>)}
        </div>
      </div>
    </div>
  );
}
