'use client';

import { useState } from 'react';
import { Award } from 'lucide-react';
import { Lightbox, type LightboxImage } from '@/components/ui/lightbox';
import type { CertificateData } from '@/lib/products/types';

type Props = {
  certificates: CertificateData[];
  locale: string;
};

/** Certificate cards that open a lightbox (PROJECT_SPEC §6.2 / §6.5). */
export function CertificatesGrid({ certificates, locale }: Props) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const images: LightboxImage[] = certificates.map((certificate) => ({
    src: certificate.image_url,
    alt: locale === 'en' ? certificate.title_en : certificate.title_ar,
  }));

  return (
    <>
      <ul className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {certificates.map((certificate, index) => {
          const issuer = locale === 'en' ? certificate.issuer_en : certificate.issuer_ar;
          return (
            <li key={certificate.id}>
              <button
                type="button"
                onClick={() => setOpenIndex(index)}
                className="border-border bg-surface hover:border-fire-600/40 group flex w-full flex-col overflow-hidden rounded-md border text-start shadow-sm transition-all duration-150 hover:-translate-y-0.5 hover:shadow-md"
              >
                <span className="flex aspect-[4/3] items-center justify-center bg-white p-4">
                  {/* eslint-disable-next-line @next/next/no-img-element -- static export, unoptimized remote storage URLs */}
                  <img
                    src={certificate.image_url}
                    alt={locale === 'en' ? certificate.title_en : certificate.title_ar}
                    loading="lazy"
                    width={640}
                    height={480}
                    className="max-h-full max-w-full object-contain"
                  />
                </span>
                <span className="border-border flex flex-col gap-1 border-t p-4">
                  <span className="flex items-center gap-2 font-semibold">
                    <Award aria-hidden="true" className="text-fire-600 h-4 w-4 shrink-0" />
                    {locale === 'en' ? certificate.title_en : certificate.title_ar}
                  </span>
                  {issuer && <span className="text-muted text-sm">{issuer}</span>}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      <Lightbox
        images={images}
        index={openIndex}
        onClose={() => setOpenIndex(null)}
        onIndexChange={setOpenIndex}
      />
    </>
  );
}
