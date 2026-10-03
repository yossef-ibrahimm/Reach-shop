'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, LogIn } from 'lucide-react';
import { isAdminClaim, supabaseBrowser } from '@/lib/supabase/browser';
import { basePath } from '@/lib/env';

const loginSchema = z.object({
  email: z.email({ message: 'أدخل بريدًا إلكترونيًا صحيحًا.' }),
  password: z.string().min(1, { message: 'أدخل كلمة المرور.' }),
});

type LoginValues = z.infer<typeof loginSchema>;

type Failure = 'invalid' | 'forbidden' | 'failed';

/**
 * Email + password sign-in (PROJECT_SPEC §7). A successful password login is
 * not enough — the JWT must also carry `app_metadata.role = 'admin'`, which
 * RLS enforces server-side; this component just mirrors that rule for UX.
 */
export function LoginForm() {
  const t = useTranslations('admin.login');
  const router = useRouter();
  const [failure, setFailure] = useState<Failure | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  // Already signed in as admin? Skip the form.
  useEffect(() => {
    let cancelled = false;
    const supabase = supabaseBrowser();
    void supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      if (data.session && isAdminClaim(data.session.user)) {
        router.replace('/admin/');
      } else if (data.session) {
        void supabase.auth.signOut();
      }
    });
    return () => {
      cancelled = true;
    };
  }, [router]);

  const onSubmit = async (values: LoginValues) => {
    setFailure(null);
    const supabase = supabaseBrowser();
    const { data, error } = await supabase.auth.signInWithPassword(values);

    if (error || !data.session) {
      setFailure('invalid');
      return;
    }
    if (!isAdminClaim(data.session.user)) {
      await supabase.auth.signOut();
      setFailure('forbidden');
      return;
    }
    router.replace('/admin/');
  };

  const input =
    'border-border bg-surface w-full rounded-md border px-3 py-2.5 text-base focus:border-navy-700';
  const label = 'mb-1 block text-sm font-bold';

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      noValidate
      className="border-border bg-surface w-full max-w-md space-y-4 border p-6 shadow-md sm:p-8"
    >
      <div className="space-y-1">
        <h1 className="text-2xl font-extrabold">{t('title')}</h1>
        <p className="text-muted text-sm">{t('subtitle')}</p>
      </div>

      {failure && (
        <p role="alert" className="bg-fire-50 text-fire-700 rounded-md p-3 text-sm font-bold">
          {t(failure)}
        </p>
      )}

      <div>
        <label htmlFor="login-email" className={label}>
          {t('email')}
        </label>
        <input
          id="login-email"
          type="email"
          dir="ltr"
          autoComplete="email"
          className={input}
          aria-invalid={Boolean(errors.email)}
          {...register('email')}
        />
        {errors.email && (
          <p role="alert" className="text-fire-700 mt-1 text-xs font-bold">
            {errors.email.message}
          </p>
        )}
      </div>

      <div>
        <label htmlFor="login-password" className={label}>
          {t('password')}
        </label>
        <input
          id="login-password"
          type="password"
          dir="ltr"
          autoComplete="current-password"
          className={input}
          aria-invalid={Boolean(errors.password)}
          {...register('password')}
        />
        {errors.password && (
          <p role="alert" className="text-fire-700 mt-1 text-xs font-bold">
            {errors.password.message}
          </p>
        )}
      </div>

      <button
        type="submit"
        disabled={isSubmitting}
        className="bg-primary hover:bg-primary-hover inline-flex w-full items-center justify-center gap-2 rounded-md px-4 py-2.5 text-sm font-bold text-white transition-colors disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isSubmitting ? (
          <Loader2 aria-hidden="true" className="size-4 animate-spin" />
        ) : (
          <LogIn aria-hidden="true" className="size-4" />
        )}
        {isSubmitting ? t('submitting') : t('submit')}
      </button>

      <a
        href={`${basePath}/`}
        className="text-muted hover:text-text block py-1 text-center text-sm font-bold underline-offset-4 hover:underline"
      >
        {t('backToSite')}
      </a>
    </form>
  );
}
