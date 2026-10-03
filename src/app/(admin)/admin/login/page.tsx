import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { LoginForm } from '@/features/admin/auth/login-form';

/** Not linked anywhere; hiding is UX only — RLS is the security boundary (PROJECT_SPEC §7). */
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('admin.meta');
  return {
    title: t('login'),
    robots: { index: false, follow: false },
  };
}

export default function AdminLoginPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 py-10">
      <LoginForm />
    </main>
  );
}
