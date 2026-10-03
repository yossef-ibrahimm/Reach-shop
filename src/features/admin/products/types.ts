import type { Tables } from '@/lib/supabase/database.types';

/** Shared shapes for the admin product form and products list (Phase 3). */

export type ProductRow = Tables<'products'>;
export type ProductImageRow = Tables<'product_images'>;
export type CategoryRow = Tables<'categories'>;
export type BrandRow = Tables<'brands'>;
export type SeriesRow = Tables<'series'>;
export type SpecDefinitionRow = Tables<'spec_definitions'>;

export type ProductFormValues = {
  name_ar: string;
  name_en: string;
  description_ar: string;
  description_en: string;
  slug: string;
  category_id: string;
  brand_id: string;
  series_id: string;
  system_type: string;
  search_keywords: string;
  availability: 'in_stock' | 'limited' | 'on_request';
  is_featured: boolean;
  is_published: boolean;
  specs: Record<string, string>;
};

/**
 * Image slots are staged in the form (not in react-hook-form) because they
 * carry Blobs: nothing touches Storage until the admin hits Save.
 * `existing` rows already live in the DB; `new` rows hold compressed WebP
 * blobs produced at selection time (main + ~480px thumbnail).
 */
export type ExistingImageItem = {
  key: string;
  kind: 'existing';
  id: string;
  storage_path: string;
  url: string;
  thumb_url: string | null;
  alt_ar: string;
  alt_en: string;
  /** Original DB order, used to skip no-op reorder updates on save. */
  sort_order: number;
};

export type NewImageItem = {
  key: string;
  kind: 'new';
  blob: Blob;
  thumbBlob: Blob;
  previewUrl: string;
  alt_ar: string;
  alt_en: string;
};

export type ImageItem = ExistingImageItem | NewImageItem;

/** Staged catalog PDF per language (PROJECT_SPEC §7: separate optional AR/EN uploads). */
export type CatalogField = {
  /** Public URL of the file currently stored (null when none). */
  currentUrl: string | null;
  /** Display name of the current file (basename of `currentUrl`). */
  currentName: string | null;
  /** Replacement file waiting for the next save. */
  next: File | null;
  /** Admin removed the current file; column becomes null on save. */
  removed: boolean;
};

export type CatalogsState = { ar: CatalogField; en: CatalogField };

export function emptyCatalog(): CatalogField {
  return { currentUrl: null, currentName: null, next: null, removed: false };
}
