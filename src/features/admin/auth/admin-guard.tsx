'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { isAdminClaim, supabaseBrowser } from '@/lib/supabase/browser';

type GuardStatus = 'checking' | 'allowed';

/**
 * Session + role gate for every admin route (PROJECT_SPEC §7).
 *
 * This is a UX guard, not the security boundary: Postgres RLS rejects any
 * write from a session without `app_metadata.role = 'admin'` regardless of
 * what this component does. Anonymous visitors are bounced to the login page;
 * authenticated non-admins are signed out.
 */
export function AdminGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const t = useTranslations('admin.guard');
  const [status, setStatus] = useState<GuardStatus>('checking');

  useEffect(() => {
    let cancelled = false;
    const supabase = supabaseBrowser();

    async function check(): Promise<void> {
      const { data } = await supabase.auth.getSession();
      if (cancelled) return;

      const session = data.session;
      if (!session) {
        router.replace('/admin/login');
        return;
      }
      if (!isAdminClaim(session.user)) {
        await supabase.auth.signOut();
        router.replace('/admin/login');
        return;
      }
      setStatus('allowed');
    }

    void check();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        router.replace('/admin/login');
      }
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [router]);

  if (status !== 'allowed') {
    return (
      <p role="status" className="text-muted py-16 text-center text-sm font-bold">
        {t('loading')}
      </p>
    );
  }

  return <>{children}</>;
}
