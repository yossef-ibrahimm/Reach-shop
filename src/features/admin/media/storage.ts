import { supabaseBrowser } from '@/lib/supabase/browser';

/** Bucket ids from migration 0004 (public read, admin-only write via RLS). */
export const PRODUCT_IMAGES_BUCKET = 'product-images';
export const CATALOGS_BUCKET = 'catalogs';

/**
 * Thumbnail storage convention: the thumb lives next to the full image with a
 * `.thumb` suffix before the extension (`p/1.webp` → `p/1.thumb.webp`), so the
 * path can be derived from `product_images.storage_path` without an extra column.
 */
export function thumbPathFor(path: string): string {
  const match = /^(.*)\.[a-z0-9]+$/i.exec(path);
  return match ? `${match[1]}.thumb.webp` : `${path}.thumb.webp`;
}

/** Absolute public URL for an object in one of the public buckets. */
export function publicUrl(bucket: string, path: string): string {
  const { data } = supabaseBrowser().storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}

/** Inverse of `publicUrl` — returns null when the URL is not in the expected bucket. */
export function storagePathFromPublicUrl(url: string, bucket: string): string | null {
  const marker = `/object/public/${bucket}/`;
  const index = url.indexOf(marker);
  if (index === -1) return null;
  const path = url.slice(index + marker.length).split('?')[0];
  try {
    return decodeURIComponent(path);
  } catch {
    return path;
  }
}

/** Display name of a stored file (decoded basename of its public URL). */
export function fileNameFromUrl(url: string | null): string | null {
  if (!url) return null;
  const withoutQuery = url.split('?')[0];
  const segment = withoutQuery.slice(withoutQuery.lastIndexOf('/') + 1);
  if (!segment) return null;
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

const REMOVE_CHUNK_SIZE = 100;

/**
 * Best-effort batch delete. Returns the number of paths that failed so callers
 * can warn instead of failing the whole operation (rows are already gone).
 */
export async function removeObjects(bucket: string, paths: string[]): Promise<number> {
  const unique = [...new Set(paths)].filter((path) => path.length > 0);
  const supabase = supabaseBrowser();
  let failed = 0;

  for (let index = 0; index < unique.length; index += REMOVE_CHUNK_SIZE) {
    const chunk = unique.slice(index, index + REMOVE_CHUNK_SIZE);
    const { error } = await supabase.storage.from(bucket).remove(chunk);
    if (error) failed += chunk.length;
  }

  return failed;
}
