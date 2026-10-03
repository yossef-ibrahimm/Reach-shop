'use client';

import { ArrowRight } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { Link } from '@/lib/i18n/navigation';
import { cn } from '@/lib/cn';
import type { Json } from '@/lib/supabase/database.types';
import type { ProductCardData, SpecDefinition } from '@/lib/products/types';
import { AvailabilityBadge } from './availability-badge';
import { categoryGlyph } from './category-icons';

/**
 * Short mono spec line for the card (D-038): first 3 values (plus units),
 * language-neutral like technical codes — full labels live in the specs table.
 */
function specLine(product: ProductCardData, defs: SpecDefinition[]): string | null {
  const specs = product.specs;
  if (!specs || typeof specs !== 'object' || Array.isArray(specs)) return null;

  const defMap = new Map(defs.map((def) => [def.key, def]));
  const entries = Object.entries(specs as Record<string, Json>).map(([key, value], index) => ({
    key,
    value,
    index,
    def: defMap.get(key),
  }));
  entries.sort(
    (a, b) => (a.def?.sort_order ?? 999) - (b.def?.sort_order ?? 999) || a.index - b.index,
  );

  const parts: string[] = [];
  for (const entry of entries) {
    if (entry.value === null || typeof entry.value === 'object') continue;
    const unit = entry.def?.unit ? ` ${entry.def.unit}` : '';
    parts.push(`${String(entry.value)}${unit}`);
    if (parts.length === 3) break;
  }

  return parts.length > 0 ? parts.join(' · ') : null;
}

type Props = {
  product: ProductCardData;
  specDefs?: SpecDefinition[];
};

export function ProductCard({ product, specDefs = [] }: Props) {
  const t = useTranslations();
  const locale = useLocale();
  const name = locale === 'en' ? product.name_en : product.name_ar;
  const brandName = product.brand
    ? locale === 'en'
      ? product.brand.name_en
      : product.brand.name_ar
    : null;
  const line = specLine(product, specDefs);
  const cover = product.images[0];

  return (
    <Link
      href={`/products/${product.slug}/`}
      aria-label={t('common.viewProduct', { name })}
      className="border-border bg-surface group hover:border-fire-600/40 relative flex flex-col overflow-hidden rounded-md border shadow-sm transition-all duration-150 hover:-translate-y-0.5 hover:shadow-md"
    >
      <span
        aria-hidden="true"
        className="bg-primary absolute inset-x-0 top-0 h-[3px] origin-left scale-x-0 transition-transform duration-150 group-hover:scale-x-100 rtl:origin-right"
      />
      <div className="border-border flex aspect-[4/3] items-center justify-center border-b bg-white p-4">
        {cover ? (
          // eslint-disable-next-line @next/next/no-img-element -- static export, unoptimized remote storage URLs
          <img
            src={cover.thumb_url ?? cover.url}
            alt={(locale === 'en' ? cover.alt_en : cover.alt_ar) ?? name}
            loading="lazy"
            width={400}
            height={300}
            className="h-full w-full object-contain"
          />
        ) : (
          <span className="text-slate-200">
            {categoryGlyph(product.category?.slug ?? '', {
              className: 'h-14 w-14',
              strokeWidth: 1.25,
            })}
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4">
        {brandName && (
          <span className="bg-surface-alt text-muted w-fit rounded-full px-2.5 py-0.5 text-xs font-bold">
            {brandName}
          </span>
        )}
        <h3 className={cn('text-base leading-snug font-semibold', 'line-clamp-2 min-h-[2.6em]')}>
          {name}
        </h3>
        {line && <p className="phone truncate text-xs text-slate-600">{line}</p>}
        <div className="mt-auto flex items-center justify-between pt-1">
          <AvailabilityBadge availability={product.availability} />
          <ArrowRight
            aria-hidden="true"
            className="group-hover:text-fire-600 h-4 w-4 text-slate-400 transition-colors ltr:rotate-0 rtl:rotate-180"
          />
        </div>
      </div>
    </Link>
  );
}
