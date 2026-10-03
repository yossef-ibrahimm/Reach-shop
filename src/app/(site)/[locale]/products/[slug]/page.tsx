import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { FileDown } from 'lucide-react';
import { Breadcrumbs, type Crumb } from '@/components/ui/breadcrumbs';
import { ProductCard } from '@/components/ui/product-card';
import { AvailabilityBadge } from '@/components/ui/availability-badge';
import { ProductGallery } from '@/components/product/product-gallery';
import { QuoteWhatsAppButton } from '@/components/product/quote-whatsapp-button';
import { Link } from '@/lib/i18n/navigation';
import type { Json } from '@/lib/supabase/database.types';
import {
  getAllProducts,
  getProductBySlug,
  getRelatedProducts,
  getSiteData,
  getSpecDefinitions,
  whatsappNumber,
} from '@/lib/supabase/queries';
import type { SpecDefinition } from '@/lib/products/types';
import { telLink } from '@/lib/whatsapp';

type PageProps = {
  params: Promise<{ locale: string; slug: string }>;
};

export async function generateStaticParams() {
  const products = await getAllProducts();
  return products.map((product) => ({ slug: product.slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale, slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) return {};

  const name = locale === 'en' ? product.name_en : product.name_ar;
  const description =
    (locale === 'en' ? product.description_en : product.description_ar) ??
    product.description_ar ??
    product.description_en;

  return {
    title: name,
    description: description?.slice(0, 160),
  };
}

function localized(ar: string | null, en: string | null, locale: string): string {
  const main = locale === 'en' ? en : ar;
  if (main && main.trim()) return main;
  return ar ?? en ?? '';
}

function formatSpecValue(def: SpecDefinition, raw: Json, locale: string): string | null {
  if (raw === null || raw === undefined || typeof raw === 'object') return null;

  if (Array.isArray(def.options)) {
    const option = (
      def.options as Array<{ value?: unknown; label_ar?: unknown; label_en?: unknown }>
    ).find((entry) => String(entry.value) === String(raw));
    if (option) {
      const label = locale === 'en' ? option.label_en : option.label_ar;
      if (typeof label === 'string') return label;
    }
  }

  const base = String(raw);
  return def.unit ? `${base} ${def.unit}` : base;
}

export default async function ProductPage({ params }: PageProps) {
  const { locale, slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) notFound();

  const tNav = await getTranslations('nav');
  const tProduct = await getTranslations('product');
  const tc = await getTranslations('common');

  const [related, specDefs, site] = await Promise.all([
    getRelatedProducts(product),
    getSpecDefinitions(),
    getSiteData(),
  ]);

  const name = locale === 'en' ? product.name_en : product.name_ar;
  const brandName = product.brand
    ? locale === 'en'
      ? product.brand.name_en
      : product.brand.name_ar
    : null;
  const categoryName = product.category
    ? locale === 'en'
      ? product.category.name_en
      : product.category.name_ar
    : null;
  const description = localized(product.description_ar, product.description_en, locale);

  /* Specs table (PROJECT_SPEC §6.4) — defs for this product's category. */
  const specsObject =
    product.specs !== null && typeof product.specs === 'object' && !Array.isArray(product.specs)
      ? (product.specs as Record<string, Json>)
      : null;
  const categoryDefs = specDefs
    .filter((def) => def.category_slug === product.category?.slug)
    .sort((a, b) => a.sort_order - b.sort_order);
  const specRows = specsObject
    ? categoryDefs
        .filter((def) => def.key in specsObject)
        .map((def) => ({
          label: locale === 'en' ? def.label_en : def.label_ar,
          value: formatSpecValue(def, specsObject[def.key], locale),
        }))
        .filter((row): row is { label: string; value: string } => row.value !== null)
    : [];

  /* Catalog PDF with language fallback (PROJECT_SPEC §6.4). */
  const catalogUrl =
    locale === 'ar'
      ? (product.catalog_ar_url ?? product.catalog_en_url)
      : (product.catalog_en_url ?? product.catalog_ar_url);
  const catalogLang = catalogUrl
    ? locale === 'ar'
      ? product.catalog_ar_url
        ? 'AR'
        : 'EN'
      : product.catalog_en_url
        ? 'EN'
        : 'AR'
    : null;

  const waNumber = whatsappNumber(site);
  const crumbs: Crumb[] = [
    { label: tNav('home'), href: '/' },
    { label: tNav('products'), href: '/products/' },
    ...(product.category
      ? [
          {
            label: categoryName ?? '',
            href: `/products/?category=${encodeURIComponent(product.category.slug)}`,
          },
        ]
      : []),
    { label: name },
  ];

  return (
    <main id="main-content" className="container-page py-10">
      <Breadcrumbs items={crumbs} label={tProduct('breadcrumbLabel')} />

      <div className="mt-6 grid grid-cols-1 gap-8 lg:grid-cols-2">
        <ProductGallery
          images={product.images}
          locale={locale}
          productName={name}
          categorySlug={product.category?.slug ?? ''}
        />

        <div>
          <div className="flex flex-wrap gap-2">
            {brandName && product.brand && (
              <Link
                href={`/products/?brand=${encodeURIComponent(product.brand.slug)}`}
                className="border-border bg-surface hover:bg-surface-alt rounded-full border px-3 py-1 text-xs font-bold transition-colors"
              >
                {brandName}
              </Link>
            )}
            {categoryName && product.category && (
              <Link
                href={`/products/?category=${encodeURIComponent(product.category.slug)}`}
                className="border-border bg-surface hover:bg-surface-alt rounded-full border px-3 py-1 text-xs font-bold transition-colors"
              >
                {categoryName}
              </Link>
            )}
          </div>

          <h1 className="mt-3 text-3xl leading-tight font-bold lg:text-4xl">{name}</h1>

          <div className="mt-4">
            <AvailabilityBadge availability={product.availability} />
          </div>

          {description && <p className="text-muted mt-4 text-base">{description}</p>}

          {specRows.length > 0 && (
            <section className="mt-8">
              <h2 className="mb-3 text-lg font-bold">{tProduct('specsTitle')}</h2>
              <div className="border-border overflow-x-auto rounded-md border">
                <table className="w-full text-sm">
                  <tbody>
                    {specRows.map((row, index) => (
                      <tr
                        key={row.label}
                        className={index % 2 === 1 ? 'bg-surface-alt' : 'bg-surface'}
                      >
                        <th scope="row" className="text-muted w-2/5 p-3 text-start font-medium">
                          {row.label}
                        </th>
                        <td className="p-3 font-mono font-semibold">{row.value}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          <div className="mt-6 flex flex-wrap gap-3">
            {catalogUrl && catalogLang && (
              <a
                href={catalogUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="border-border bg-surface hover:bg-surface-alt inline-flex h-11 items-center gap-2 rounded-md border px-4 font-bold transition-colors"
              >
                <FileDown aria-hidden="true" className="h-4 w-4" />
                {tc('catalog')}
                <span className="phone text-muted text-xs">({catalogLang})</span>
              </a>
            )}
            {site.phones[0] && (
              <a
                href={telLink(site.phones[0].number)}
                className="border-border bg-surface hover:bg-surface-alt inline-flex h-11 items-center gap-2 rounded-md border px-4 font-bold transition-colors"
              >
                {tc('call')}
                <span className="phone">{site.phones[0].number}</span>
              </a>
            )}
          </div>

          {waNumber && (
            <div className="mt-4">
              <QuoteWhatsAppButton number={waNumber} productName={name} label={tc('quote')} />
            </div>
          )}
        </div>
      </div>

      {related.length > 0 && (
        <section className="mt-16">
          <h2 className="text-2xl font-bold">{tProduct('relatedTitle')}</h2>
          <ul className="mt-6 grid list-none grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {related.map((item) => (
              <li key={item.id}>
                <ProductCard product={item} specDefs={specDefs} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
