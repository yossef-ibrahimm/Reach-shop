import type { Metadata } from 'next';
import { Suspense } from 'react';
import { getTranslations } from 'next-intl/server';
import { Loader2 } from 'lucide-react';
import { ProductEditEntry } from '@/features/admin/products/product-edit-entry';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('admin.meta');
  return { title: t('editProduct') };
}

export default function AdminEditProductPage() {
  return (
    <Suspense
      fallback={
        <p
          role="status"
          className="text-muted flex items-center gap-2 py-16 text-center text-sm font-bold"
        >
          <Loader2 aria-hidden="true" className="size-4 animate-spin" />
          جارٍ التحميل…
        </p>
      }
    >
      <ProductEditEntry />
    </Suspense>
  );
}
