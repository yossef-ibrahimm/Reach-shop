import type { Metadata } from 'next';
import { Suspense } from 'react';
import { getLocale, getTranslations } from 'next-intl/server';
import { ProductsExplorer } from '@/components/products/products-explorer';
import {
  getAllProducts,
  getBrands,
  getCategories,
  getSiteData,
  getSpecDefinitions,
  whatsappNumber,
} from '@/lib/supabase/queries';
import { waLink } from '@/lib/whatsapp';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('meta.products');
  return {
    title: t('title'),
    description: t('description'),
  };
}

export default async function ProductsPage() {
  const locale = await getLocale();
  const t = await getTranslations('products');
  const tc = await getTranslations('common');

  const [products, categories, brands, specDefs, site] = await Promise.all([
    getAllProducts(),
    getCategories(),
    getBrands(),
    getSpecDefinitions(),
    getSiteData(),
  ]);

  const waNumber = whatsappNumber(site);
  const whatsappUrl = waNumber ? waLink(waNumber, tc('waGreeting')) : null;

  return (
    <main id="main-content" className="container-page py-10 lg:py-14">
      <p className="text-fire-600 text-sm font-bold">{t('eyebrow')}</p>
      <h1 className="mt-1 text-3xl font-bold lg:text-4xl">{t('title')}</h1>
      <p className="text-muted mt-3 max-w-2xl">{t('intro')}</p>

      <Suspense
        fallback={
          <div
            aria-busy="true"
            aria-live="polite"
            className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
          >
            {Array.from({ length: 8 }, (_, i) => (
              <div key={i} className="border-border bg-surface animate-pulse rounded-md border p-4">
                <div className="mb-4 h-40 rounded-md bg-slate-200" />
                <div className="h-4 w-3/4 rounded bg-slate-200" />
                <div className="mt-2 h-4 w-1/2 rounded bg-slate-200" />
              </div>
            ))}
          </div>
        }
      >
        <ProductsExplorer
          locale={locale}
          products={products}
          categories={categories}
          brands={brands}
          specDefs={specDefs}
          whatsappUrl={whatsappUrl}
        />
      </Suspense>
    </main>
  );
}
