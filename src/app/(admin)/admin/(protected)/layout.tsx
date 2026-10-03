import { getTranslations } from 'next-intl/server';
import { AdminGuard } from '@/features/admin/auth/admin-guard';
import { AdminHeader } from '@/features/admin/auth/admin-header';

/**
 * Everything under this group requires an admin session (PROJECT_SPEC §7).
 * `/admin/login/` deliberately lives outside the group so the guard never
 * bounces the login page into a redirect loop.
 */
export default async function AdminProtectedLayout({ children }: { children: React.ReactNode }) {
  const t = await getTranslations('common');

  return (
    <AdminGuard>
      <div className="mx-auto flex min-h-screen max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6">
        <a
          href="#admin-main"
          className="bg-primary sr-only z-50 rounded-md px-4 py-2 text-sm font-bold text-white focus:not-sr-only focus:absolute focus:start-4 focus:top-4"
        >
          {t('skipToContent')}
        </a>
        <AdminHeader />
        <main id="admin-main" className="flex flex-1 flex-col gap-6">
          {children}
        </main>
      </div>
    </AdminGuard>
  );
}
