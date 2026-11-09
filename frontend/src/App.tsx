import { lazy, Suspense, type ReactNode } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { AppLayout } from '@/components/layout/AppLayout';
import { Logo } from '@/components/Logo';
import NotFoundPage from '@/pages/NotFoundPage';

const LoginPage = lazy(() => import('@/features/auth/LoginPage'));
const RegisterPage = lazy(() => import('@/features/auth/RegisterPage'));
const ForgotPasswordPage = lazy(() => import('@/features/auth/ForgotPasswordPage'));
const ResetPasswordPage = lazy(() => import('@/features/auth/ResetPasswordPage'));
const DashboardPage = lazy(() => import('@/features/dashboard/DashboardPage'));
const HabitsPage = lazy(() => import('@/features/habits/HabitsPage'));
const WaterPage = lazy(() => import('@/features/water/WaterPage'));
const SettingsPage = lazy(() => import('@/features/settings/SettingsPage'));
const RoutinePage = lazy(() => import('@/features/routine/RoutinePage'));
const FitnessPage = lazy(() => import('@/features/fitness/FitnessPage'));
const NutritionPage = lazy(() => import('@/features/nutrition/NutritionPage'));
const LearningPage = lazy(() => import('@/features/learning/LearningPage'));
const FinancePage = lazy(() => import('@/features/finance/FinancePage'));
const GroomingPage = lazy(() => import('@/features/grooming/GroomingPage'));
const SleepPage = lazy(() => import('@/features/sleep/SleepPage'));
const GoalsPage = lazy(() => import('@/features/goals/GoalsPage'));
const JournalPage = lazy(() => import('@/features/journal/JournalPage'));
const AnalyticsPage = lazy(() => import('@/features/analytics/AnalyticsPage'));
const AdminPage = lazy(() => import('@/features/admin/AdminPage'));
import { AdminLayout } from '@/components/layout/AdminLayout';

function Splash() {
  return <div className="min-h-dvh grid place-items-center"><div className="animate-pulse"><Logo /></div></div>;
}

function Protected({ children, role = 'user' }: { children: ReactNode; role?: 'user' | 'admin' }) {
  const { status, user } = useAuth();
  const loc = useLocation();
  if (status === 'loading') return <Splash />;
  if (status === 'anonymous') return <Navigate to="/login" replace state={{ from: loc.pathname + loc.search }} />;
  // the admin account only has the admin panel; regular users can't open it
  if (user?.role === 'admin' && role !== 'admin') return <Navigate to="/admin" replace />;
  if (user?.role !== 'admin' && role === 'admin') return <Navigate to="/" replace />;
  return <>{children}</>;
}

function PublicOnly({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  if (status === 'loading') return <Splash />;
  if (status === 'authenticated') return <Navigate to="/" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Suspense fallback={<Splash />}>
        <Routes>
          <Route path="/login" element={<PublicOnly><LoginPage /></PublicOnly>} />
          <Route path="/register" element={<PublicOnly><RegisterPage /></PublicOnly>} />
          <Route path="/forgot-password" element={<PublicOnly><ForgotPasswordPage /></PublicOnly>} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/admin" element={<Protected role="admin"><AdminLayout /></Protected>}>
            <Route index element={<AdminPage />} />
          </Route>
          <Route element={<Protected><AppLayout /></Protected>}>
            <Route index element={<DashboardPage />} />
            <Route path="habits" element={<HabitsPage />} />
            <Route path="water" element={<WaterPage />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="routine" element={<RoutinePage />} />
            <Route path="fitness" element={<FitnessPage />} />
            <Route path="nutrition" element={<NutritionPage />} />
            <Route path="learning" element={<LearningPage />} />
            <Route path="finance" element={<FinancePage />} />
            <Route path="grooming" element={<GroomingPage />} />
            <Route path="sleep" element={<SleepPage />} />
            <Route path="goals" element={<GoalsPage />} />
            <Route path="journal" element={<JournalPage />} />
            <Route path="analytics" element={<AnalyticsPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
