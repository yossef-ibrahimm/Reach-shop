'use client';

import { useState } from 'react';
import { Flame, Menu, Phone, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Link, usePathname, useRouter } from '@/lib/i18n/navigation';
import { cn } from '@/lib/cn';
import { telLink } from '@/lib/whatsapp';
import { FaWhatsapp } from 'react-icons/fa6';

type Props = {
  locale: string;
  companyName: string;
  hours: string;
  phone: string | null;
  whatsappUrl: string | null;
};

export function SiteHeader({ locale, companyName, hours, phone, whatsappUrl }: Props) {
  const t = useTranslations('nav');
  const tc = useTranslations('common');
  const router = useRouter();
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

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

  const switchLocale = () => {
    const query = typeof window !== 'undefined' ? window.location.search : '';
    router.push(`${cleanPath}${query}`, { locale: locale === 'ar' ? 'en' : 'ar' });
  };

  return (
    <header className="sticky top-0 z-40">
      {(hours || phone) && (
        <div className="bg-navy-950 text-inverse">
          <div className="container-page flex h-9 items-center justify-between gap-4 text-xs">
            {hours && <span className="truncate">{hours}</span>}
            {phone && (
              <a
                href={telLink(phone)}
                dir="ltr"
                className="phone shrink-0 transition-colors hover:text-white"
              >
                {phone}
              </a>
            )}
          </div>
        </div>
      )}

      <div className="border-border bg-surface border-b">
        <div className="container-page flex h-16 items-center gap-3 lg:h-[72px] lg:gap-6">
          <Link
            href="/"
            className="group flex shrink-0 items-center gap-2.5"
            aria-label={companyName}
          >
            <span className="bg-navy-900 text-fire-600 flex h-9 w-9 items-center justify-center rounded-md">
              <Flame aria-hidden="true" className="h-5 w-5" strokeWidth={1.75} />
            </span>
            <span className="max-w-[42vw] truncate text-lg font-extrabold sm:max-w-none">
              {companyName}
            </span>
          </Link>

          <nav aria-label={t('menu')} className="hidden lg:block">
            <ul className="flex items-center gap-1">
              {navItems.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={closeMenu}
                    aria-current={isActive(item.href) ? 'page' : undefined}
                    className={cn(
                      'rounded-md px-3 py-2 text-sm font-semibold transition-colors',
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
              className="border-border hover:bg-surface-alt hidden h-10 items-center rounded-md border px-3 text-sm font-bold transition-colors sm:inline-flex"
            >
              {locale === 'ar' ? 'EN' : t('switchLanguage')}
            </button>

         {/*    {phone && (
              <a
                href={telLink(phone)}
                className="border-border hover:bg-surface-alt hidden h-10 items-center gap-2 rounded-md border px-3 text-sm font-bold transition-colors md:inline-flex"
              >
                <Phone aria-hidden="true" className="h-4 w-4" strokeWidth={1.75} />
                <span className="phone" dir="ltr">
                  {phone}
                </span>
              </a>
            )}

            {whatsappUrl && (
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-whatsapp hover:bg-navy-950 inline-flex h-10 items-center gap-2 rounded-md px-3 text-sm font-bold text-white transition-colors sm:px-4"
              >
                <FaWhatsapp aria-hidden="true" className="h-4 w-4" />
                <span className="hidden sm:inline">{tc('whatsapp')}</span>
              </a>
            )} */}

            <button
              type="button"
              onClick={() => setMenuOpen((open) => !open)}
              aria-expanded={menuOpen}
              aria-label={menuOpen ? t('closeMenu') : t('menu')}
              className="border-border hover:bg-surface-alt inline-flex h-10 w-10 items-center justify-center rounded-md border transition-colors lg:hidden"
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
          <nav aria-label={t('menu')} className="border-border border-t lg:hidden">
            <ul className="container-page flex flex-col py-2">
              {navItems.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={closeMenu}
                    aria-current={isActive(item.href) ? 'page' : undefined}
                    className={cn(
                      'block rounded-md px-3 py-3 font-semibold transition-colors',
                      isActive(item.href)
                        ? 'bg-fire-50 text-fire-700'
                        : 'text-muted hover:bg-surface-alt',
                    )}
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
              <li className="px-3 pt-1 pb-3">
                <button
                  type="button"
                  onClick={() => {
                    closeMenu();
                    switchLocale();
                  }}
                  className="border-border hover:bg-surface-alt rounded-md border px-3 py-2 text-sm font-bold transition-colors"
                >
                  {t('switchLanguage')}
                </button>
              </li>
            </ul>
          </nav>
        )}
      </div>
    </header>
  );
}
