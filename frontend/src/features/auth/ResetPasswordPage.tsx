import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import type { z } from 'zod';
import { AuthShell } from './AuthShell';
import { resetSchema } from './schemas';
import { Field, Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { apiError } from '@/lib/api';
import { authApi } from '@/services/auth.service';

export default function ResetPasswordPage() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const nav = useNavigate();
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<z.infer<typeof resetSchema>>({ resolver: zodResolver(resetSchema) });

  const onSubmit = handleSubmit(async (v) => {
    try {
      await authApi.reset(token, v.password);
      toast.success('Password reset. Log in with your new password.');
      nav('/login', { replace: true });
    } catch (e) { toast.error(apiError(e)); }
  });

  if (!token) {
    return <AuthShell title="Link incomplete" subtitle="This reset link is missing its token." footer={<Link to="/forgot-password" className="text-leaf font-medium hover:underline">Request a new link</Link>}><span /></AuthShell>;
  }

  return (
    <AuthShell title="Choose a new password" subtitle="All other sessions will be logged out.">
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <Field label="New password" htmlFor="password" error={errors.password?.message}>
          <Input id="password" type="password" autoComplete="new-password" autoFocus aria-invalid={!!errors.password} {...register('password')} />
        </Field>
        <Field label="Confirm password" htmlFor="confirm" error={errors.confirm?.message}>
          <Input id="confirm" type="password" autoComplete="new-password" aria-invalid={!!errors.confirm} {...register('confirm')} />
        </Field>
        <Button type="submit" size="lg" className="w-full" loading={isSubmitting}>Reset password</Button>
      </form>
    </AuthShell>
  );
}
