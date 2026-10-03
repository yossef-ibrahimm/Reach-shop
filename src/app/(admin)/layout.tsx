import type { Metadata } from 'next';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import { fontVariables } from '@/lib/fonts';
import { ToastProvider } from '@/features/admin/ui/toast';
import '@/app/globals.css';

/**
 * Admin root layout (PROJECT_SPEC §7): Arabic RTL UI, noindex.
 * Security is Supabase RLS — hiding the route is not security.
 */
export const metadata: Metadata = {
  title: { default: 'الإدارة', template: '%s · الإدارة' },
  robots: { index: false, follow: false },
};

export default async function AdminRootLayout({ children }: { children: React.ReactNode }) {
  const messages = await getMessages();

  return (
    <html lang="ar" dir="rtl" className={fontVariables}>
      <body className="bg-paper min-h-screen">
        <NextIntlClientProvider messages={messages}>
          <ToastProvider>{children}</ToastProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
