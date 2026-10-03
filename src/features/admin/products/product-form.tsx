'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowRight, Loader2, Save } from 'lucide-react';
import { cn } from '@/lib/cn';
import { supabaseBrowser } from '@/lib/supabase/browser';
import { useToast } from '@/features/admin/ui/toast';
import { fileNameFromUrl } from '@/features/admin/media/storage';
import { CatalogField } from './catalog-field';
import { ImagesField } from './images-field';
import { PartialSaveError, SlugConflictError, isSlugTaken, saveProduct } from './save-product';
import { buildProductSchema, slugify, specsToFormValues, specsToJson } from './product-schema';
import type { Lookups } from './use-lookups';
import { useLookups } from './use-lookups';
import type {
  CatalogField as CatalogFieldState,
  CatalogsState,
  ExistingImageItem,
  ImageItem,
  ProductFormValues,
  ProductImageRow,
  ProductRow,
} from './types';

type Props = { mode: 'new' } | { mode: 'edit'; id: string };

type Initial = { product: ProductRow; images: ProductImageRow[] };

type LoadState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'notFound' }
  | { status: 'ready'; initial: Initial | null };

const INPUT =
  'border-border bg-surface w-full rounded-md border px-3 py-2.5 text-sm outline-none focus:border-navy-700 disabled:opacity-60';
const LABEL = 'mb-1 block text-sm font-bold';
const SECTION = 'border-border bg-surface flex flex-col gap-4 border p-4 shadow-sm';
const SECTION_TITLE = 'text-sm font-extrabold';
const HINT = 'text-muted text-xs font-bold';

/**
 * Shared Add / Edit form (PROJECT_SPEC §7): one component, dynamic spec fields
 * from `spec_definitions`, AR/EN content tabs, staged image + PDF pipeline and
 * a single Save that writes rows then storage. Everything is validated with zod
 * (Arabic messages); RLS grants the writes only when the JWT says admin.
 */
export function ProductForm(props: Props) {
  const mode = props.mode;
  const id = props.mode === 'edit' ? props.id : '';
  const t = useTranslations('admin.form');
  const { state: lookupsState, reload: reloadLookups } = useLookups();
  const [load, setLoad] = useState<LoadState>(() =>
    props.mode === 'new' ? { status: 'ready', initial: null } : { status: 'loading' },
  );
  const [attempt, setAttempt] = useState(0);

  const bootstrap = useCallback(async () => {
    if (mode === 'new') return;
    const supabase = supabaseBrowser();
    const [product, images] = await Promise.all([
      supabase.from('products').select('*').eq('id', id).maybeSingle(),
      supabase.from('product_images').select('*').eq('product_id', id).order('sort_order'),
    ]);
    if (product.error || images.error) {
      setLoad({ status: 'error' });
      return;
    }
    if (!product.data) {
      setLoad({ status: 'notFound' });
      return;
    }
    setLoad({ status: 'ready', initial: { product: product.data, images: images.data ?? [] } });
  }, [mode, id]);

  useEffect(() => {
    async function initialLoad() {
      await bootstrap();
    }
    void initialLoad();
  }, [bootstrap]);

  const retry = () => {
    void bootstrap();
    reloadLookups();
  };

  if (load.status === 'loading' || lookupsState.status === 'loading') {
    return (
      <p
        role="status"
        className="text-muted flex items-center gap-2 py-16 text-center text-sm font-bold"
      >
        <Loader2 aria-hidden="true" className="size-4 animate-spin" />
        {t('loading')}
      </p>
    );
  }

  if (load.status === 'notFound') {
    return <ProductNotFoundBox />;
  }

  if (load.status === 'error' || lookupsState.status === 'error') {
    return (
      <div className="bg-fire-50 text-fire-700 flex items-center justify-between gap-3 rounded-md p-4 text-sm font-bold">
        <span>{t('errors.load')}</span>
        <button type="button" onClick={retry} className="underline underline-offset-4">
          {t('errors.retry')}
        </button>
      </div>
    );
  }

  return (
    <ProductFormInner
      key={attempt}
      mode={mode}
      initial={load.initial}
      lookups={lookupsState.lookups}
      reload={async () => {
        await bootstrap();
        setAttempt((value) => value + 1);
      }}
    />
  );
}

type InnerProps = {
  mode: 'new' | 'edit';
  initial: Initial | null;
  lookups: Lookups;
  reload: () => Promise<void>;
};

/** Shown when the `?id=` parameter is unknown (deleted product, stale link). */
export function ProductNotFoundBox() {
  const t = useTranslations('admin.form');
  return (
    <div className="border-border bg-surface flex flex-col items-start gap-3 border p-6 shadow-sm">
      <p className="text-sm font-bold">{t('notFound')}</p>
      <Link
        href="/admin/products/"
        className="text-muted hover:text-text inline-flex items-center gap-1.5 text-sm font-bold underline-offset-4 hover:underline"
      >
        <ArrowRight aria-hidden="true" className="size-4" />
        {t('backToList')}
      </Link>
    </div>
  );
}

function ProductFormInner({ mode, initial, lookups, reload }: InnerProps) {
  const t = useTranslations('admin.form');
  const tAvailability = useTranslations('availability');
  const tSystem = useTranslations('system');
  const toast = useToast();
  const router = useRouter();

  const [tab, setTab] = useState<'ar' | 'en'>('ar');
  const [saving, setSaving] = useState(false);
  const [images, setImages] = useState<ImageItem[]>(() =>
    (initial?.images ?? []).map(toExistingItem),
  );
  const [mediaDirty, setMediaDirty] = useState(false);
  const [catalogs, setCatalogs] = useState<CatalogsState>(() =>
    makeCatalogs(initial?.product ?? null),
  );

  const baseline = useMemo<ExistingImageItem[]>(
    () => (initial?.images ?? []).map(toExistingItem),
    [initial],
  );

  const specsByCategory = useMemo(() => {
    const map: Record<string, Lookups['specs']> = {};
    for (const definition of lookups.specs) {
      (map[definition.category_id] ??= []).push(definition);
    }
    return map;
  }, [lookups.specs]);

  const schema = useMemo(
    () =>
      buildProductSchema(
        {
          required: t('errors.required'),
          nameLen: t('errors.nameLen'),
          slugPattern: t('errors.slugPattern'),
          specNumber: t('errors.specNumber'),
          specSelect: t('errors.specSelect'),
        },
        specsByCategory,
      ),
    [t, specsByCategory],
  );

  const defaultValues = useMemo(
    () => makeDefaults(initial?.product ?? null, specsByCategory),
    [initial, specsByCategory],
  );

  const {
    register,
    handleSubmit,
    control,
    getValues,
    setValue,
    setError,
    setFocus,
    formState: { errors, isDirty, isSubmitting },
  } = useForm<ProductFormValues>({
    resolver: zodResolver(schema),
    defaultValues,
    mode: 'onSubmit',
  });

  /* -------------------------------------------------------- field watches -- */

  const nameEn = useWatch({ control, name: 'name_en' });
  const categoryId = useWatch({ control, name: 'category_id' });
  const brandId = useWatch({ control, name: 'brand_id' });
  const seriesId = useWatch({ control, name: 'series_id' });
  const systemType = useWatch({ control, name: 'system_type' });
  const availability = useWatch({ control, name: 'availability' });
  const specsValues = useWatch({ control, name: 'specs' });

  /* ------------------------------------------------------ slug auto-fill -- */

  const slugTouched = useRef(mode === 'edit');
  const slugRegistration = register('slug');

  useEffect(() => {
    if (!slugTouched.current) setValue('slug', slugify(nameEn ?? ''));
  }, [nameEn, setValue]);

  /* --------------------------------------------------- unsaved changes -- */

  const dirty = isDirty || mediaDirty;
  const dirtyRef = useRef(dirty);
  useEffect(() => {
    dirtyRef.current = dirty;
  }, [dirty]);

  useEffect(() => {
    const handler = (event: BeforeUnloadEvent) => {
      if (dirtyRef.current) {
        event.preventDefault();
        event.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, []);

  /* ------------------------------------------------------------ saving -- */

  const onSubmit = handleSubmit(async (values) => {
    const currentId = mode === 'edit' ? (initial?.product.id ?? null) : null;
    try {
      if (await isSlugTaken(values.slug, currentId)) {
        setError('slug', { type: 'server', message: t('errors.slugTaken') });
        setFocus('slug');
        return;
      }
    } catch {
      toast(t('toasts.saveFailed'), 'error');
      return;
    }

    const definitions = specsByCategory[values.category_id] ?? [];
    const specs = specsToJson(values.specs, definitions);

    setSaving(true);
    try {
      const { id: savedId } = await saveProduct({
        mode,
        productId: currentId,
        values,
        specs,
        images,
        baselineImages: baseline,
        catalogs,
      });

      if (mode === 'new') {
        toast(t('toasts.created'));
        router.replace(`/admin/products/edit/?id=${savedId}`);
      } else {
        toast(t('toasts.saved'));
        await reload();
      }
    } catch (error) {
      if (error instanceof SlugConflictError) {
        setError('slug', { type: 'server', message: t('errors.slugTaken') });
        setFocus('slug');
        toast(t('toasts.slugConflict'), 'error');
      } else if (error instanceof PartialSaveError) {
        toast(t('toasts.partialCreated'), 'error');
        router.replace(`/admin/products/edit/?id=${error.productId}`);
      } else {
        console.error(error);
        toast(t('toasts.saveFailed'), 'error');
      }
    } finally {
      setSaving(false);
    }
  });

  const cancel = () => {
    if (dirty && !window.confirm(t('buttons.leaveConfirm'))) return;
    router.push('/admin/products/');
  };

  /* ------------------------------------------------------- category swap -- */

  const categoryRegistration = register('category_id');
  const onCategoryChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    categoryRegistration.onChange(event);
    const nextDefinitions = specsByCategory[event.target.value] ?? [];
    const current = getValues('specs');
    const next: Record<string, string> = {};
    for (const definition of nextDefinitions) {
      next[definition.key] = current[definition.key] ?? '';
    }
    setValue('specs', next, { shouldDirty: true });
  };

  const definitions = specsByCategory[categoryId] ?? [];

  /* --------------------------------------------------------------- view -- */

  const fieldError = (message?: string) =>
    message ? (
      <p role="alert" className="text-fire-700 mt-1 text-xs font-bold">
        {message}
      </p>
    ) : null;

  const tabButtonClass = (active: boolean) =>
    cn(
      'rounded-md px-4 py-2 text-sm font-bold transition-colors',
      active ? 'bg-navy-950 text-white' : 'text-muted hover:bg-surface-alt',
    );

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-extrabold">
          {mode === 'new' ? t('newTitle') : t('editTitle')}
        </h1>
        <button
          type="button"
          onClick={cancel}
          className="border-border bg-surface hover:bg-surface-alt rounded-md border px-4 py-2 text-sm font-bold transition-colors"
        >
          {t('buttons.cancel')}
        </button>
      </div>

      {/* ------------------------------------------------ AR / EN content -- */}
      <section className={SECTION} aria-labelledby="content-heading">
        <h2 id="content-heading" className={SECTION_TITLE}>
          {t('sections.content')}
        </h2>

        <div role="tablist" aria-label={t('sections.content')} className="flex gap-1">
          <button
            type="button"
            role="tab"
            id="tab-ar"
            aria-controls="panel-ar"
            aria-selected={tab === 'ar'}
            tabIndex={tab === 'ar' ? 0 : -1}
            onClick={() => setTab('ar')}
            className={tabButtonClass(tab === 'ar')}
          >
            {t('tabs.ar')}
          </button>
          <button
            type="button"
            role="tab"
            id="tab-en"
            aria-controls="panel-en"
            aria-selected={tab === 'en'}
            tabIndex={tab === 'en' ? 0 : -1}
            onClick={() => setTab('en')}
            className={tabButtonClass(tab === 'en')}
          >
            {t('tabs.en')}
          </button>
        </div>

        <div
          role="tabpanel"
          id="panel-ar"
          aria-labelledby="tab-ar"
          hidden={tab !== 'ar'}
          className="flex flex-col gap-4"
        >
          <div>
            <label htmlFor="field-name_ar" className={LABEL}>
              {t('fields.nameAr')}
            </label>
            <input
              id="field-name_ar"
              type="text"
              className={INPUT}
              aria-invalid={Boolean(errors.name_ar)}
              {...register('name_ar')}
            />
            {fieldError(errors.name_ar?.message)}
          </div>
          <div>
            <label htmlFor="field-description_ar" className={LABEL}>
              {t('fields.descriptionAr')}
            </label>
            <textarea
              id="field-description_ar"
              rows={4}
              className={INPUT}
              {...register('description_ar')}
            />
            <p className={cn(HINT, 'mt-1')}>{t('fields.descriptionHint')}</p>
          </div>
        </div>

        <div
          role="tabpanel"
          id="panel-en"
          aria-labelledby="tab-en"
          hidden={tab !== 'en'}
          className="flex flex-col gap-4"
        >
          <div>
            <label htmlFor="field-name_en" className={LABEL}>
              {t('fields.nameEn')}
            </label>
            <input
              id="field-name_en"
              type="text"
              dir="ltr"
              className={INPUT}
              aria-invalid={Boolean(errors.name_en)}
              {...register('name_en')}
            />
            {fieldError(errors.name_en?.message)}
          </div>
          <div>
            <label htmlFor="field-description_en" className={LABEL}>
              {t('fields.descriptionEn')}
            </label>
            <textarea
              id="field-description_en"
              rows={4}
              dir="ltr"
              className={INPUT}
              {...register('description_en')}
            />
            <p className={cn(HINT, 'mt-1')}>{t('fields.descriptionHint')}</p>
          </div>
        </div>
      </section>

      {/* --------------------------------------------------------- basics -- */}
      <section className={SECTION} aria-labelledby="basic-heading">
        <h2 id="basic-heading" className={SECTION_TITLE}>
          {t('sections.basic')}
        </h2>

        <div>
          <label htmlFor="field-slug" className={LABEL}>
            {t('fields.slug')}
          </label>
          <input
            id="field-slug"
            type="text"
            dir="ltr"
            className={cn(INPUT, 'font-mono')}
            aria-invalid={Boolean(errors.slug)}
            {...slugRegistration}
            onChange={(event) => {
              slugTouched.current = true;
              slugRegistration.onChange(event);
            }}
          />
          <p className={cn(HINT, 'mt-1')}>{t('fields.slugHint')}</p>
          {fieldError(errors.slug?.message)}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="field-category_id" className={LABEL}>
              {t('fields.category')}
            </label>
            <select
              id="field-category_id"
              className={INPUT}
              aria-invalid={Boolean(errors.category_id)}
              value={categoryId}
              {...categoryRegistration}
              onChange={onCategoryChange}
            >
              <option value="">{t('fields.selectPlaceholder')}</option>
              {lookups.categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name_ar}
                </option>
              ))}
            </select>
            {fieldError(errors.category_id?.message)}
          </div>

          <div>
            <label htmlFor="field-brand_id" className={LABEL}>
              {t('fields.brand')}
            </label>
            <select id="field-brand_id" className={INPUT} value={brandId} {...register('brand_id')}>
              <option value="">{t('fields.selectPlaceholder')}</option>
              {lookups.brands.map((brand) => (
                <option key={brand.id} value={brand.id}>
                  {brand.name_ar}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="field-series_id" className={LABEL}>
              {t('fields.series')}
            </label>
            <select
              id="field-series_id"
              className={INPUT}
              value={seriesId}
              {...register('series_id')}
            >
              <option value="">{t('fields.selectPlaceholder')}</option>
              {lookups.series.map((series) => (
                <option key={series.id} value={series.id}>
                  {series.name_ar}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="field-system_type" className={LABEL}>
              {t('fields.system')}
            </label>
            <select
              id="field-system_type"
              className={INPUT}
              value={systemType}
              {...register('system_type')}
            >
              <option value="">{t('fields.selectPlaceholder')}</option>
              <option value="conventional">{tSystem('conventional')}</option>
              <option value="addressable">{tSystem('addressable')}</option>
            </select>
          </div>
        </div>

        <div>
          <label htmlFor="field-search_keywords" className={LABEL}>
            {t('fields.keywords')}
          </label>
          <input
            id="field-search_keywords"
            type="text"
            className={INPUT}
            {...register('search_keywords')}
          />
          <p className={cn(HINT, 'mt-1')}>{t('fields.keywordsHint')}</p>
        </div>
      </section>

      {/* ----------------------------------------------------------- specs -- */}
      <section className={SECTION} aria-labelledby="specs-heading">
        <h2 id="specs-heading" className={SECTION_TITLE}>
          {t('fields.specs')}
        </h2>
        <p className={HINT}>{t('fields.specsHint')}</p>

        {definitions.length === 0 ? (
          <p className="text-muted rounded-md border border-dashed p-4 text-center text-sm font-bold">
            {t('fields.specsNone')}
          </p>
        ) : (
          <div key={categoryId} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {definitions.map((definition) => {
              const error = errors.specs?.[definition.key]?.message;
              const registered = register(`specs.${definition.key}`);
              const value = specsValues?.[definition.key] ?? '';
              const options =
                definition.value_type === 'select' && Array.isArray(definition.options)
                  ? (definition.options as Array<{ value?: unknown; label_ar?: unknown }>)
                  : null;

              return (
                <div key={definition.id}>
                  <label htmlFor={`spec-${definition.key}`} className={LABEL}>
                    {definition.label_ar}
                    {definition.unit ? ` (${definition.unit})` : ''}
                  </label>
                  {options ? (
                    <select
                      id={`spec-${definition.key}`}
                      className={INPUT}
                      value={value}
                      {...registered}
                    >
                      <option value="">{t('fields.selectPlaceholder')}</option>
                      {options.map((option, index) =>
                        typeof option.value === 'string' ? (
                          <option key={option.value ?? index} value={option.value}>
                            {typeof option.label_ar === 'string' ? option.label_ar : option.value}
                          </option>
                        ) : null,
                      )}
                    </select>
                  ) : (
                    <input
                      id={`spec-${definition.key}`}
                      type="text"
                      inputMode={definition.value_type === 'number' ? 'decimal' : 'text'}
                      className={INPUT}
                      value={value}
                      {...registered}
                    />
                  )}
                  {typeof error === 'string' ? fieldError(error) : null}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* --------------------------------------------------- images + PDFs -- */}
      <section className={SECTION} aria-labelledby="media-heading">
        <h2 id="media-heading" className={SECTION_TITLE}>
          {t('sections.media')}
        </h2>

        <ImagesField
          images={images}
          disabled={saving}
          onChange={(next) => {
            setImages(next);
            setMediaDirty(true);
          }}
        />

        <div className="grid gap-4 lg:grid-cols-2">
          <CatalogField
            label={t('fields.catalogAr')}
            field={catalogs.ar}
            disabled={saving}
            onChange={(next) => {
              setCatalogs((current) => ({ ...current, ar: next }));
              setMediaDirty(true);
            }}
          />
          <CatalogField
            label={t('fields.catalogEn')}
            field={catalogs.en}
            disabled={saving}
            onChange={(next) => {
              setCatalogs((current) => ({ ...current, en: next }));
              setMediaDirty(true);
            }}
          />
        </div>
      </section>

      {/* --------------------------------------------------------- publish -- */}
      <section className={SECTION} aria-labelledby="publish-heading">
        <h2 id="publish-heading" className={SECTION_TITLE}>
          {t('sections.publish')}
        </h2>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="field-availability" className={LABEL}>
              {t('fields.availability')}
            </label>
            <select
              id="field-availability"
              className={INPUT}
              value={availability}
              {...register('availability')}
            >
              <option value="in_stock">{tAvailability('in_stock')}</option>
              <option value="limited">{tAvailability('limited')}</option>
              <option value="on_request">{tAvailability('on_request')}</option>
            </select>
          </div>

          <div className="flex flex-col justify-end gap-3 pb-1">
            <label className="flex items-center gap-2 text-sm font-bold">
              <input type="checkbox" className="size-4" {...register('is_featured')} />
              {t('fields.featured')}
            </label>
            <label className="flex items-center gap-2 text-sm font-bold">
              <input type="checkbox" className="size-4" {...register('is_published')} />
              {t('fields.published')}
            </label>
          </div>
        </div>
      </section>

      {/* --------------------------------------------------------- actions -- */}
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={isSubmitting || saving}
          className="bg-primary hover:bg-primary-hover inline-flex items-center gap-2 rounded-md px-6 py-2.5 text-sm font-bold text-white transition-colors disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting || saving ? (
            <Loader2 aria-hidden="true" className="size-4 animate-spin" />
          ) : (
            <Save aria-hidden="true" className="size-4" />
          )}
          {isSubmitting || saving ? t('buttons.saving') : t('buttons.save')}
        </button>
        <button
          type="button"
          onClick={cancel}
          disabled={isSubmitting || saving}
          className="border-border bg-surface hover:bg-surface-alt rounded-md border px-6 py-2.5 text-sm font-bold transition-colors disabled:opacity-60"
        >
          {t('buttons.cancel')}
        </button>
        {mode === 'edit' && (
          <Link
            href="/admin/products/"
            className="text-muted hover:text-text text-sm font-bold underline-offset-4 hover:underline"
          >
            {t('backToList')}
          </Link>
        )}
      </div>
    </form>
  );
}

/* ------------------------------------------------------------- helpers --- */

function toExistingItem(row: ProductImageRow): ExistingImageItem {
  return {
    key: row.id,
    kind: 'existing',
    id: row.id,
    storage_path: row.storage_path,
    url: row.url,
    thumb_url: row.thumb_url,
    alt_ar: row.alt_ar ?? '',
    alt_en: row.alt_en ?? '',
    sort_order: row.sort_order,
  };
}

function makeCatalogs(product: ProductRow | null): CatalogsState {
  const build = (url: string | null): CatalogFieldState => ({
    currentUrl: url,
    currentName: fileNameFromUrl(url),
    next: null,
    removed: false,
  });
  return {
    ar: build(product?.catalog_ar_url ?? null),
    en: build(product?.catalog_en_url ?? null),
  };
}

function makeDefaults(
  product: ProductRow | null,
  specsByCategory: Record<string, Lookups['specs']>,
): ProductFormValues {
  if (!product) {
    return {
      name_ar: '',
      name_en: '',
      description_ar: '',
      description_en: '',
      slug: '',
      category_id: '',
      brand_id: '',
      series_id: '',
      system_type: '',
      search_keywords: '',
      availability: 'in_stock',
      is_featured: false,
      is_published: false,
      specs: {},
    };
  }

  const definitions = specsByCategory[product.category_id] ?? [];
  return {
    name_ar: product.name_ar,
    name_en: product.name_en,
    description_ar: product.description_ar ?? '',
    description_en: product.description_en ?? '',
    slug: product.slug,
    category_id: product.category_id,
    brand_id: product.brand_id ?? '',
    series_id: product.series_id ?? '',
    system_type: product.system_type ?? '',
    search_keywords: product.search_keywords ?? '',
    availability: product.availability as ProductFormValues['availability'],
    is_featured: product.is_featured,
    is_published: product.is_published,
    specs: specsToFormValues(product.specs, definitions),
  };
}
