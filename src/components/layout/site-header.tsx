'use client';

import { useEffect, useId, useState } from 'react';
import { Clock, Flame, Menu, Phone, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Link, usePathname, useRouter } from '@/lib/i18n/navigation';
import { cn } from '@/lib/cn';
import { telLink } from '@/lib/whatsapp';
import { FaWhatsapp } from 'react-icons/fa6';

type Props = {
  locale: string;
  companyName: string;
  hours: string;
  phones: string[];
  whatsappUrl: string | null;
};

const focusRing =
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fire-600';

export function SiteHeader({ locale, companyName, hours, phones, whatsappUrl }: Props) {
  const t = useTranslations('nav');
  const tc = useTranslations('common');
  const router = useRouter();
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const mobileNavId = useId();

  const cleanPath = pathname.replace(/\/+$/, '') || '/';

  const navItems = [
    { href: '/', label: t('home') },
    { href: '/products/', label: t('products') },
    { href: '/about/', label: t('about') },
    { href: '/contact/', label: t('contact') },
  ];

  const isActive = (href: string) => {
    const target = href.replace(/\/+$/, '') || '/';
    return target === '/' ? cleanPath === '/' : cleanPath.startsWith(target);
  };

  const closeMenu = () => setMenuOpen(false);

  // اقفل المنيو لما الصفحة تتغير
  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  // اقفل المنيو بـ Escape
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [menuOpen]);

  const switchLocale = () => {
    const query = typeof window !== 'undefined' ? window.location.search : '';
    router.push(`${cleanPath}${query}`, { locale: locale === 'ar' ? 'en' : 'ar' });
  };

  const hasContacts = phones.length > 0 || Boolean(whatsappUrl);
  const hasTopBar = Boolean(hours) || hasContacts;

  return (
    <header className="sticky top-0 z-40 shadow-sm">
      {hasTopBar && (
        <div className="bg-navy-950 text-inverse">
          <div className="container-page flex flex-wrap items-center justify-between gap-x-6 gap-y-1 py-1.5 text-xs">
            {hours && (
              <span className="flex items-center gap-1.5 opacity-90">
                <Clock aria-hidden="true" className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
                {hours}
              </span>
            )}

            {hasContacts && (
              <ul className="flex flex-wrap items-center gap-x-4 gap-y-1">
                {phones.map((phone) => (
                  <li key={phone}>
                    <a
                      href={telLink(phone)}
                      dir="ltr"
                      className={cn(
                        'phone inline-flex items-center gap-1.5 font-semibold transition-colors hover:text-white',
                        'focus-visible:outline-white',
                        focusRing,
                      )}
                    >
                      <Phone aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={1.75} />
                      {phone}
                    </a>
                  </li>
                ))}

                {whatsappUrl && (
                  <li>
                    <a
                      href={whatsappUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={cn(
                        'inline-flex items-center gap-1.5 font-semibold transition-colors hover:text-white',
                        'focus-visible:outline-white',
                        focusRing,
                      )}
                    >
                      <FaWhatsapp aria-hidden="true" className="h-3.5 w-3.5" />
                      {tc('whatsapp')}
                    </a>
                  </li>
                )}
              </ul>
            )}
          </div>
        </div>
      )}

      <div className="border-border bg-surface border-b">
        <div className="container-page flex h-16 items-center gap-3 lg:h-[72px] lg:gap-6">
          <Link
            href="/"
            className={cn('group flex shrink-0 items-center gap-2.5 rounded-md', focusRing)}
            aria-label={companyName}
          >
            <span className="bg-navy-900 text-fire-600 flex h-9 w-9 items-center justify-center rounded-md transition-transform group-hover:scale-105">
              <Flame aria-hidden="true" className="h-5 w-5" strokeWidth={1.75} />
            </span>
            <span className="max-w-[48vw] truncate text-lg font-extrabold sm:max-w-none">
              {companyName}
            </span>
          </Link>

          <nav aria-label={t('menu')} className="hidden lg:block">
            <ul className="flex items-center gap-1">
              {navItems.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={isActive(item.href) ? 'page' : undefined}
                    className={cn(
                      'rounded-md px-3 py-2 text-sm font-semibold transition-colors',
                      focusRing,
                      isActive(item.href)
                        ? 'bg-fire-50 text-fire-700'
                        : 'text-muted hover:text-text hover:bg-surface-alt',
                    )}
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <div className="ms-auto flex items-center gap-2">
            <button
              type="button"
              onClick={switchLocale}
              aria-label={t('switchLanguage')}
              className={cn(
                'border-border hover:bg-surface-alt inline-flex h-10 min-w-10 items-center justify-center rounded-md border px-3 text-sm font-bold transition-colors',
                focusRing,
              )}
            >
              <span lang={locale === 'ar' ? 'en' : 'ar'} aria-hidden="true">
                {locale === 'ar' ? 'EN' : 'ع'}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setMenuOpen((open) => !open)}
              aria-expanded={menuOpen}
              aria-controls={mobileNavId}
              aria-label={menuOpen ? t('closeMenu') : t('menu')}
              className={cn(
                'border-border hover:bg-surface-alt inline-flex h-10 w-10 items-center justify-center rounded-md border transition-colors lg:hidden',
                focusRing,
              )}
            >
              {menuOpen ? (
                <X aria-hidden="true" className="h-5 w-5" />
              ) : (
                <Menu aria-hidden="true" className="h-5 w-5" />
              )}
            </button>
          </div>
        </div>

        {menuOpen && (
          <nav
            id={mobileNavId}
            aria-label={t('menu')}
            className="border-border bg-surface max-h-[calc(100dvh-8rem)] overflow-y-auto border-t lg:hidden"
          >
            <ul className="container-page flex flex-col gap-1 py-2">
              {navItems.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={closeMenu}
                    aria-current={isActive(item.href) ? 'page' : undefined}
                    className={cn(
                      'block rounded-md px-3 py-3 font-semibold transition-colors',
                      focusRing,
                      isActive(item.href)
                        ? 'bg-fire-50 text-fire-700'
                        : 'text-muted hover:bg-surface-alt',
                    )}
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        )}
      </div>
    </header>
  );
}