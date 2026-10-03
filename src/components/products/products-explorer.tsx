'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Search, SearchX, SlidersHorizontal, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { FaWhatsapp } from 'react-icons/fa6';
import { usePathname, useRouter } from '@/lib/i18n/navigation';
import { useSearchParams } from 'next/navigation';
import { buildProductSearch, searchProductIds } from '@/lib/products/search';
import {
  hasActiveFilters,
  parseListingState,
  serializeListingState,
  type ListingState,
  type SortKey,
} from '@/lib/products/url-state';
import type {
  BrandData,
  CategoryData,
  ProductCardData,
  SpecDefinition,
} from '@/lib/products/types';
import { ProductCard } from '@/components/ui/product-card';
import { useDialogBehavior } from '@/lib/use-dialog';

const PAGE_SIZE = 24;
const SYSTEM_VALUES = ['conventional', 'addressable'] as const;
const AVAILABILITY_VALUES = ['in_stock', 'limited', 'on_request'] as const;

type FacetKey = 'category' | 'brand' | 'system' | 'availability';
type FacetOption = { value: string; label: string; count: number };
type SpecGroup = { key: string; label: string; options: FacetOption[] };

function facetValue(product: ProductCardData, facet: FacetKey): string | null {
  switch (facet) {
    case 'category':
      return product.category?.slug ?? null;
    case 'brand':
      return product.brand?.slug ?? null;
    case 'system':
      return product.system_type;
    case 'availability':
      return product.availability;
  }
}

type Props = {
  locale: string;
  products: ProductCardData[];
  categories: CategoryData[];
  brands: BrandData[];
  specDefs: SpecDefinition[];
  whatsappUrl: string | null;
};

/**
 * Products listing (PROJECT_SPEC §6.3): all published products are baked into
 * the page; search + filters + sort run client-side and live in the URL.
 */
export function ProductsExplorer({
  locale,
  products,
  categories,
  brands,
  specDefs,
  whatsappUrl,
}: Props) {
  const t = useTranslations('products');
  const tc = useTranslations('common');
  const tSystem = useTranslations('system');
  const tAvailability = useTranslations('availability');
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const state = useMemo(
    () => parseListingState(new URLSearchParams(searchParams.toString())),
    [searchParams],
  );

  const applyState = useCallback(
    (next: ListingState) => {
      const query = serializeListingState(next);
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    },
    [pathname, router],
  );

  /* ---------------------------------------------------------- search box -- */

  const [draft, setDraft] = useState(state.q);
  const timerRef = useRef<number | null>(null);

  // Adjust local state during render when the URL `q` changes externally
  // (chip removal, back/forward) — React's documented pattern, no effect needed.
  const [prevQuery, setPrevQuery] = useState(state.q);
  if (state.q !== prevQuery) {
    setPrevQuery(state.q);
    setDraft(state.q);
  }

  useEffect(
    () => () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    },
    [],
  );

  const onDraftChange = (value: string) => {
    setDraft(value);
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      applyState({ ...state, q: value.trim() });
    }, 300);
  };

  /* ------------------------------------------------------------ filtering -- */

  const index = useMemo(() => buildProductSearch(products), [products]);
  const searchIds = useMemo(
    () => (state.q.trim() ? searchProductIds(index, state.q) : null),
    [index, state.q],
  );
  const collator = useMemo(() => new Intl.Collator(locale), [locale]);

  const passes = useCallback(
    (product: ProductCardData, skipFacet?: FacetKey, skipSpecKey?: string): boolean => {
      if (searchIds && !searchIds.has(product.id)) return false;

      if (state.category.length > 0 && skipFacet !== 'category') {
        if (!state.category.includes(product.category?.slug ?? '')) return false;
      }
      if (state.brand.length > 0 && skipFacet !== 'brand') {
        if (!state.brand.includes(product.brand?.slug ?? '')) return false;
      }
      if (state.system.length > 0 && skipFacet !== 'system') {
        if (!state.system.includes(product.system_type ?? '')) return false;
      }
      if (state.availability.length > 0 && skipFacet !== 'availability') {
        if (!state.availability.includes(product.availability)) return false;
      }

      if (state.category.length === 1) {
        const specs = product.specs;
        const isObject = specs !== null && typeof specs === 'object' && !Array.isArray(specs);
        for (const [key, values] of Object.entries(state.specs)) {
          if (key === skipSpecKey || values.length === 0) continue;
          if (!isObject) return false;
          const raw = (specs as Record<string, unknown>)[key];
          if (raw === null || raw === undefined || !values.includes(String(raw))) {
            return false;
          }
        }
      }

      return true;
    },
    [searchIds, state],
  );

  const list = useMemo(() => {
    const filtered = products.filter((product) => passes(product));
    if (state.sort === 'name') {
      const key = locale === 'en' ? 'name_en' : 'name_ar';
      filtered.sort((a, b) => collator.compare(a[key], b[key]));
    }
    return filtered;
  }, [products, passes, state.sort, collator, locale]);

  const [visible, setVisible] = useState(PAGE_SIZE);
  const filterSignature = serializeListingState({ ...state, sort: 'featured' });
  // Reset pagination whenever search/filters change (sort alone does not).
  const [prevSignature, setPrevSignature] = useState(filterSignature);
  if (filterSignature !== prevSignature) {
    setPrevSignature(filterSignature);
    setVisible(PAGE_SIZE);
  }

  /* -------------------------------------------------------- facet options -- */

  const nameOf = (slug: string, kind: 'category' | 'brand'): string => {
    const item = (kind === 'category' ? categories : brands).find((entry) => entry.slug === slug);
    if (!item) return slug;
    return locale === 'en' ? item.name_en : item.name_ar;
  };

  const countFacet = (facet: FacetKey, value: string): number =>
    products.filter((product) => passes(product, facet) && facetValue(product, facet) === value)
      .length;

  const countSpecValue = (key: string, value: string): number =>
    products.filter((product) => {
      if (!passes(product, undefined, key)) return false;
      const specs = product.specs;
      if (specs === null || typeof specs !== 'object' || Array.isArray(specs)) return false;
      const raw = (specs as Record<string, unknown>)[key];
      return raw !== null && raw !== undefined && String(raw) === value;
    }).length;

  const specActive = state.category.length === 1;

  const facetOptions: Record<FacetKey, FacetOption[]> = {
    category: categories
      .map((category) => ({
        value: category.slug,
        label: locale === 'en' ? category.name_en : category.name_ar,
        count: countFacet('category', category.slug),
      }))
      .filter((option) => option.count > 0 || state.category.includes(option.value)),
    brand: brands
      .map((brand) => ({
        value: brand.slug,
        label: locale === 'en' ? brand.name_en : brand.name_ar,
        count: countFacet('brand', brand.slug),
      }))
      .filter((option) => option.count > 0 || state.brand.includes(option.value)),
    system: SYSTEM_VALUES.map((value) => ({
      value,
      label: tSystem(value),
      count: countFacet('system', value),
    })).filter((option) => option.count > 0 || state.system.includes(option.value)),
    availability: AVAILABILITY_VALUES.map((value) => ({
      value,
      label: tAvailability(value),
      count: countFacet('availability', value),
    })).filter((option) => option.count > 0 || state.availability.includes(option.value)),
  };

  const specGroups: SpecGroup[] = [];
  if (specActive) {
    const categorySlug = state.category[0];
    const defs = specDefs.filter((def) => def.is_filterable && def.category_slug === categorySlug);
    for (const def of defs) {
      const values = new Set<string>();
      for (const product of products) {
        if (product.category?.slug !== categorySlug) continue;
        const specs = product.specs;
        if (specs === null || typeof specs !== 'object' || Array.isArray(specs)) continue;
        const raw = (specs as Record<string, unknown>)[def.key];
        if (raw !== null && raw !== undefined && typeof raw !== 'object') {
          values.add(String(raw));
        }
      }
      if (values.size === 0) continue;

      const numeric = [...values].every((value) => !Number.isNaN(Number(value)));
      const options: FacetOption[] = [...values].map((value) => {
        let label = value;
        if (Array.isArray(def.options)) {
          const option = (
            def.options as Array<{ value?: unknown; label_ar?: unknown; label_en?: unknown }>
          ).find((entry) => String(entry.value) === value);
          if (option) {
            const localized = locale === 'en' ? option.label_en : option.label_ar;
            if (typeof localized === 'string') label = localized;
          }
        } else if (def.unit) {
          label = `${value} ${def.unit}`;
        }
        return { value, label, count: countSpecValue(def.key, value) };
      });
      options.sort((a, b) =>
        numeric ? Number(a.value) - Number(b.value) : collator.compare(a.label, b.label),
      );

      specGroups.push({
        key: def.key,
        label: locale === 'en' ? def.label_en : def.label_ar,
        options,
      });
    }
  }

  /* --------------------------------------------------------------- chips -- */

  const toggleValue = (values: string[], value: string): string[] =>
    values.includes(value) ? values.filter((item) => item !== value) : [...values, value];

  const handleFacet = (facet: FacetKey, value: string) => {
    switch (facet) {
      case 'category':
        applyState({ ...state, category: toggleValue(state.category, value), specs: {} });
        break;
      case 'brand':
        applyState({ ...state, brand: toggleValue(state.brand, value) });
        break;
      case 'system':
        applyState({ ...state, system: toggleValue(state.system, value) });
        break;
      case 'availability':
        applyState({ ...state, availability: toggleValue(state.availability, value) });
        break;
    }
  };

  const handleSpec = (key: string, value: string) => {
    const current = state.specs[key] ?? [];
    applyState({ ...state, specs: { ...state.specs, [key]: toggleValue(current, value) } });
  };

  const handleClear = () => {
    setDraft('');
    applyState({
      ...state,
      q: '',
      category: [],
      brand: [],
      system: [],
      availability: [],
      specs: {},
    });
  };

  type Chip = { id: string; label: string; onRemove: () => void };
  const chips: Chip[] = [];
  if (state.q) {
    chips.push({
      id: 'q',
      label: `“${state.q}”`,
      onRemove: () => {
        setDraft('');
        applyState({ ...state, q: '' });
      },
    });
  }
  for (const slug of state.category) {
    chips.push({
      id: `category:${slug}`,
      label: nameOf(slug, 'category'),
      onRemove: () =>
        applyState({
          ...state,
          category: state.category.filter((item) => item !== slug),
          specs: {},
        }),
    });
  }
  for (const slug of state.brand) {
    chips.push({
      id: `brand:${slug}`,
      label: nameOf(slug, 'brand'),
      onRemove: () => applyState({ ...state, brand: state.brand.filter((item) => item !== slug) }),
    });
  }
  for (const value of state.system) {
    chips.push({
      id: `system:${value}`,
      label: tSystem(value as (typeof SYSTEM_VALUES)[number]),
      onRemove: () =>
        applyState({ ...state, system: state.system.filter((item) => item !== value) }),
    });
  }
  for (const value of state.availability) {
    chips.push({
      id: `availability:${value}`,
      label: tAvailability(value as (typeof AVAILABILITY_VALUES)[number]),
      onRemove: () =>
        applyState({
          ...state,
          availability: state.availability.filter((item) => item !== value),
        }),
    });
  }
  if (specActive) {
    for (const [key, values] of Object.entries(state.specs)) {
      const group = specGroups.find((entry) => entry.key === key);
      if (!group) continue;
      for (const value of values) {
        chips.push({
          id: `spec:${key}:${value}`,
          label: `${group.label}: ${group.options.find((option) => option.value === value)?.label ?? value}`,
          onRemove: () => handleSpec(key, value),
        });
      }
    }
  }

  const activeCount =
    (state.q ? 1 : 0) +
    state.category.length +
    state.brand.length +
    state.system.length +
    state.availability.length +
    Object.values(state.specs).reduce((sum, values) => sum + values.length, 0);

  /* --------------------------------------------------------------- drawer -- */

  const [drawerOpen, setDrawerOpen] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  useDialogBehavior(drawerOpen, dialogRef);
  useEffect(() => {
    if (!drawerOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setDrawerOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [drawerOpen]);

  const panel = (
    <FiltersPanel
      facetOptions={facetOptions}
      specGroups={specGroups}
      state={state}
      active={hasActiveFilters(state)}
      onFacet={handleFacet}
      onSpec={handleSpec}
      onClear={handleClear}
    />
  );

  /* --------------------------------------------------------------- render -- */

  return (
    <div className="mt-8">
      <div className="relative">
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
        />
        <input
          type="search"
          value={draft}
          onChange={(event) => onDraftChange(event.target.value)}
          aria-label={t('searchLabel')}
          placeholder={t('searchPlaceholder')}
          className="border-border bg-surface focus:border-fire-600 w-full rounded-md border py-3 ps-10 pe-4 text-base transition-colors hover:border-slate-400"
        />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="hidden lg:block">
          <div className="border-border bg-surface sticky top-28 rounded-md border p-4 shadow-sm">
            {panel}
          </div>
        </aside>

        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              className="border-border bg-surface hover:bg-surface-alt inline-flex h-11 items-center gap-2 rounded-md border px-3 text-sm font-bold transition-colors lg:hidden"
            >
              <SlidersHorizontal aria-hidden="true" className="h-4 w-4" />
              {tc('filters')}
              {activeCount > 0 && (
                <span className="bg-fire-600 inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-xs text-white">
                  {activeCount}
                </span>
              )}
            </button>

            <span className="text-muted text-sm">{tc('results', { count: list.length })}</span>

            <label className="ms-auto flex items-center gap-2 text-sm font-semibold">
              <span className="hidden sm:inline">{t('sortLabel')}</span>
              <select
                value={state.sort}
                onChange={(event) => applyState({ ...state, sort: event.target.value as SortKey })}
                className="border-border bg-surface rounded-md border px-3 py-2 text-base font-bold"
              >
                <option value="featured">{t('sortFeatured')}</option>
                <option value="name">{t('sortName')}</option>
              </select>
            </label>
          </div>

          {chips.length > 0 && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {chips.map((chip) => (
                <span
                  key={chip.id}
                  className="bg-fire-50 text-fire-700 inline-flex max-w-full items-center gap-1 rounded-full py-1 ps-3 pe-1.5 text-xs font-bold"
                >
                  <span className="truncate">{chip.label}</span>
                  <button
                    type="button"
                    onClick={chip.onRemove}
                    aria-label={tc('removeFilter', { name: chip.label })}
                    className="hover:bg-fire-600 flex h-7 w-7 items-center justify-center rounded-full transition-colors hover:text-white"
                  >
                    <X aria-hidden="true" className="h-3.5 w-3.5" />
                  </button>
                </span>
              ))}
              <button
                type="button"
                onClick={handleClear}
                className="text-fire-700 inline-flex min-h-6 items-center py-1 text-xs font-bold underline underline-offset-2"
              >
                {tc('clearFilters')}
              </button>
            </div>
          )}

          {list.length === 0 ? (
            <div className="border-border bg-surface mt-6 rounded-md border py-16 text-center">
              <SearchX aria-hidden="true" className="mx-auto h-10 w-10 text-slate-400" />
              <h2 className="mt-4 text-xl font-bold">{t('emptyTitle')}</h2>
              <p className="text-muted mx-auto mt-2 max-w-md">{t('emptyBody')}</p>
              {whatsappUrl && (
                <a
                  href={whatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-whatsapp hover:bg-navy-950 mt-6 inline-flex h-11 items-center gap-2 rounded-md px-5 font-bold text-white transition-colors"
                >
                  <FaWhatsapp aria-hidden="true" className="h-4 w-4" />
                  {tc('askWa')}
                </a>
              )}
            </div>
          ) : (
            <>
              <ul className="mt-6 grid list-none grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {list.slice(0, visible).map((product) => (
                  <li key={product.id}>
                    <ProductCard product={product} specDefs={specDefs} />
                  </li>
                ))}
              </ul>

              <div className="mt-8 flex flex-col items-center gap-3">
                {visible < list.length && (
                  <button
                    type="button"
                    onClick={() => setVisible((count) => count + PAGE_SIZE)}
                    className="border-border bg-surface hover:bg-surface-alt rounded-md border px-6 py-3 font-bold transition-colors"
                  >
                    {tc('loadMore')}
                  </button>
                )}
                <p className="text-muted text-sm">
                  {tc('showing', {
                    shown: Math.min(visible, list.length),
                    total: list.length,
                  })}
                </p>
              </div>
            </>
          )}
        </div>
      </div>

      {drawerOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="bg-navy-950/60 absolute inset-0"
            onClick={() => setDrawerOpen(false)}
            aria-hidden="true"
          />
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-label={t('filtersTitle')}
            tabIndex={-1}
            className="bg-surface absolute inset-y-0 start-0 flex w-[min(340px,88vw)] flex-col shadow-xl"
          >
            <div className="border-border flex items-center justify-between border-b p-4">
              <h2 className="font-bold">{t('filtersTitle')}</h2>
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                aria-label={tc('close')}
                className="hover:bg-surface-alt flex h-11 w-11 items-center justify-center rounded-md transition-colors"
              >
                <X aria-hidden="true" className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">{panel}</div>
            <div className="border-border border-t p-4">
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                className="bg-primary hover:bg-primary-hover w-full rounded-md py-3 font-bold text-white transition-colors"
              >
                {tc('showResults')} ({list.length})
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------- filters --- */

type FiltersPanelProps = {
  facetOptions: Record<FacetKey, FacetOption[]>;
  specGroups: SpecGroup[];
  state: ListingState;
  active: boolean;
  onFacet: (facet: FacetKey, value: string) => void;
  onSpec: (key: string, value: string) => void;
  onClear: () => void;
};

function FiltersPanel({
  facetOptions,
  specGroups,
  state,
  active,
  onFacet,
  onSpec,
  onClear,
}: FiltersPanelProps) {
  const t = useTranslations('products');
  const tc = useTranslations('common');

  return (
    <div className="space-y-6">
      {active && (
        <button
          type="button"
          onClick={onClear}
          className="text-fire-700 inline-flex min-h-6 items-center py-1 text-sm font-bold underline underline-offset-2"
        >
          {tc('clearFilters')}
        </button>
      )}

      <FacetGroup
        legend={t('facetCategory')}
        options={facetOptions.category}
        selected={state.category}
        onToggle={(value) => onFacet('category', value)}
      />
      <FacetGroup
        legend={t('facetBrand')}
        options={facetOptions.brand}
        selected={state.brand}
        onToggle={(value) => onFacet('brand', value)}
      />
      <FacetGroup
        legend={t('facetSystem')}
        options={facetOptions.system}
        selected={state.system}
        onToggle={(value) => onFacet('system', value)}
      />
      <FacetGroup
        legend={t('facetAvailability')}
        options={facetOptions.availability}
        selected={state.availability}
        onToggle={(value) => onFacet('availability', value)}
      />

      {specGroups.map((group) => (
        <FacetGroup
          key={group.key}
          legend={group.label}
          options={group.options}
          selected={state.specs[group.key] ?? []}
          onToggle={(value) => onSpec(group.key, value)}
        />
      ))}
    </div>
  );
}

type FacetGroupProps = {
  legend: string;
  options: FacetOption[];
  selected: string[];
  onToggle: (value: string) => void;
};

function FacetGroup({ legend, options, selected, onToggle }: FacetGroupProps) {
  if (options.length === 0) return null;

  return (
    <fieldset className="min-w-0">
      <legend className="mb-1.5 text-sm font-bold">{legend}</legend>
      <div>
        {options.map((option) => (
          <label
            key={option.value}
            className="hover:bg-surface-alt flex cursor-pointer items-center gap-2.5 rounded px-2 py-1.5 text-sm transition-colors"
          >
            <input
              type="checkbox"
              checked={selected.includes(option.value)}
              onChange={() => onToggle(option.value)}
              className="accent-primary h-4 w-4 shrink-0"
            />
            <span className="truncate">{option.label}</span>
            <span className="bg-surface-alt text-muted ms-auto rounded px-1.5 text-xs font-bold tabular-nums">
              {option.count}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
