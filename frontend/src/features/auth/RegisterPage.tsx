import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { z } from 'zod';
import { AuthShell } from './AuthShell';
import { registerSchema } from './schemas';
import { Field, Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/context/AuthContext';
import { apiError } from '@/lib/api';
import { authApi } from '@/services/auth.service';

export default function RegisterPage() {
  const { register: signup } = useAuth();
  const nav = useNavigate();
  const cfg = useQuery({ queryKey: ['auth-config'], queryFn: authApi.config });
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<z.infer<typeof registerSchema>>({ resolver: zodResolver(registerSchema) });

  const onSubmit = handleSubmit(async (v) => {
    try {
      await signup(v.name, v.email, v.password);
      toast.success('Account created. Your defaults are ready — tweak them in Settings.');
      nav('/', { replace: true });
    } catch (e) {
      toast.error(apiError(e, 'Could not create account'));
    }
  });

  if (cfg.data && !cfg.data.registrationOpen) {
    return (
      <AuthShell title="Registration is closed" subtitle="This Comeback OS instance is private." footer={<Link to="/login" className="text-leaf font-medium hover:underline">Back to log in</Link>}>
        <p className="text-sm text-muted">Ask the administrator to set ALLOW_REGISTRATION=true if you need an account.</p>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Create your account" subtitle={cfg.data?.firstRun ? 'The first account becomes the administrator.' : 'Start tracking in under a minute.'}
      footer={<>Already have an account? <Link to="/login" className="text-leaf font-medium hover:underline">Log in</Link></>}>
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <Field label="Name" htmlFor="name" error={errors.name?.message}>
          <Input id="name" autoComplete="name" autoFocus aria-invalid={!!errors.name} {...register('name')} />
        </Field>
        <Field label="Email" htmlFor="email" error={errors.email?.message}>
          <Input id="email" type="email" autoComplete="email" aria-invalid={!!errors.email} {...register('email')} />
        </Field>
        <Field label="Password" htmlFor="password" error={errors.password?.message} hint="8+ characters with a letter and a number">
          <Input id="password" type="password" autoComplete="new-password" aria-invalid={!!errors.password} {...register('password')} />
        </Field>
        <Button type="submit" size="lg" className="w-full" loading={isSubmitting}>Create account</Button>
      </form>
    </AuthShell>
  );
}
