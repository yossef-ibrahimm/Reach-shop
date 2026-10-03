'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { ExternalLink, LayoutDashboard, LogOut, Package } from 'lucide-react';
import { supabaseBrowser } from '@/lib/supabase/browser';
import { basePath } from '@/lib/env';

/** Persistent chrome for authenticated admin pages: brand, nav, site link, logout. */
export function AdminHeader() {
  const t = useTranslations('admin');
  const router = useRouter();

  const logout = async () => {
    await supabaseBrowser().auth.signOut();
    router.replace('/admin/login');
  };

  const navLink =
    'inline-flex items-center gap-1.5 rounded-md px-3 py-2.5 text-sm font-bold transition-colors hover:bg-surface-alt';
  const icon = 'size-4 shrink-0';

  return (
    <header className="border-border bg-surface flex flex-wrap items-center justify-between gap-3 border py-3 ps-4 pe-3 shadow-sm">
      <div className="flex flex-wrap items-center gap-2">
        <Link href="/admin/" className="text-base font-extrabold tracking-tight">
          {t('header.brand')}
        </Link>
        <nav aria-label={t('meta.title')} className="text-muted -ms-1 flex items-center gap-1">
          <Link href="/admin/" className={navLink}>
            <LayoutDashboard aria-hidden="true" className={icon} />
            {t('meta.dashboard')}
          </Link>
          <Link href="/admin/products/" className={navLink}>
            <Package aria-hidden="true" className={icon} />
            {t('meta.products')}
          </Link>
        </nav>
      </div>

      <div className="flex items-center gap-2">
        <a
          href={`${basePath}/`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-muted hover:bg-surface-alt inline-flex items-center gap-1.5 rounded-md px-3 py-2.5 text-sm font-bold transition-colors"
        >
          <ExternalLink aria-hidden="true" className={icon} />
          {t('header.viewSite')}
        </a>
        <button
          type="button"
          onClick={() => void logout()}
          className="text-fire-700 bg-fire-50 hover:bg-fire-600/15 inline-flex items-center gap-1.5 rounded-md px-3 py-2.5 text-sm font-bold transition-colors"
        >
          <LogOut aria-hidden="true" className={icon} />
          {t('header.logout')}
        </button>
      </div>
    </header>
  );
}
