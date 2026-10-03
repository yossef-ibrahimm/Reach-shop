import { Flame, MapPin } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Link } from '@/lib/i18n/navigation';
import { FaFacebookF, FaInstagram, FaLink, FaYoutube } from 'react-icons/fa6';
import type { IconType } from 'react-icons';
import type { SiteData } from '@/lib/supabase/queries';
import { setting } from '@/lib/supabase/queries';
import { telLink } from '@/lib/whatsapp';

const SOCIAL_ICONS: Record<string, IconType> = {
  facebook: FaFacebookF,
  instagram: FaInstagram,
  youtube: FaYoutube,
};

type Props = {
  site: SiteData;
  locale: string;
};

export function SiteFooter({ site, locale }: Props) {
  const t = useTranslations();
  const companyName = setting(site, 'company_name', locale);
  const tagline = setting(site, 'tagline', locale);
  const address = setting(site, 'address', locale);
  const hours = setting(site, 'hours', locale);
  const mapUrl = setting(site, 'map_url', locale);
  const year = new Date().getFullYear();

  const links = [
    { href: '/', label: t('nav.home') },
    { href: '/products/', label: t('nav.products') },
    { href: '/about/', label: t('nav.about') },
    { href: '/contact/', label: t('nav.contact') },
  ];

  return (
    <footer className="bg-navy-950 text-inverse mt-16">
      <div className="container-page grid grid-cols-1 gap-10 py-14 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <Link href="/" className="flex items-center gap-2.5" aria-label={companyName}>
            <span className="bg-navy-800 text-fire-600 flex h-9 w-9 items-center justify-center rounded-md">
              <Flame aria-hidden="true" className="h-5 w-5" strokeWidth={1.75} />
            </span>
            <span className="text-lg font-extrabold">{companyName}</span>
          </Link>
          {tagline && <p className="mt-3 max-w-sm text-sm text-slate-400">{tagline}</p>}
          {site.socials.length > 0 && (
            <ul className="mt-4 flex gap-3">
              {site.socials.map((social) => {
                const Icon = SOCIAL_ICONS[social.platform] ?? FaLink;
                return (
                  <li key={social.id}>
                    <a
                      href={social.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={social.platform}
                      className="border-navy-700 flex h-11 w-11 items-center justify-center rounded-md border transition-colors hover:border-white hover:bg-white/10"
                    >
                      <Icon aria-hidden="true" className="h-4 w-4" />
                    </a>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <nav aria-label={t('footer.linksTitle')}>
          <h2 className="text-sm font-bold">{t('footer.linksTitle')}</h2>
          <ul className="mt-3 space-y-2 text-sm text-slate-400">
            {links.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="inline-block py-1 transition-colors hover:text-white"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div>
          <h2 className="text-sm font-bold">{t('footer.contactTitle')}</h2>
          <ul className="mt-3 space-y-2 text-sm text-slate-400">
            {site.phones.map((number) => (
              <li key={number.id}>
                <span className="block">{locale === 'en' ? number.label_en : number.label_ar}</span>
                <a
                  href={telLink(number.number)}
                  dir="ltr"
                  className="phone inline-block py-1 transition-colors hover:text-white"
                >
                  {number.number}
                </a>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h2 className="text-sm font-bold">{t('footer.addressTitle')}</h2>
          <ul className="mt-3 space-y-2 text-sm text-slate-400">
            {address && (
              <li className="flex items-start gap-2">
                <MapPin aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{address}</span>
              </li>
            )}
            {hours && <li>{hours}</li>}
            {mapUrl && (
              <li>
                <a
                  href={mapUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block py-1 transition-colors hover:text-white"
                >
                  {t('common.mapLink')}
                </a>
              </li>
            )}
          </ul>
        </div>
      </div>

      <div className="border-navy-700 border-t">
        <div className="container-page py-5 text-sm text-slate-400">
          {t('footer.rights', { year, company: companyName })}
        </div>
      </div>
    </footer>
  );
}
