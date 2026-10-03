import { ArrowRight, Phone } from 'lucide-react';
import { getLocale, getTranslations } from 'next-intl/server';
import { FaWhatsapp } from 'react-icons/fa6';
import { CertificatesGrid } from '@/components/home/certificates-grid';
import { HeroPanel } from '@/components/home/hero-panel';
import { CategoryTile } from '@/components/ui/category-tile';
import { ProductCard } from '@/components/ui/product-card';
import { SectionHeading } from '@/components/ui/section-heading';
import { Link } from '@/lib/i18n/navigation';
import { splitHighlight } from '@/lib/text';
import {
  getBrands,
  getCertificates,
  getCategoryCounts,
  getFeaturedProducts,
  getProjects,
  getSiteData,
  getSpecDefinitions,
  setting,
  whatsappNumber,
} from '@/lib/supabase/queries';
import { telLink, waLink } from '@/lib/whatsapp';

export default async function HomePage() {
  const locale = await getLocale();
  const t = await getTranslations('home');
  const tc = await getTranslations('common');

  const [site, categoryCounts, featured, brands, certificates, projects, specDefs] =
    await Promise.all([
      getSiteData(),
      getCategoryCounts(),
      getFeaturedProducts(8),
      getBrands(),
      getCertificates(),
      getProjects(),
      getSpecDefinitions(),
    ]);

  const heroEyebrow = setting(site, 'hero_eyebrow', locale);
  const heroTitle = setting(site, 'hero_title', locale);
  const heroLead = setting(site, 'hero_lead', locale);
  const phone = site.phones[0]?.number ?? null;
  const waNumber = whatsappNumber(site);
  const whatsappUrl = waNumber ? waLink(waNumber, tc('waGreeting')) : null;

  const whyItems = [1, 2, 3]
    .map((slot) => ({
      title: setting(site, `why_${slot}_title`, locale),
      body: setting(site, `why_${slot}_body`, locale),
    }))
    .filter((item) => item.title && item.body);

  const viewAllLink = (
    <Link
      href="/products/"
      className="text-fire-700 hover:text-fire-600 inline-flex items-center gap-1.5 py-1 text-sm font-bold transition-colors"
    >
      {tc('viewAll')}
      <ArrowRight aria-hidden="true" className="h-4 w-4 rtl:rotate-180" />
    </Link>
  );

  return (
    <main id="main-content">
      {/* Hero */}
      <section className="bg-navy-950 text-inverse">
        <div className="container-page grid grid-cols-1 items-center gap-10 py-16 lg:grid-cols-2 lg:py-24">
          <div>
            {heroEyebrow && <p className="text-sm font-bold text-amber-500">{heroEyebrow}</p>}
            <h1 className="mt-3 text-[34px] leading-tight font-extrabold lg:text-5xl">
              {splitHighlight(heroTitle).map((part, index) =>
                part.em ? (
                  <em key={index} className="text-fire-600 font-extrabold not-italic">
                    {part.text}
                  </em>
                ) : (
                  <span key={index}>{part.text}</span>
                ),
              )}
            </h1>
            {heroLead && <p className="mt-4 max-w-xl text-lg text-slate-400">{heroLead}</p>}
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/products/"
                className="bg-primary hover:bg-primary-hover inline-flex h-12 items-center gap-2 rounded-md px-6 font-bold text-white transition-colors"
              >
                {tc('browseProducts')}
                <ArrowRight aria-hidden="true" className="h-4 w-4 rtl:rotate-180" />
              </Link>
              {whatsappUrl && (
                <a
                  href={whatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-whatsapp hover:bg-navy-950 inline-flex h-12 items-center gap-2 rounded-md px-6 font-bold text-white transition-colors"
                >
                  <FaWhatsapp aria-hidden="true" className="h-5 w-5" />
                  {tc('askWa')}
                </a>
              )}
            </div>
          </div>
          <HeroPanel />
        </div>
      </section>

      {/* Categories */}
      <section className="container-page py-16 lg:py-24">
        <SectionHeading
          eyebrow={t('categoriesEyebrow')}
          title={t('categoriesTitle')}
          action={viewAllLink}
        />
        <ul className="mt-8 grid list-none grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {categoryCounts.map(({ category, count }) => (
            <li key={category.slug}>
              <CategoryTile
                slug={category.slug}
                name={locale === 'en' ? category.name_en : category.name_ar}
                count={count}
              />
            </li>
          ))}
        </ul>
      </section>

      {/* Featured */}
      {featured.length > 0 && (
        <section className="bg-surface-alt">
          <div className="container-page py-16 lg:py-24">
            <SectionHeading
              eyebrow={t('featuredEyebrow')}
              title={t('featuredTitle')}
              action={viewAllLink}
            />
            <ul className="mt-8 grid list-none grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {featured.map((product) => (
                <li key={product.id}>
                  <ProductCard product={product} specDefs={specDefs} />
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {/* Brands */}
      {brands.length > 0 && (
        <section className="container-page py-16 lg:py-24">
          <SectionHeading eyebrow={t('brandsEyebrow')} title={t('brandsTitle')} />
          <ul className="mt-8 flex list-none flex-wrap gap-3">
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

      {/* Why us */}
      {whyItems.length > 0 && (
        <section className="bg-surface-alt">
          <div className="container-page py-16 lg:py-24">
            <SectionHeading eyebrow={t('whyEyebrow')} title={t('whyTitle')} />
            <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-3">
              {whyItems.map((item) => (
                <article
                  key={item.title}
                  className="border-border bg-surface rounded-md border p-6 shadow-sm"
                >
                  <h3 className="text-lg font-semibold">{item.title}</h3>
                  <p className="text-muted mt-2">{item.body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Certificates */}
      {certificates.length > 0 && (
        <section className="container-page py-16 lg:py-24">
          <SectionHeading eyebrow={t('certificatesEyebrow')} title={t('certificatesTitle')} />
          <div className="mt-8">
            <CertificatesGrid certificates={certificates} locale={locale} />
          </div>
        </section>
      )}

      {/* Projects */}
      {projects.length > 0 && (
        <section className="bg-surface-alt">
          <div className="container-page py-16 lg:py-24">
            <SectionHeading eyebrow={t('projectsEyebrow')} title={t('projectsTitle')} />
            <ul className="mt-8 grid list-none grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {projects.map((project) => (
                <li
                  key={project.id}
                  className="border-border bg-surface overflow-hidden rounded-md border shadow-sm"
                >
                  {project.image_url && (
                    // eslint-disable-next-line @next/next/no-img-element -- static export, unoptimized remote storage URLs
                    <img
                      src={project.image_url}
                      alt={locale === 'en' ? project.title_en : project.title_ar}
                      loading="lazy"
                      width={640}
                      height={360}
                      className="aspect-video w-full object-cover"
                    />
                  )}
                  <div className="p-5">
                    <h3 className="font-semibold">
                      {locale === 'en' ? project.title_en : project.title_ar}
                    </h3>
                    {(locale === 'en' ? project.description_en : project.description_ar) && (
                      <p className="text-muted mt-2 text-sm">
                        {locale === 'en' ? project.description_en : project.description_ar}
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {/* Contact CTA */}
      <section className="container-page py-16 lg:py-24">
        <div className="bg-navy-950 text-inverse flex flex-wrap items-center justify-between gap-6 rounded-lg p-8 lg:p-12">
          <div>
            <h2 className="text-2xl font-bold lg:text-[28px]">{t('ctaTitle')}</h2>
            <p className="mt-2 max-w-xl text-slate-400">{t('ctaBody')}</p>
          </div>
          <div className="flex flex-wrap gap-3">
            {phone && (
              <a
                href={telLink(phone)}
                className="inline-flex h-12 items-center gap-2 rounded-md border border-white/25 px-5 font-bold transition-colors hover:bg-white/10"
              >
                <Phone aria-hidden="true" className="h-4 w-4" />
                <span className="phone">{phone}</span>
              </a>
            )}
            {whatsappUrl && (
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-whatsapp hover:bg-navy-950 inline-flex h-12 items-center gap-2 rounded-md px-5 font-bold text-white transition-colors"
              >
                <FaWhatsapp aria-hidden="true" className="h-5 w-5" />
                {tc('whatsapp')}
              </a>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
