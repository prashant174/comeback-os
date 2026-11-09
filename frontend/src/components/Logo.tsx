/** The mark is an incomplete ring — a day in progress. */
export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <svg viewBox="0 0 32 32" className="h-7 w-7 shrink-0" aria-hidden>
        <circle cx="16" cy="16" r="11" fill="none" className="stroke-line" strokeWidth="5" />
        <circle cx="16" cy="16" r="11" fill="none" className="stroke-leaf" strokeWidth="5" strokeLinecap="round"
          strokeDasharray="52 69" transform="rotate(-90 16 16)" />
      </svg>
      {!compact && <span className="font-display text-[17px] font-semibold tracking-tight">Comeback OS</span>}
    </div>
  );
}
