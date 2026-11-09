import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import type { z } from 'zod';
import { AuthShell } from './AuthShell';
import { forgotSchema } from './schemas';
import { Field, Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { apiError } from '@/lib/api';
import { authApi } from '@/services/auth.service';

export default function ForgotPasswordPage() {
  const [result, setResult] = useState<{ message: string; devResetLink?: string } | null>(null);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<z.infer<typeof forgotSchema>>({ resolver: zodResolver(forgotSchema) });

  const onSubmit = handleSubmit(async (v) => {
    try { setResult(await authApi.forgot(v.email)); } catch (e) { toast.error(apiError(e)); }
  });

  return (
    <AuthShell title="Reset your password" subtitle="Enter your account email to get a reset link."
      footer={<Link to="/login" className="text-leaf font-medium hover:underline">Back to log in</Link>}>
      {result ? (
        <div className="space-y-4">
          <p className="text-sm">{result.message}</p>
          {result.devResetLink ? (
            <div className="panel p-4 text-sm">
              <p className="text-muted mb-2">Email delivery isn't configured yet, so in development the link is shown here (and in the server log):</p>
              <a href={result.devResetLink} className="text-leaf font-medium break-all hover:underline">Open reset link</a>
            </div>
          ) : (
            <p className="text-sm text-muted">No email provider is configured, so check the server log for the link.</p>
          )}
        </div>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <Field label="Email" htmlFor="email" error={errors.email?.message}>
            <Input id="email" type="email" autoComplete="email" autoFocus aria-invalid={!!errors.email} {...register('email')} />
          </Field>
          <Button type="submit" size="lg" className="w-full" loading={isSubmitting}>Send reset link</Button>
        </form>
      )}
    </AuthShell>
  );
}
