'use client';

import { useSearchParams } from 'next/navigation';
import { ProductForm, ProductNotFoundBox } from './product-form';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Edit entry point: admin edit pages use `?id=<uuid>` (never a dynamic route
 * segment, PROJECT_SPEC §2.4) and read it client-side, which requires a
 * `<Suspense>` boundary in the page for static export.
 */
export function ProductEditEntry() {
  const searchParams = useSearchParams();
  const id = searchParams.get('id') ?? '';

  if (!UUID_PATTERN.test(id)) return <ProductNotFoundBox />;
  return <ProductForm mode="edit" id={id} />;
}
