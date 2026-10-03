import { supabaseBrowser } from '@/lib/supabase/browser';
import {
  CATALOGS_BUCKET,
  PRODUCT_IMAGES_BUCKET,
  removeObjects,
  storagePathFromPublicUrl,
  thumbPathFor,
} from '../media/storage';

export type DeleteResult = { ok: true; storageFailed: number } | { ok: false };

/**
 * Row action "Delete" (PROJECT_SPEC §7): the product row goes first (image
 * rows cascade), then its storage files are removed best-effort — file
 * failures are reported as a warning instead of resurrecting the row.
 */
export async function deleteProduct(productId: string): Promise<DeleteResult> {
  const supabase = supabaseBrowser();

  const [{ data: images, error: imagesError }, { data: product, error: productError }] =
    await Promise.all([
      supabase.from('product_images').select('storage_path').eq('product_id', productId),
      supabase
        .from('products')
        .select('catalog_ar_url, catalog_en_url')
        .eq('id', productId)
        .maybeSingle(),
    ]);
  if (imagesError || productError) return { ok: false };

  const { error: deleteError } = await supabase.from('products').delete().eq('id', productId);
  if (deleteError) return { ok: false };

  const imagePaths = (images ?? []).flatMap((image) => [
    image.storage_path,
    thumbPathFor(image.storage_path),
  ]);
  const catalogPaths = [product?.catalog_ar_url, product?.catalog_en_url]
    .map((url) => (url ? storagePathFromPublicUrl(url, CATALOGS_BUCKET) : null))
    .filter((path): path is string => path !== null);

  const imageFailures = await removeObjects(PRODUCT_IMAGES_BUCKET, imagePaths);
  const catalogFailures = await removeObjects(CATALOGS_BUCKET, catalogPaths);

  return { ok: true, storageFailed: imageFailures + catalogFailures };
}
