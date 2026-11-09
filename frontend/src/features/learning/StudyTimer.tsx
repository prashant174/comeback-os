import { useEffect, useRef, useState } from 'react';
import { Pause, Play, Square } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Segmented } from '@/components/ui/kit';
import { cn } from '@/lib/utils';
import { beep } from '@/lib/beep';

type Mode = 'pomodoro' | 'timer';

/**
 * Pomodoro (25/5) or open-ended stopwatch. Time is computed from timestamps,
 * so it stays correct if the tab is throttled in the background.
 * Calls onFinish(minutes, mode) when a focus block completes or is stopped.
 */
export function StudyTimer({ onFinish }: { onFinish: (minutes: number, mode: Mode) => void }) {
  const [mode, setMode] = useState<Mode>('pomodoro');
  const [focusMin, setFocusMin] = useState(25);
  const [phase, setPhase] = useState<'focus' | 'break'>('focus');
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0); // seconds in current phase
  const startedAt = useRef<number | null>(null);
  const base = useRef(0);

  useEffect(() => {
    if (!running) return;
    startedAt.current = Date.now();
    const t = setInterval(() => setElapsed(base.current + Math.floor((Date.now() - startedAt.current!) / 1000)), 500);
    return () => clearInterval(t);
  }, [running]);

  const target = mode === 'pomodoro' ? (phase === 'focus' ? focusMin : 5) * 60 : null;
  useEffect(() => {
    if (target && elapsed >= target && running) {
      setRunning(false); base.current = 0; setElapsed(0);
      beep();
      navigator.vibrate?.([200, 100, 200]);
      if (phase === 'focus') { onFinish(focusMin, 'pomodoro'); setPhase('break'); }
      else setPhase('focus');
    }
  }, [elapsed, target, running, phase, focusMin, onFinish]);

  const pause = () => { base.current = elapsed; setRunning(false); };
  const stop = () => {
    const mins = Math.floor(elapsed / 60);
    setRunning(false); base.current = 0; setElapsed(0);
    if (phase === 'focus' && mins >= 1) onFinish(mins, mode);
    setPhase('focus');
  };
  const shown = target ? Math.max(0, target - elapsed) : elapsed;
  const ratio = target ? elapsed / target : (elapsed % 3600) / 3600;
  const r = 70, c = 2 * Math.PI * r;

  return (
    <div className="flex flex-col items-center">
      <Segmented label="Timer mode" value={mode} onChange={(m) => { if (!running) { setMode(m); setElapsed(0); base.current = 0; setPhase('focus'); } }}
        options={[{ v: 'pomodoro', label: 'Pomodoro' }, { v: 'timer', label: 'Stopwatch' }]} />
      <div className="relative my-5">
        <svg viewBox="0 0 160 160" className="h-44 w-44" aria-hidden>
          <circle cx="80" cy="80" r={r} fill="none" className="stroke-sunken" strokeWidth="10" />
          <circle cx="80" cy="80" r={r} fill="none" strokeWidth="10" strokeLinecap="round" className={cn(phase === 'break' ? 'stroke-water' : 'stroke-leaf')}
            strokeDasharray={`${Math.min(1, ratio) * c} ${c}`} transform="rotate(-90 80 80)" />
        </svg>
        <div className="absolute inset-0 grid place-items-center text-center">
          <div>
            <p className="font-display text-4xl font-semibold num" aria-live="off">{Math.floor(shown / 60)}:{String(shown % 60).padStart(2, '0')}</p>
            <p className="text-xs text-muted">{mode === 'pomodoro' ? (phase === 'focus' ? 'focus' : 'break') : 'elapsed'}</p>
          </div>
        </div>
      </div>
      {mode === 'pomodoro' && !running && phase === 'focus' && elapsed === 0 && (
        <div className="flex gap-1 mb-3">{[15, 25, 40, 50].map((m) => <Button key={m} size="sm" variant={focusMin === m ? 'secondary' : 'ghost'} onClick={() => setFocusMin(m)}>{m}m</Button>)}</div>
      )}
      <div className="flex gap-2">
        {running ? <Button onClick={pause}><Pause className="h-4 w-4" />Pause</Button> : <Button onClick={() => setRunning(true)}><Play className="h-4 w-4" />{elapsed ? 'Resume' : phase === 'break' ? 'Start break' : 'Start'}</Button>}
        <Button variant="outline" onClick={stop} disabled={!elapsed}><Square className="h-4 w-4" />Stop & log</Button>
      </div>
      <p className="text-xs text-muted mt-3 text-center max-w-[240px]">Completed focus blocks are logged automatically. Keep this tab open while the timer runs.</p>
    </div>
  );
}
