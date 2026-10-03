import type { Metadata } from 'next';
import { getLocale, getTranslations } from 'next-intl/server';
import { CertificatesGrid } from '@/components/home/certificates-grid';
import { ContactDetails } from '@/components/contact/contact-details';
import { SectionHeading } from '@/components/ui/section-heading';
import { getBrands, getCertificates, getSiteData, setting } from '@/lib/supabase/queries';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('meta.about');
  return {
    title: t('title'),
    description: t('description'),
  };
}

export default async function AboutPage() {
  const locale = await getLocale();
  const t = await getTranslations('about');
  const tc = await getTranslations('common');

  const [site, certificates, brands] = await Promise.all([
    getSiteData(),
    getCertificates(),
    getBrands(),
  ]);

  const story = setting(site, 'about_story', locale);
  const vision = setting(site, 'about_vision', locale);
  const greeting = tc('waGreeting');

  return (
    <main id="main-content" className="container-page py-10 lg:py-14">
      <p className="text-fire-600 text-sm font-bold">{t('eyebrow')}</p>
      <h1 className="mt-1 text-3xl font-bold lg:text-4xl">{t('title')}</h1>

      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
        {story && (
          <section className="border-border bg-surface rounded-md border p-6 shadow-sm">
            <h2 className="text-lg font-bold">{t('storyTitle')}</h2>
            <p className="text-muted mt-3 whitespace-pre-line">{story}</p>
          </section>
        )}
        {vision && (
          <section className="border-border bg-surface rounded-md border p-6 shadow-sm">
            <h2 className="text-lg font-bold">{t('visionTitle')}</h2>
            <p className="text-muted mt-3 whitespace-pre-line">{vision}</p>
          </section>
        )}
      </div>

      {certificates.length > 0 && (
        <section className="mt-12">
          <SectionHeading title={t('certificatesTitle')} />
          <div className="mt-6">
            <CertificatesGrid certificates={certificates} locale={locale} />
          </div>
        </section>
      )}

      {brands.length > 0 && (
        <section className="mt-12">
          <SectionHeading title={t('brandsTitle')} />
          <ul className="mt-6 flex list-none flex-wrap gap-3">
            {brands.map((brand) => {
              const name = locale === 'en' ? brand.name_en : brand.name_ar;
              return (
                <li key={brand.slug}>
                  <span className="border-border bg-surface flex h-14 min-w-32 items-center justify-center rounded-md border px-6">
                    {brand.logo_url ? (
                      // eslint-disable-next-line @next/next/no-img-element -- static export, unoptimized remote storage URLs
                      <img
                        src={brand.logo_url}
                        alt={name}
                        loading="lazy"
                        width={128}
                        height={32}
                        className="max-h-8 max-w-[140px] object-contain"
                      />
                    ) : (
                      <span className="font-bold">{name}</span>
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section className="mt-12">
        <SectionHeading title={t('contactTitle')} />
        <div className="mt-6">
          <ContactDetails site={site} locale={locale} greeting={greeting} />
        </div>
      </section>
    </main>
  );
}
