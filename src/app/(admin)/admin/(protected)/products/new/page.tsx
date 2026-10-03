import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { ProductForm } from '@/features/admin/products/product-form';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('admin.meta');
  return { title: t('newProduct') };
}

export default function AdminNewProductPage() {
  return <ProductForm mode="new" />;
}
