import { Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { shortDay } from '@/lib/date';
import { formatMl } from '@/lib/utils';

type Row = { date: string; habitPct: number; waterMl: number };

export function WeeklyChart({ data, waterTarget }: { data: Row[]; waterTarget: number }) {
  const rows = data.map((d) => ({ ...d, day: shortDay(d.date), waterPct: waterTarget ? Math.min(100, Math.round((d.waterMl / waterTarget) * 100)) : 0 }));
  return (
    <div className="h-[240px] -ml-2">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid vertical={false} stroke="hsl(var(--line))" />
          <XAxis dataKey="day" tickLine={false} axisLine={false} tick={{ fill: 'hsl(var(--muted))', fontSize: 12 }} />
          <YAxis domain={[0, 100]} ticks={[0, 50, 100]} tickFormatter={(v) => `${v}%`} tickLine={false} axisLine={false} width={40} tick={{ fill: 'hsl(var(--muted))', fontSize: 12 }} />
          <Tooltip
            cursor={{ fill: 'hsl(var(--sunken))' }}
            contentStyle={{ background: 'hsl(var(--surface))', border: '1px solid hsl(var(--line))', borderRadius: 12, fontSize: 13 }}
            formatter={(value: number, name: string, item) =>
              name === 'waterPct' ? [`${formatMl(item.payload.waterMl)} (${value}%)`, 'Water'] : [`${value}%`, 'Habits']}
            labelStyle={{ color: 'hsl(var(--ink))', fontWeight: 600 }}
          />
          <Bar dataKey="habitPct" fill="hsl(var(--leaf))" radius={[6, 6, 2, 2]} maxBarSize={28} />
          <Line dataKey="waterPct" stroke="hsl(var(--water))" strokeWidth={2.5} dot={{ r: 3, fill: 'hsl(var(--water))' }} type="monotone" />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
