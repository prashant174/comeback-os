import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DayRing, RingLegend } from '@/features/dashboard/DayRing';
import { Heatmap } from '@/features/habits/Heatmap';
import { AuthProvider } from '@/context/AuthContext';
import LoginPage from '@/features/auth/LoginPage';

vi.mock('@/lib/api', async (orig) => {
  const mod = await orig<typeof import('@/lib/api')>();
  return { ...mod, refreshAccessToken: vi.fn().mockResolvedValue(null) };
});
vi.mock('@/services/auth.service', () => ({
  authApi: { config: vi.fn().mockResolvedValue({ registrationOpen: true, firstRun: false }), login: vi.fn(), me: vi.fn() },
}));

describe('DayRing', () => {
  it('shows score and legend', () => {
    const rings = [{ key: 'habits', label: 'Habits', ratio: 0.5 }, { key: 'water', label: 'Water', ratio: 0.25 }];
    render(<><DayRing score={38} rings={rings} /><RingLegend rings={rings} /></>);
    expect(screen.getByRole('img', { name: /score 38 percent/i })).toBeInTheDocument();
    expect(screen.getByText('50%')).toBeInTheDocument();
    expect(screen.getByText('25%')).toBeInTheDocument();
  });
});

describe('Heatmap', () => {
  it('renders one cell per day', () => {
    const data = Array.from({ length: 14 }, (_, i) => ({ date: `2026-11-${String(i + 1).padStart(2, '0')}`, scheduled: 4, done: i % 5, ratio: (i % 5) / 4 }));
    const { container } = render(<Heatmap data={data} />);
    expect(container.querySelectorAll('[title*="/4"]').length).toBe(14);
  });
});

describe('LoginPage', () => {
  it('validates before submitting', async () => {
    const qc = new QueryClient();
    render(
      <QueryClientProvider client={qc}><MemoryRouter><AuthProvider><LoginPage /></AuthProvider></MemoryRouter></QueryClientProvider>,
    );
    await userEvent.click(screen.getByRole('button', { name: /log in/i }));
    expect(await screen.findByText('Enter a valid email')).toBeInTheDocument();
    expect(screen.getByText('Enter your password')).toBeInTheDocument();
  });
});
