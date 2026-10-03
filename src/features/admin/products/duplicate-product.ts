import { supabaseBrowser } from '@/lib/supabase/browser';
import {
  CATALOGS_BUCKET,
  PRODUCT_IMAGES_BUCKET,
  publicUrl,
  storagePathFromPublicUrl,
  thumbPathFor,
} from '../media/storage';
import type { ProductImageRow } from './types';

export type DuplicateLabels = { suffixAr: string; suffixEn: string };

export type DuplicateResult = { ok: true; id: string } | { ok: false };

async function nextFreeSlug(base: string): Promise<string> {
  const supabase = supabaseBrowser();
  for (let attempt = 1; attempt <= 50; attempt += 1) {
    const candidate = attempt === 1 ? `${base}-copy` : `${base}-copy-${attempt}`;
    const { data, error } = await supabase
      .from('products')
      .select('id')
      .eq('slug', candidate)
      .limit(1);
    if (error) throw error;
    if (!data || data.length === 0) return candidate;
  }
  return `${base}-copy-${Date.now()}`;
}

/**
 * Row action "Duplicate" (PROJECT_SPEC §7): a new draft with a free slug, its
 * own copies of the storage files (so deleting either product can never delete
 * the other one's images) and publish/featured flags cleared.
 */
export async function duplicateProduct(
  productId: string,
  labels: DuplicateLabels,
): Promise<DuplicateResult> {
  const supabase = supabaseBrowser();

  const [{ data: product, error: productError }, { data: images, error: imagesError }] =
    await Promise.all([
      supabase.from('products').select('*').eq('id', productId).maybeSingle(),
      supabase.from('product_images').select('*').eq('product_id', productId).order('sort_order'),
    ]);

  if (productError || imagesError || !product) return { ok: false };

  const slug = await nextFreeSlug(product.slug);
  const { data: created, error: insertError } = await supabase
    .from('products')
    .insert({
      slug,
      category_id: product.category_id,
      brand_id: product.brand_id,
      series_id: product.series_id,
      system_type: product.system_type,
      name_ar: `${product.name_ar}${labels.suffixAr}`,
      name_en: `${product.name_en}${labels.suffixEn}`,
      description_ar: product.description_ar,
      description_en: product.description_en,
      specs: product.specs,
      availability: product.availability,
      catalog_ar_url: null,
      catalog_en_url: null,
      search_keywords: product.search_keywords,
      is_published: false,
      is_featured: false,
      sort_order: product.sort_order,
    })
    .select('id')
    .single();

  if (insertError || !created) return { ok: false };
  const newId = created.id;

  // Copy every image file; a failed thumb copy just means no thumbnail.
  for (const image of images ?? []) {
    const copied = await copyImage(newId, image);
    if (!copied) return { ok: false };
  }

  await copyCatalog(product.catalog_ar_url, newId, 'ar');
  await copyCatalog(product.catalog_en_url, newId, 'en');

  return { ok: true, id: newId };
}

async function copyImage(productId: string, image: ProductImageRow): Promise<boolean> {
  const supabase = supabaseBrowser();
  const newPath = `${productId}/${crypto.randomUUID()}.webp`;

  const { error } = await supabase.storage
    .from(PRODUCT_IMAGES_BUCKET)
    .copy(image.storage_path, newPath);
  if (error) return false;

  let thumbUrl: string | null = null;
  const thumbCopy = await supabase.storage
    .from(PRODUCT_IMAGES_BUCKET)
    .copy(thumbPathFor(image.storage_path), thumbPathFor(newPath));
  if (!thumbCopy.error) {
    thumbUrl = publicUrl(PRODUCT_IMAGES_BUCKET, thumbPathFor(newPath));
  }

  const { error: insertError } = await supabase.from('product_images').insert({
    product_id: productId,
    storage_path: newPath,
    url: publicUrl(PRODUCT_IMAGES_BUCKET, newPath),
    thumb_url: thumbUrl,
    alt_ar: image.alt_ar,
    alt_en: image.alt_en,
    sort_order: image.sort_order,
  });
  return !insertError;
}

async function copyCatalog(
  currentUrl: string | null,
  productId: string,
  language: 'ar' | 'en',
): Promise<void> {
  if (!currentUrl) return;
  const sourcePath = storagePathFromPublicUrl(currentUrl, CATALOGS_BUCKET);
  if (!sourcePath) return;

  const targetPath = `${productId}/catalog-${language}.pdf`;
  const { error } = await supabaseBrowser()
    .storage.from(CATALOGS_BUCKET)
    .copy(sourcePath, targetPath);
  if (error) return;

  const patch =
    language === 'ar'
      ? { catalog_ar_url: publicUrl(CATALOGS_BUCKET, targetPath) }
      : { catalog_en_url: publicUrl(CATALOGS_BUCKET, targetPath) };
  await supabaseBrowser().from('products').update(patch).eq('id', productId);
}
