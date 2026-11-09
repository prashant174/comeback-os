import {
  LayoutDashboard, CalendarClock, Dumbbell, Salad, Droplet, GraduationCap, Wallet, Sparkles,
  Moon, CircleCheckBig, Target, NotebookPen, ChartLine, Settings, type LucideIcon,
} from 'lucide-react';

export type NavItem = { to: string; label: string; icon: LucideIcon; mobile?: boolean };

export const NAV: NavItem[] = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, mobile: true },
  { to: '/routine', label: 'Daily routine', icon: CalendarClock, mobile: true },
  { to: '/fitness', label: 'Fitness', icon: Dumbbell },
  { to: '/nutrition', label: 'Nutrition', icon: Salad },
  { to: '/water', label: 'Water', icon: Droplet },
  { to: '/learning', label: 'Learning', icon: GraduationCap },
  { to: '/finance', label: 'Finance', icon: Wallet },
  { to: '/grooming', label: 'Grooming', icon: Sparkles },
  { to: '/sleep', label: 'Sleep', icon: Moon },
  { to: '/habits', label: 'Habits', icon: CircleCheckBig, mobile: true },
  { to: '/goals', label: 'Goals', icon: Target },
  { to: '/journal', label: 'Journal', icon: NotebookPen },
  { to: '/analytics', label: 'Analytics', icon: ChartLine },
  { to: '/settings', label: 'Settings', icon: Settings },
];
