import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

export type Theme = 'light' | 'dark' | 'system';
type Ctx = { theme: Theme; resolved: 'light' | 'dark'; setTheme: (t: Theme) => void };
const ThemeContext = createContext<Ctx | null>(null);
const KEY = 'cbos-theme';

const systemDark = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches;

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => {
    try { return (localStorage.getItem(KEY) as Theme) || 'system'; } catch { return 'system'; }
  });
  const [resolved, setResolved] = useState<'light' | 'dark'>(theme === 'system' ? (systemDark() ? 'dark' : 'light') : theme);

  useEffect(() => {
    const apply = () => {
      const r = theme === 'system' ? (systemDark() ? 'dark' : 'light') : theme;
      setResolved(r);
      document.documentElement.classList.toggle('dark', r === 'dark');
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', r === 'dark' ? '#0E1311' : '#F4F6F3');
    };
    apply();
    const mq = window.matchMedia?.('(prefers-color-scheme: dark)');
    mq?.addEventListener('change', apply);
    return () => mq?.removeEventListener('change', apply);
  }, [theme]);

  const setTheme = (t: Theme) => {
    setThemeState(t);
    try { localStorage.setItem(KEY, t); } catch { /* storage unavailable */ }
  };

  return <ThemeContext.Provider value={{ theme, resolved, setTheme }}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside ThemeProvider');
  return ctx;
};
