import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { z } from 'zod';
import { AuthShell } from './AuthShell';
import { loginSchema } from './schemas';
import { Field, Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/context/AuthContext';
import { apiError } from '@/lib/api';
import { authApi } from '@/services/auth.service';

export default function LoginPage() {
  const { login } = useAuth();
  const nav = useNavigate();
  const loc = useLocation() as { state?: { from?: string } };
  const cfg = useQuery({ queryKey: ['auth-config'], queryFn: authApi.config });
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<z.infer<typeof loginSchema>>({ resolver: zodResolver(loginSchema) });

  const onSubmit = handleSubmit(async (v) => {
    try {
      await login(v.email, v.password);
      nav(loc.state?.from ?? '/', { replace: true });
    } catch (e) {
      toast.error(apiError(e, 'Could not log in'));
    }
  });

  return (
    <AuthShell title="Welcome back" subtitle="Log in to continue your streak."
      footer={cfg.data?.registrationOpen && <>New here? <Link to="/register" className="text-leaf font-medium hover:underline">{cfg.data.firstRun ? 'Create the first account' : 'Create an account'}</Link></>}>
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <Field label="Email" htmlFor="email" error={errors.email?.message}>
          <Input id="email" type="email" autoComplete="email" autoFocus aria-invalid={!!errors.email} {...register('email')} />
        </Field>
        <Field label="Password" htmlFor="password" error={errors.password?.message}>
          <Input id="password" type="password" autoComplete="current-password" aria-invalid={!!errors.password} {...register('password')} />
        </Field>
        <div className="flex justify-end -mt-1">
          <Link to="/forgot-password" className="text-sm text-muted hover:text-ink">Forgot password?</Link>
        </div>
        <Button type="submit" size="lg" className="w-full" loading={isSubmitting}>Log in</Button>
      </form>
    </AuthShell>
  );
}
