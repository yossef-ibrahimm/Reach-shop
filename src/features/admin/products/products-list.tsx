'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import {
  AlertTriangle,
  CheckCircle2,
  Copy,
  ImageOff,
  Loader2,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  Star,
  Trash2,
} from 'lucide-react';
import { cn } from '@/lib/cn';
import { normalizeArabic } from '@/lib/products/search';
import { supabaseBrowser } from '@/lib/supabase/browser';
import { AvailabilityBadge } from '@/components/ui/availability-badge';
import { useToast } from '@/features/admin/ui/toast';
import { deleteProduct } from './delete-product';
import { duplicateProduct } from './duplicate-product';
import { useLookups } from './use-lookups';

type AdminRow = {
  id: string;
  slug: string;
  name_ar: string;
  name_en: string;
  availability: string;
  is_published: boolean;
  is_featured: boolean;
  updated_at: string;
  category_id: string;
  brand_id: string | null;
  category_name: string | null;
  brand_name: string | null;
  coverThumb: string | null;
  imageCount: number;
};

type RowState = { status: 'loading' } | { status: 'error' } | { status: 'ready' };

/**
 * Admin products list (PROJECT_SPEC §7): search + filters (including "missing
 * translation/image"), row actions with inline delete confirmation and bulk
 * publish. All mutations are plain Supabase writes — RLS is the authority.
 */
export function ProductsList() {
  const t = useTranslations('admin.products');
  const tDups = useTranslations('admin.duplicates');
  const tAvailability = useTranslations('availability');
  const toast = useToast();
  const lookups = useLookups();

  const [rowState, setRowState] = useState<RowState>({ status: 'loading' });
  const [rows, setRows] = useState<AdminRow[]>([]);

  const [query, setQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [brandFilter, setBrandFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [availabilityFilter, setAvailabilityFilter] = useState('all');
  const [missingTranslations, setMissingTranslations] = useState(false);
  const [missingImages, setMissingImages] = useState(false);

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busyId, setBusyId] = useState<string | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const supabase = supabaseBrowser();
    const [products, images] = await Promise.all([
      supabase
        .from('products')
        .select(
          'id, slug, name_ar, name_en, availability, is_published, is_featured, updated_at, category_id, brand_id',
        )
        .order('updated_at', { ascending: false }),
      supabase.from('product_images').select('product_id, url, thumb_url, sort_order'),
    ]);

    if (products.error || images.error || !products.data || !images.data) {
      setRowState({ status: 'error' });
      return;
    }

    const imagesByProduct = new Map<
      string,
      Array<{ url: string; thumb_url: string | null; sort_order: number }>
    >();
    for (const image of images.data) {
      const list = imagesByProduct.get(image.product_id) ?? [];
      list.push(image);
      imagesByProduct.set(image.product_id, list);
    }

    const lookupsReady = lookups.state.status === 'ready' ? lookups.state.lookups : null;
    const categoryName = new Map(
      (lookupsReady?.categories ?? []).map((category) => [category.id, category.name_ar]),
    );
    const brandName = new Map(
      (lookupsReady?.brands ?? []).map((brand) => [brand.id, brand.name_ar]),
    );

    setRows(
      products.data.map((product) => {
        const productImages = (imagesByProduct.get(product.id) ?? [])
          .slice()
          .sort((a, b) => a.sort_order - b.sort_order);
        const cover = productImages[0] ?? null;
        return {
          id: product.id,
          slug: product.slug,
          name_ar: product.name_ar,
          name_en: product.name_en,
          availability: product.availability,
          is_published: product.is_published,
          is_featured: product.is_featured,
          updated_at: product.updated_at,
          category_id: product.category_id,
          brand_id: product.brand_id,
          category_name: categoryName.get(product.category_id) ?? null,
          brand_name: product.brand_id ? (brandName.get(product.brand_id) ?? null) : null,
          coverThumb: cover ? (cover.thumb_url ?? cover.url) : null,
          imageCount: productImages.length,
        };
      }),
    );
    setRowState({ status: 'ready' });
  }, [lookups.state]);

  useEffect(() => {
    async function initialLoad() {
      await load();
    }
    void initialLoad();
  }, [load]);

  /* ------------------------------------------------------------ filtering -- */

  const filtered = useMemo(() => {
    const normalizedQuery = normalizeArabic(query);
    return rows.filter((row) => {
      if (normalizedQuery) {
        const haystack = normalizeArabic(`${row.name_ar} ${row.name_en} ${row.slug}`);
        if (!haystack.includes(normalizedQuery)) return false;
      }
      if (categoryFilter && row.category_id !== categoryFilter) return false;
      if (brandFilter && row.brand_id !== brandFilter) return false;
      if (statusFilter === 'published' && !row.is_published) return false;
      if (statusFilter === 'draft' && row.is_published) return false;
      if (availabilityFilter !== 'all' && row.availability !== availabilityFilter) return false;
      if (missingTranslations && row.name_ar.trim() !== '' && row.name_en.trim() !== '') {
        return false;
      }
      if (missingImages && row.imageCount > 0) return false;
      return true;
    });
  }, [
    rows,
    query,
    categoryFilter,
    brandFilter,
    statusFilter,
    availabilityFilter,
    missingTranslations,
    missingImages,
  ]);

  const filtersActive =
    query !== '' ||
    categoryFilter !== '' ||
    brandFilter !== '' ||
    statusFilter !== 'all' ||
    availabilityFilter !== 'all' ||
    missingTranslations ||
    missingImages;

  const clearFilters = () => {
    setQuery('');
    setCategoryFilter('');
    setBrandFilter('');
    setStatusFilter('all');
    setAvailabilityFilter('all');
    setMissingTranslations(false);
    setMissingImages(false);
  };

  /* --------------------------------------------------------------- actions -- */

  const togglePublish = async (row: AdminRow) => {
    setBusyId(row.id);
    const { error } = await supabaseBrowser()
      .from('products')
      .update({ is_published: !row.is_published })
      .eq('id', row.id);
    setBusyId(null);
    if (error) {
      toast(t('toasts.failed'), 'error');
      return;
    }
    toast(row.is_published ? t('toasts.unpublished') : t('toasts.published'));
    await load();
  };

  const runDuplicate = async (row: AdminRow) => {
    setBusyId(row.id);
    const result = await duplicateProduct(row.id, {
      suffixAr: tDups('suffixAr'),
      suffixEn: tDups('suffixEn'),
    });
    setBusyId(null);
    toast(result.ok ? t('toasts.duplicated') : t('toasts.failed'), result.ok ? 'success' : 'error');
    if (result.ok) await load();
  };

  const runDelete = async (row: AdminRow) => {
    setBusyId(row.id);
    const result = await deleteProduct(row.id);
    setBusyId(null);
    setConfirmDeleteId(null);
    if (!result.ok) {
      toast(t('toasts.failed'), 'error');
      return;
    }
    if (result.storageFailed > 0) {
      toast(t('toasts.deleteWarning'), 'error');
    } else {
      toast(t('toasts.deleted'));
    }
    setSelected((current) => {
      const next = new Set(current);
      next.delete(row.id);
      return next;
    });
    await load();
  };

  const runBulkPublish = async (publish: boolean) => {
    if (selected.size === 0) return;
    setBulkBusy(true);
    const { error } = await supabaseBrowser()
      .from('products')
      .update({ is_published: publish })
      .in('id', [...selected]);
    setBulkBusy(false);
    if (error) {
      toast(t('toasts.failed'), 'error');
      return;
    }
    toast(t('toasts.bulkDone'));
    setSelected(new Set());
    await load();
  };

  const allFilteredSelected = filtered.length > 0 && filtered.every((row) => selected.has(row.id));

  const toggleAll = () => {
    setSelected(
      allFilteredSelected ? new Set() : new Set([...selected, ...filtered.map((row) => row.id)]),
    );
  };

  const toggleRowSelected = (id: string) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  /* ----------------------------------------------------------------- view -- */

  const selectClass =
    'border-border bg-surface rounded-md border px-3 py-2 text-sm outline-none focus:border-navy-700';
  const labelClass = 'text-muted block text-xs font-bold';
  const actionButton =
    'inline-flex items-center gap-1 rounded-md border px-2.5 py-1.5 text-xs font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-60';

  const dateFormatter = useMemo(
    () => new Intl.DateTimeFormat('ar-EG', { dateStyle: 'short', timeStyle: 'short' }),
    [],
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-extrabold">{t('title')}</h1>
        <Link
          href="/admin/products/new/"
          className="bg-primary hover:bg-primary-hover inline-flex items-center gap-2 rounded-md px-4 py-2.5 text-sm font-bold text-white transition-colors"
        >
          <Plus aria-hidden="true" className="size-4" />
          {t('add')}
        </Link>
      </div>

      {/* --------------------------------------------------- search + filters -- */}
      <section
        aria-label={t('filters.legend')}
        className="border-border bg-surface flex flex-col gap-3 border p-4 shadow-sm"
      >
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="relative sm:col-span-2 lg:col-span-1">
            <Search
              aria-hidden="true"
              className="text-muted absolute start-3 top-1/2 size-4 -translate-y-1/2"
            />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t('search')}
              aria-label={t('search')}
              className={cn(selectClass, 'w-full ps-9')}
            />
          </div>

          <label className="flex flex-col gap-1">
            <span className={labelClass}>{t('filters.category')}</span>
            <select
              value={categoryFilter}
              onChange={(event) => setCategoryFilter(event.target.value)}
              className={selectClass}
            >
              <option value="">{t('filters.all')}</option>
              {lookups.state.status === 'ready' &&
                lookups.state.lookups.categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name_ar}
                  </option>
                ))}
            </select>
          </label>

          <label className="flex flex-col gap-1">
            <span className={labelClass}>{t('filters.brand')}</span>
            <select
              value={brandFilter}
              onChange={(event) => setBrandFilter(event.target.value)}
              className={selectClass}
            >
              <option value="">{t('filters.all')}</option>
              {lookups.state.status === 'ready' &&
                lookups.state.lookups.brands.map((brand) => (
                  <option key={brand.id} value={brand.id}>
                    {brand.name_ar}
                  </option>
                ))}
            </select>
          </label>

          <label className="flex flex-col gap-1">
            <span className={labelClass}>{t('filters.status')}</span>
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className={selectClass}
            >
              <option value="all">{t('filters.all')}</option>
              <option value="published">{t('status.published')}</option>
              <option value="draft">{t('status.draft')}</option>
            </select>
          </label>

          <label className="flex flex-col gap-1">
            <span className={labelClass}>{t('filters.availability')}</span>
            <select
              value={availabilityFilter}
              onChange={(event) => setAvailabilityFilter(event.target.value)}
              className={selectClass}
            >
              <option value="all">{t('filters.all')}</option>
              <option value="in_stock">{tAvailability('in_stock')}</option>
              <option value="limited">{tAvailability('limited')}</option>
              <option value="on_request">{tAvailability('on_request')}</option>
            </select>
          </label>
        </div>

        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm font-bold">
          <label className="inline-flex items-center gap-2">
            <input
              type="checkbox"
              className="size-4"
              checked={missingTranslations}
              onChange={(event) => setMissingTranslations(event.target.checked)}
            />
            {t('filters.missingTranslations')}
          </label>
          <label className="inline-flex items-center gap-2">
            <input
              type="checkbox"
              className="size-4"
              checked={missingImages}
              onChange={(event) => setMissingImages(event.target.checked)}
            />
            {t('filters.missingImages')}
          </label>
          {filtersActive && (
            <button
              type="button"
              onClick={clearFilters}
              className="text-muted hover:text-text inline-flex items-center gap-1 underline-offset-4 hover:underline"
            >
              <RotateCcw aria-hidden="true" className="size-3.5" />
              {t('filters.clear')}
            </button>
          )}
        </div>
      </section>

      {/* ------------------------------------------------------------- bulk -- */}
      {selected.size > 0 && (
        <div
          className="border-navy-950 bg-navy-950 text-inverse flex flex-wrap items-center justify-between gap-3 rounded-md px-4 py-3 text-sm font-bold"
          role="region"
          aria-label={t('bulk.count', { count: selected.size })}
        >
          <span>{t('bulk.count', { count: selected.size })}</span>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void runBulkPublish(true)}
              disabled={bulkBusy}
              className="rounded-md bg-green-600 px-3 py-1.5 text-xs font-bold text-white transition-colors hover:bg-green-600/85 disabled:opacity-60"
            >
              {t('bulk.publish')}
            </button>
            <button
              type="button"
              onClick={() => void runBulkPublish(false)}
              disabled={bulkBusy}
              className="rounded-md bg-amber-500 px-3 py-1.5 text-xs font-bold text-white transition-colors hover:bg-amber-500/85 disabled:opacity-60"
            >
              {t('bulk.unpublish')}
            </button>
            <button
              type="button"
              onClick={() => setSelected(new Set())}
              className="rounded-md border border-white/30 px-3 py-1.5 text-xs font-bold transition-colors hover:bg-white/10"
            >
              {t('bulk.clear')}
            </button>
          </div>
        </div>
      )}

      {/* ----------------------------------------------------------- states -- */}
      {rowState.status === 'loading' && (
        <p
          role="status"
          className="text-muted flex items-center gap-2 py-10 text-center text-sm font-bold"
        >
          <Loader2 aria-hidden="true" className="size-4 animate-spin" />
          {t('loading')}
        </p>
      )}

      {rowState.status === 'error' && (
        <div className="bg-fire-50 text-fire-700 flex items-center justify-between gap-3 rounded-md p-4 text-sm font-bold">
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

      {rowState.status === 'ready' && filtered.length === 0 && (
        <div className="border-border flex flex-col items-center gap-2 border border-dashed p-10 text-center">
          <ImageOff aria-hidden="true" className="text-muted size-6" />
          <p className="text-sm font-bold">{t('empty')}</p>
          {filtersActive && (
            <button
              type="button"
              onClick={clearFilters}
              className="text-muted text-sm font-bold underline underline-offset-4"
            >
              {t('filters.clear')}
            </button>
          )}
        </div>
      )}

      {/* ------------------------------------------------------------ table -- */}
      {rowState.status === 'ready' && filtered.length > 0 && (
        <div className="border-border bg-surface overflow-x-auto border shadow-sm">
          <table className="w-full min-w-[56rem] border-collapse text-sm">
            <thead className="bg-surface-alt text-start">
              <tr className="text-start">
                <th scope="col" className="p-3">
                  <input
                    type="checkbox"
                    className="size-4"
                    aria-label={t('columns.select')}
                    checked={allFilteredSelected}
                    onChange={toggleAll}
                  />
                </th>
                <th scope="col" className="p-3 text-start text-xs font-extrabold">
                  {t('columns.image')}
                </th>
                <th scope="col" className="p-3 text-start text-xs font-extrabold">
                  {t('columns.name')}
                </th>
                <th scope="col" className="p-3 text-start text-xs font-extrabold">
                  {t('columns.category')}
                </th>
                <th scope="col" className="p-3 text-start text-xs font-extrabold">
                  {t('columns.brand')}
                </th>
                <th scope="col" className="p-3 text-start text-xs font-extrabold">
                  {t('columns.availability')}
                </th>
                <th scope="col" className="p-3 text-start text-xs font-extrabold">
                  {t('columns.status')}
                </th>
                <th scope="col" className="p-3 text-start text-xs font-extrabold">
                  {t('columns.updated')}
                </th>
                <th scope="col" className="p-3 text-start text-xs font-extrabold">
                  {t('columns.actions')}
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => {
                const busy = busyId === row.id;
                const confirming = confirmDeleteId === row.id;
                return (
                  <tr key={row.id} className="border-border border-t align-middle">
                    <td className="p-3">
                      <input
                        type="checkbox"
                        className="size-4"
                        aria-label={row.name_ar}
                        checked={selected.has(row.id)}
                        onChange={() => toggleRowSelected(row.id)}
                      />
                    </td>
                    <td className="p-3">
                      {row.coverThumb ? (
                        // eslint-disable-next-line @next/next/no-img-element -- static export, unoptimized storage URLs
                        <img
                          src={row.coverThumb}
                          alt=""
                          loading="lazy"
                          className="border-border size-10 rounded-sm border object-cover"
                        />
                      ) : (
                        <span className="bg-surface-alt text-muted flex size-10 items-center justify-center rounded-sm">
                          <ImageOff aria-hidden="true" className="size-4" />
                        </span>
                      )}
                    </td>
                    <td className="p-3">
                      <span className="block font-bold">{row.name_ar}</span>
                      <span dir="ltr" className="text-muted block text-xs">
                        {row.name_en}
                      </span>
                    </td>
                    <td className="p-3 text-xs font-bold">{row.category_name ?? '—'}</td>
                    <td className="p-3 text-xs font-bold">{row.brand_name ?? '—'}</td>
                    <td className="p-3">
                      <AvailabilityBadge availability={row.availability} />
                    </td>
                    <td className="p-3">
                      <span className="flex flex-wrap gap-1.5">
                        <span
                          className={cn(
                            'rounded-full px-2 py-0.5 text-[11px] font-bold',
                            row.is_published
                              ? 'bg-green-600/12 text-green-600'
                              : 'bg-amber-500/12 text-amber-700',
                          )}
                        >
                          {row.is_published ? t('status.published') : t('status.draft')}
                        </span>
                        {row.is_featured && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-blue-600/12 px-2 py-0.5 text-[11px] font-bold text-blue-600">
                            <Star aria-hidden="true" className="size-3" />
                            {t('status.featured')}
                          </span>
                        )}
                      </span>
                    </td>
                    <td className="text-muted p-3 text-xs">
                      {dateFormatter.format(new Date(row.updated_at))}
                    </td>
                    <td className="p-3">
                      {confirming ? (
                        <span className="flex flex-wrap items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => void runDelete(row)}
                            disabled={busy}
                            className={cn(actionButton, 'border-fire-600 text-fire-700 bg-fire-50')}
                          >
                            {busy ? (
                              <Loader2 aria-hidden="true" className="size-3.5 animate-spin" />
                            ) : (
                              <Trash2 aria-hidden="true" className="size-3.5" />
                            )}
                            {t('actions.confirm')}
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(null)}
                            disabled={busy}
                            className={cn(
                              actionButton,
                              'border-border bg-surface hover:bg-surface-alt',
                            )}
                          >
                            {t('actions.cancel')}
                          </button>
                        </span>
                      ) : (
                        <span className="flex flex-wrap items-center gap-1.5">
                          <Link
                            href={`/admin/products/edit/?id=${row.id}`}
                            className={cn(
                              actionButton,
                              'border-border bg-surface hover:bg-surface-alt',
                            )}
                          >
                            <Pencil aria-hidden="true" className="size-3.5" />
                            {t('actions.edit')}
                          </Link>
                          <button
                            type="button"
                            onClick={() => void runDuplicate(row)}
                            disabled={busy}
                            className={cn(
                              actionButton,
                              'border-border bg-surface hover:bg-surface-alt',
                            )}
                            title={t('actions.duplicate')}
                          >
                            <Copy aria-hidden="true" className="size-3.5" />
                            {t('actions.duplicate')}
                          </button>
                          <button
                            type="button"
                            onClick={() => void togglePublish(row)}
                            disabled={busy}
                            className={cn(
                              actionButton,
                              'border-border bg-surface hover:bg-surface-alt',
                            )}
                          >
                            {busy ? (
                              <Loader2 aria-hidden="true" className="size-3.5 animate-spin" />
                            ) : row.is_published ? (
                              <AlertTriangle aria-hidden="true" className="size-3.5" />
                            ) : (
                              <CheckCircle2 aria-hidden="true" className="size-3.5" />
                            )}
                            {row.is_published ? t('actions.unpublish') : t('actions.publish')}
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(row.id)}
                            disabled={busy}
                            className={cn(
                              actionButton,
                              'border-border bg-surface text-fire-700 hover:bg-fire-50',
                            )}
                          >
                            <Trash2 aria-hidden="true" className="size-3.5" />
                            {t('actions.delete')}
                          </button>
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
