import { formatINR, formatMl, pct } from '@/lib/utils';
import { to12h, toMinutes, greetingFor } from '@/lib/date';

describe('formatting', () => {
  it('uses Indian grouping for rupees', () => {
    expect(formatINR(125000)).toBe('₹1,25,000');
    expect(formatINR(2500)).toBe('₹2,500');
  });
  it('formats ml and litres', () => {
    expect(formatMl(250)).toBe('250 ml');
    expect(formatMl(3000)).toBe('3 L');
    expect(formatMl(1500)).toBe('1.5 L');
  });
  it('caps percentages', () => {
    expect(pct(4000, 3000)).toBe(100);
    expect(pct(5, 0)).toBe(0);
  });
  it('converts times', () => {
    expect(to12h('06:15')).toBe('6:15 AM');
    expect(to12h('23:00')).toBe('11:00 PM');
    expect(to12h('12:05')).toBe('12:05 PM');
    expect(to12h('00:30')).toBe('12:30 AM');
    expect(toMinutes('21:45')).toBe(1305);
    expect(greetingFor(400)).toBe('Good morning');
  });
});
