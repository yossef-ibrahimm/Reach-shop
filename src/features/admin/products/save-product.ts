import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import { supabaseBrowser } from '@/lib/supabase/browser';
import {
  CATALOGS_BUCKET,
  PRODUCT_IMAGES_BUCKET,
  publicUrl,
  removeObjects,
  storagePathFromPublicUrl,
  thumbPathFor,
} from '../media/storage';
import type {
  CatalogField,
  CatalogsState,
  ExistingImageItem,
  ImageItem,
  ProductFormValues,
} from './types';

/** The product row insert/update payload derived from the form. */
export type ProductPayload = {
  name_ar: string;
  name_en: string;
  description_ar: string | null;
  description_en: string | null;
  slug: string;
  category_id: string;
  brand_id: string | null;
  series_id: string | null;
  system_type: string | null;
  search_keywords: string | null;
  availability: string;
  is_featured: boolean;
  is_published: boolean;
  specs: Record<string, string | number>;
};

/** Raised when the slug is already taken (unique index on products.slug). */
export class SlugConflictError extends Error {
  constructor() {
    super('slug already taken');
    this.name = 'SlugConflictError';
  }
}

/**
 * The product row was written but a follow-up step (image/PDF upload) failed.
 * Carries the id so the caller can still send the admin to the edit page.
 */
export class PartialSaveError extends Error {
  readonly productId: string;

  constructor(productId: string, cause: unknown) {
    super(cause instanceof Error ? cause.message : 'partial save failed', { cause });
    this.name = 'PartialSaveError';
    this.productId = productId;
  }
}

/** True when another product already owns this slug (unique index). */
export async function isSlugTaken(slug: string, currentId: string | null): Promise<boolean> {
  let query = supabaseBrowser().from('products').select('id').eq('slug', slug).limit(1);
  if (currentId) query = query.neq('id', currentId);
  const { data, error } = await query;
  if (error) throw error;
  return (data?.length ?? 0) > 0;
}

export function toProductPayload(
  values: ProductFormValues,
  specs: Record<string, string | number>,
): ProductPayload {
  const description_ar = values.description_ar.trim();
  const description_en = values.description_en.trim();
  const search_keywords = values.search_keywords.trim();

  return {
    name_ar: values.name_ar.trim(),
    name_en: values.name_en.trim(),
    description_ar: description_ar === '' ? null : description_ar,
    description_en: description_en === '' ? null : description_en,
    slug: values.slug,
    category_id: values.category_id,
    brand_id: values.brand_id === '' ? null : values.brand_id,
    series_id: values.series_id === '' ? null : values.series_id,
    system_type: values.system_type === '' ? null : values.system_type,
    search_keywords: search_keywords === '' ? null : search_keywords,
    availability: values.availability,
    is_featured: values.is_featured,
    is_published: values.is_published,
    specs,
  };
}

type Db = SupabaseClient<Database>;

export type SaveProductArgs = {
  mode: 'new' | 'edit';
  productId: string | null;
  values: ProductFormValues;
  specs: Record<string, string | number>;
  images: ImageItem[];
  baselineImages: ExistingImageItem[];
  catalogs: CatalogsState;
};

/**
 * Write orchestration (PROJECT_SPEC §7): the product row first (we need its id
 * for storage paths), then images, then catalog PDFs. Any failure after the row
 * exists throws `PartialSaveError` so the UI can point at the edit page.
 */
export async function saveProduct(args: SaveProductArgs): Promise<{ id: string }> {
  const supabase = supabaseBrowser();
  const payload = toProductPayload(args.values, args.specs);
  let id: string;

  if (args.mode === 'new') {
    const { data, error } = await supabase.from('products').insert(payload).select('id').single();
    if (error) {
      if (error.code === '23505') throw new SlugConflictError();
      throw error;
    }
    id = data.id;
  } else {
    if (!args.productId) throw new Error('missing product id');
    const { data, error } = await supabase
      .from('products')
      .update(payload)
      .eq('id', args.productId)
      .select('id')
      .single();
    if (error) {
      if (error.code === '23505') throw new SlugConflictError();
      throw error;
    }
    id = data.id;
  }

  try {
    await syncImages(supabase, id, args.images, args.baselineImages);
    await syncCatalog(supabase, id, 'ar', args.catalogs.ar);
    await syncCatalog(supabase, id, 'en', args.catalogs.en);
  } catch (error) {
    throw new PartialSaveError(id, error);
  }

  return { id };
}

async function syncImages(
  supabase: Db,
  productId: string,
  images: ImageItem[],
  baseline: ExistingImageItem[],
): Promise<void> {
  const kept = new Map(
    images.flatMap((item) => (item.kind === 'existing' ? [[item.id, item] as const] : [])),
  );

  // 1. Removed existing images: rows first (public consistency), storage best-effort.
  const removed = baseline.filter((item) => !kept.has(item.id));
  if (removed.length > 0) {
    const { error } = await supabase
      .from('product_images')
      .delete()
      .in(
        'id',
        removed.map((item) => item.id),
      );
    if (error) throw error;
    await removeObjects(
      PRODUCT_IMAGES_BUCKET,
      removed.flatMap((item) => [item.storage_path, thumbPathFor(item.storage_path)]),
    );
  }

  // 2. Surviving rows: persist reorder + alt edits (only when actually changed).
  const baselineById = new Map(baseline.map((item) => [item.id, item]));
  let sort_order = 0;
  for (const item of images) {
    if (item.kind === 'existing') {
      const original = baselineById.get(item.id);
      const changed =
        !original ||
        original.alt_ar !== item.alt_ar ||
        original.alt_en !== item.alt_en ||
        original.sort_order !== sort_order;
      if (changed) {
        const { error } = await supabase
          .from('product_images')
          .update({ alt_ar: item.alt_ar || null, alt_en: item.alt_en || null, sort_order })
          .eq('id', item.id);
        if (error) throw error;
      }
    }
    sort_order += 1;
  }

  // 3. New images: upload WebP + thumbnail, then insert the row.
  sort_order = 0;
  for (const item of images) {
    if (item.kind === 'new') {
      const path = `${productId}/${crypto.randomUUID()}.webp`;
      const thumbPath = thumbPathFor(path);

      const upload = await supabase.storage
        .from(PRODUCT_IMAGES_BUCKET)
        .upload(path, item.blob, { contentType: 'image/webp' });
      if (upload.error) throw upload.error;

      let thumbUrl: string | null = null;
      const thumbUpload = await supabase.storage
        .from(PRODUCT_IMAGES_BUCKET)
        .upload(thumbPath, item.thumbBlob, { contentType: 'image/webp' });
      if (thumbUpload.error) throw thumbUpload.error;
      thumbUrl = publicUrl(PRODUCT_IMAGES_BUCKET, thumbPath);

      const { error } = await supabase.from('product_images').insert({
        product_id: productId,
        storage_path: path,
        url: publicUrl(PRODUCT_IMAGES_BUCKET, path),
        thumb_url: thumbUrl,
        alt_ar: item.alt_ar || null,
        alt_en: item.alt_en || null,
        sort_order,
      });
      if (error) throw error;
    }
    sort_order += 1;
  }
}

async function syncCatalog(
  supabase: Db,
  productId: string,
  language: 'ar' | 'en',
  field: CatalogField,
): Promise<void> {
  const columnPatch = (url: string | null) =>
    language === 'ar' ? { catalog_ar_url: url } : { catalog_en_url: url };

  if (field.next) {
    const path = `${productId}/catalog-${language}.pdf`;
    const upload = await supabase.storage
      .from(CATALOGS_BUCKET)
      .upload(path, field.next, { contentType: 'application/pdf', upsert: true });
    if (upload.error) throw upload.error;

    const oldPath = field.currentUrl
      ? storagePathFromPublicUrl(field.currentUrl, CATALOGS_BUCKET)
      : null;
    if (oldPath && oldPath !== path) {
      await removeObjects(CATALOGS_BUCKET, [oldPath]);
    }

    const { error } = await supabase
      .from('products')
      .update(columnPatch(publicUrl(CATALOGS_BUCKET, path)))
      .eq('id', productId);
    if (error) throw error;
    return;
  }

  if (field.removed) {
    const { error } = await supabase.from('products').update(columnPatch(null)).eq('id', productId);
    if (error) throw error;
    if (field.currentUrl) {
      const oldPath = storagePathFromPublicUrl(field.currentUrl, CATALOGS_BUCKET);
      if (oldPath) await removeObjects(CATALOGS_BUCKET, [oldPath]);
    }
  }
}
