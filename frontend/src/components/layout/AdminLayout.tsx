import { Outlet } from 'react-router-dom';
import { LogOut, ShieldCheck } from 'lucide-react';
import { Logo } from '@/components/Logo';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/context/AuthContext';

/** Minimal shell for the admin account — no personal-tracker navigation. */
export function AdminLayout() {
  const { user, logout } = useAuth();
  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-30 h-14 sm:h-16 flex items-center justify-between gap-3 px-4 sm:px-6 bg-surface/90 backdrop-blur border-b border-line" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
        <div className="flex items-center gap-3"><Logo /><span className="hidden sm:inline-flex items-center gap-1 h-6 px-2 rounded-md bg-water-soft text-water text-xs font-medium"><ShieldCheck className="h-3.5 w-3.5" />Admin</span></div>
        <div className="flex items-center gap-2">
          <span className="hidden sm:block text-sm text-muted">{user?.email}</span>
          <Button variant="ghost" size="sm" onClick={() => logout()}><LogOut className="h-4 w-4" />Log out</Button>
        </div>
      </header>
      <main className="px-4 sm:px-6 lg:px-8 py-6 w-full max-w-[1240px] mx-auto pb-16"><Outlet /></main>
    </div>
  );
}
