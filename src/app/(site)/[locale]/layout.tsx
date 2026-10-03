import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { hasLocale, NextIntlClientProvider } from 'next-intl';
import { getMessages, getTranslations, setRequestLocale } from 'next-intl/server';
import { SiteHeader } from '@/components/layout/site-header';
import { SiteFooter } from '@/components/layout/site-footer';
import { FloatingWhatsApp } from '@/components/layout/floating-whatsapp';
import { fontVariables } from '@/lib/fonts';
import { routing } from '@/lib/i18n/routing';
import { getSiteData, setting, whatsappNumber } from '@/lib/supabase/queries';
import { waLink } from '@/lib/whatsapp';
import '@/app/globals.css';

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

type LayoutProps = {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: LayoutProps): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    return {};
  }
  const t = await getTranslations({ locale, namespace: 'meta' });
  return {
    title: { default: t('title'), template: `%s · ${t('siteName')}` },
    description: t('description'),
  };
}

export default async function SiteRootLayout({ children, params }: LayoutProps) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  // بيخلّي next-intl يعرف الـ locale من غير ما يستخدم headers()،
  // وده شرط عشان الصفحات تتعمل static rendering مع generateStaticParams
  setRequestLocale(locale);

  // التلات طلبات مش معتمدين على بعض، فنشغّلهم مع بعض بدل ورا بعض
  const [messages, site, t] = await Promise.all([
    getMessages({ locale }),
    getSiteData(),
    getTranslations({ locale, namespace: 'common' }),
  ]);

  const waNumber = whatsappNumber(site);
  const whatsappUrl = waNumber ? waLink(waNumber, t('waGreeting')) : null;

  // كل الأرقام، من غير الفاضي ومن غير التكرار
  const phones = Array.from(
    new Set(site.phones.map((p) => p.number).filter((n): n is string => Boolean(n))),
  );

  return (
    <html lang={locale} dir={locale === 'ar' ? 'rtl' : 'ltr'} className={fontVariables}>
      <body className="flex min-h-screen flex-col">
        <a
          href="#main-content"
          className="bg-primary sr-only z-50 rounded-md px-4 py-2 text-sm font-bold text-white focus:not-sr-only focus:absolute focus:start-4 focus:top-4"
        >
          {t('skipToContent')}
        </a>
        <NextIntlClientProvider messages={messages}>
          <SiteHeader
            locale={locale}
            companyName={setting(site, 'company_name', locale)}
            hours={setting(site, 'hours', locale)}
            phones={phones}
            whatsappUrl={whatsappUrl}
          />
          <div className="flex-1">{children}</div>
          <SiteFooter site={site} locale={locale} />
          {whatsappUrl && <FloatingWhatsApp href={whatsappUrl} label={t('whatsapp')} />}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}