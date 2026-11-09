import { useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import * as DM from '@radix-ui/react-dropdown-menu';
import { ChevronsLeft, ChevronsRight, LayoutGrid, LogOut, Megaphone, Moon, Sun, Monitor, UserRound, X } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { authApi } from '@/services/auth.service';
import { NotificationBell } from './NotificationBell';
import { AuthedImage } from '@/components/AuthedImage';
import { Dialog } from '@/components/ui/dialog';
import { NAV } from './nav';
import { Logo } from '@/components/Logo';
import { useAuth } from '@/context/AuthContext';
import { useTheme, type Theme } from '@/context/ThemeContext';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

function initials(name?: string) {
  return (name ?? '?').split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase();
}

function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const order: Theme[] = ['light', 'dark', 'system'];
  const Icon = theme === 'light' ? Sun : theme === 'dark' ? Moon : Monitor;
  return (
    <Button variant="ghost" size="icon" aria-label={`Theme: ${theme}. Switch theme`}
      onClick={() => setTheme(order[(order.indexOf(theme) + 1) % order.length])}>
      <Icon className="h-[18px] w-[18px]" />
    </Button>
  );
}

function ProfileMenu() {
  const { user, logout } = useAuth();
  return (
    <DM.Root>
      <DM.Trigger asChild>
        <button className="h-9 w-9 rounded-full bg-leaf-soft text-leaf-ink text-sm font-semibold grid place-items-center overflow-hidden" aria-label="Account menu">
          {user?.avatarUrl ? <AuthedImage src={user.avatarUrl} alt="" className="h-full w-full object-cover" /> : initials(user?.name)}
        </button>
      </DM.Trigger>
      <DM.Portal>
        <DM.Content align="end" sideOffset={8} className="z-50 min-w-[220px] panel shadow-xl p-1.5">
          <div className="px-3 py-2">
            <p className="text-sm font-medium truncate">{user?.name}</p>
            <p className="text-xs text-muted truncate">{user?.email}</p>
          </div>
          <DM.Separator className="h-px bg-line my-1" />
          <DM.Item asChild>
            <NavLink to="/settings" className="flex items-center gap-2 px-3 py-2 text-sm rounded-lg outline-none data-[highlighted]:bg-sunken">
              <UserRound className="h-4 w-4" /> Account settings
            </NavLink>
          </DM.Item>
          <DM.Item onSelect={() => logout()} className="flex items-center gap-2 px-3 py-2 text-sm rounded-lg outline-none data-[highlighted]:bg-sunken text-danger cursor-pointer">
            <LogOut className="h-4 w-4" /> Log out
          </DM.Item>
        </DM.Content>
      </DM.Portal>
    </DM.Root>
  );
}

function AnnouncementBanner() {
  const q = useQuery({ queryKey: ['auth-config'], queryFn: authApi.config, staleTime: 5 * 60_000 });
  const a = q.data?.announcement;
  const [hidden, setHidden] = useState(() => { try { return sessionStorage.getItem('cbos-ann-hidden') ?? ''; } catch { return ''; } });
  if (!a || hidden === a.text) return null;
  return (
    <div role="status" className={cn('mx-4 sm:mx-6 lg:mx-8 mt-3 rounded-xl px-4 py-2.5 text-sm flex items-start gap-3', a.tone === 'warning' ? 'bg-amber/15 text-ink' : 'bg-water-soft text-ink')}>
      <Megaphone className={cn('h-4 w-4 mt-0.5 shrink-0', a.tone === 'warning' ? 'text-amber' : 'text-water')} />
      <p className="flex-1">{a.text}</p>
      <button aria-label="Dismiss announcement" className="text-muted hover:text-ink" onClick={() => { try { sessionStorage.setItem('cbos-ann-hidden', a.text); } catch { /* ignore */ } setHidden(a.text); }}><X className="h-4 w-4" /></button>
    </div>
  );
}

export function AppLayout() {
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem('cbos-sidebar') === '1'; } catch { return false; }
  });
  const loc = useLocation();
  const [moreOpen, setMoreOpen] = useState(false);
  const toggle = () => {
    setCollapsed((c) => {
      try { localStorage.setItem('cbos-sidebar', c ? '0' : '1'); } catch { /* ignore */ }
      return !c;
    });
  };

  return (
    <div className="min-h-dvh flex">
      {/* Sidebar — desktop/tablet */}
      <aside className={cn('print:hidden hidden md:flex flex-col shrink-0 border-r border-line bg-surface sticky top-0 h-dvh transition-[width] duration-200', collapsed ? 'w-[68px]' : 'w-[232px]')}>
        <div className={cn('h-16 flex items-center', collapsed ? 'justify-center' : 'px-5')}>
          <Logo compact={collapsed} />
        </div>
        <nav className="flex-1 overflow-y-auto px-2.5 pb-4" aria-label="Main">
          <ul className="space-y-0.5">
            {NAV.map((item) => {
              const Icon = item.icon;
              return (
                <li key={item.to}>
                  <NavLink to={item.to} end={item.to === '/'} title={collapsed ? item.label : undefined}
                    className={({ isActive }) => cn(
                      'flex items-center gap-3 h-9 rounded-lg text-sm transition-colors',
                      collapsed ? 'justify-center' : 'px-3',
                      isActive ? 'bg-leaf-soft text-leaf-ink font-medium' : 'text-ink/80 hover:bg-sunken',
                    )}>
                    <Icon className="h-[18px] w-[18px] shrink-0" />
                    {!collapsed && item.label}
                  </NavLink>
                </li>
              );
            })}
          </ul>
        </nav>
        <button onClick={toggle} className={cn('h-12 border-t border-line flex items-center gap-2 text-sm text-muted hover:text-ink', collapsed ? 'justify-center' : 'px-5')}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
          {collapsed ? <ChevronsRight className="h-4 w-4" /> : <><ChevronsLeft className="h-4 w-4" /> Collapse</>}
        </button>
      </aside>

      <div className="flex-1 min-w-0 flex flex-col">
        <header className="print:hidden sticky top-0 z-30 h-14 md:h-16 flex items-center justify-between gap-3 px-4 sm:px-6 bg-bg/85 backdrop-blur border-b border-line md:border-transparent"
          style={{ paddingTop: 'env(safe-area-inset-top)' }}>
          <div className="md:hidden"><Logo /></div>
          <div className="hidden md:block" />
          <div className="flex items-center gap-1.5">
            <NotificationBell />
            <ThemeToggle />
            <ProfileMenu />
          </div>
        </header>
        <AnnouncementBanner />
        <main key={loc.pathname} className="flex-1 px-4 sm:px-6 lg:px-8 py-5 sm:py-7 pb-28 md:pb-10 w-full max-w-[1240px] mx-auto">
          <Outlet />
        </main>
      </div>

      {/* Bottom nav — mobile: 4 shortcuts + "More" sheet with every module */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-surface/95 backdrop-blur border-t border-line pb-safe print:hidden" aria-label="Main mobile">
        <ul className="grid grid-cols-4">
          {NAV.filter((n) => n.mobile).map((item) => {
            const Icon = item.icon;
            return (
              <li key={item.to}>
                <NavLink to={item.to} end={item.to === '/'}
                  className={({ isActive }) => cn('flex flex-col items-center gap-1 py-2.5 text-[11px]', isActive ? 'text-leaf font-medium' : 'text-muted')}>
                  <Icon className="h-5 w-5" />
                  {item.label.replace('Daily routine', 'Routine')}
                </NavLink>
              </li>
            );
          })}
          <li>
            <button onClick={() => setMoreOpen(true)} className={cn('w-full flex flex-col items-center gap-1 py-2.5 text-[11px]', !NAV.some((n) => n.mobile && (n.to === '/' ? loc.pathname === '/' : loc.pathname.startsWith(n.to))) ? 'text-leaf font-medium' : 'text-muted')}>
              <LayoutGrid className="h-5 w-5" />More
            </button>
          </li>
        </ul>
      </nav>
      <Dialog open={moreOpen} onOpenChange={setMoreOpen} title="All modules">
        <ul className="grid grid-cols-3 gap-2">
          {NAV.map((item) => {
            const Icon = item.icon;
            return (
              <li key={item.to}>
                <NavLink to={item.to} end={item.to === '/'} onClick={() => setMoreOpen(false)}
                  className={({ isActive }) => cn('flex flex-col items-center gap-2 rounded-2xl py-4 text-xs text-center', isActive ? 'bg-leaf-soft text-leaf-ink font-medium' : 'bg-sunken text-ink')}>
                  <Icon className="h-5 w-5" />{item.label}
                </NavLink>
              </li>
            );
          })}
        </ul>
      </Dialog>
    </div>
  );
}
