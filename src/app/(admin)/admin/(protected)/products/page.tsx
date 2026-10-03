import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { ProductsList } from '@/features/admin/products/products-list';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('admin.meta');
  return { title: t('products') };
}

export default function AdminProductsPage() {
  return <ProductsList />;
}
