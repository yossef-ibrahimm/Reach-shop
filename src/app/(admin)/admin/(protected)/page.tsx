'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { AlertTriangle, FileEdit, Loader2, Package, PackagePlus } from 'lucide-react';
import { supabaseBrowser } from '@/lib/supabase/browser';

type Counts = {
  total: number;
  drafts: number;
  missingTranslations: number;
  missingImages: number;
};

type LoadState = { status: 'loading' } | { status: 'error' } | { status: 'ready'; counts: Counts };

/**
 * Admin dashboard (PROJECT_SPEC §7): real counts computed from the database —
 * no invented statistics. "Publish changes" arrives with Phase 5.
 */
export default function AdminDashboardPage() {
  const t = useTranslations('admin.dashboard');
  const [state, setState] = useState<LoadState>({ status: 'loading' });

  const load = useCallback(async () => {
    const supabase = supabaseBrowser();

    const [products, images] = await Promise.all([
      supabase.from('products').select('id, name_ar, name_en, is_published'),
      supabase.from('product_images').select('product_id'),
    ]);

    if (products.error || images.error || !products.data || !images.data) {
      setState({ status: 'error' });
      return;
    }

    const withImage = new Set(images.data.map((image) => image.product_id));
    let drafts = 0;
    let missingTranslations = 0;
    let missingImages = 0;

    for (const product of products.data) {
      if (!product.is_published) drafts += 1;
      if (!product.name_ar.trim() || !product.name_en.trim()) missingTranslations += 1;
      if (!withImage.has(product.id)) missingImages += 1;
    }

    setState({
      status: 'ready',
      counts: {
        total: products.data.length,
        drafts,
        missingTranslations,
        missingImages,
      },
    });
  }, []);

  useEffect(() => {
    async function initialLoad() {
      await load();
    }
    void initialLoad();
  }, [load]);

  const stats = state.status === 'ready' ? state.counts : null;
  const cards = stats
    ? [
        { key: 'total' as const, value: stats.total, icon: Package },
        { key: 'drafts' as const, value: stats.drafts, icon: FileEdit },
        {
          key: 'missingTranslations' as const,
          value: stats.missingTranslations,
          icon: AlertTriangle,
        },
        { key: 'missingImages' as const, value: stats.missingImages, icon: AlertTriangle },
      ]
    : [];

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-extrabold">{t('title')}</h1>

      <section aria-labelledby="stats-heading" className="flex flex-col gap-3">
        <h2 id="stats-heading" className="text-muted text-sm font-extrabold">
          {t('stats.total')}
        </h2>

        {state.status === 'loading' && (
          <p role="status" className="text-muted flex items-center gap-2 text-sm font-bold">
            <Loader2 aria-hidden="true" className="size-4 animate-spin" />
            {t('loading')}
          </p>
        )}

        {state.status === 'error' && (
          <div className="bg-fire-50 text-fire-700 flex items-center justify-between gap-3 rounded-md p-3 text-sm font-bold">
            <span>{t('error')}</span>
            <button
              type="button"
              onClick={() => void load()}
              className="underline underline-offset-4"
            >
              {t('retry')}
            </button>
          </div>
        )}

        {stats && (
          <ul className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {cards.map(({ key, value, icon: Icon }) => (
              <li
                key={key}
                className="border-border bg-surface flex flex-col gap-1 border p-4 shadow-sm"
              >
                <Icon aria-hidden="true" className="text-muted size-5" />
                <span className="text-2xl font-extrabold">{value}</span>
                <span className="text-muted text-xs font-bold">{t(`stats.${key}`)}</span>
              </li>
            ))}
          </ul>
        )}
        {stats && <p className="text-muted text-xs font-bold">{t('statsHint')}</p>}
      </section>

      <section aria-labelledby="shortcuts-heading" className="flex flex-col gap-3">
        <h2 id="shortcuts-heading" className="text-muted text-sm font-extrabold">
          {t('shortcuts')}
        </h2>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/admin/products/new/"
            className="bg-primary hover:bg-primary-hover inline-flex items-center gap-2 rounded-md px-4 py-2.5 text-sm font-bold text-white transition-colors"
          >
            <PackagePlus aria-hidden="true" className="size-4" />
            {t('addProduct')}
          </Link>
          <Link
            href="/admin/products/"
            className="border-border bg-surface hover:bg-surface-alt inline-flex items-center gap-2 rounded-md border px-4 py-2.5 text-sm font-bold transition-colors"
          >
            <Package aria-hidden="true" className="size-4" />
            {t('manageProducts')}
          </Link>
        </div>
      </section>
    </div>
  );
}
