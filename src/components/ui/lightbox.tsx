'use client';

import { useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { cn } from '@/lib/cn';
import { useDialogBehavior } from '@/lib/use-dialog';

export type LightboxImage = { src: string; alt: string };

type Props = {
  images: LightboxImage[];
  index: number | null;
  onClose: () => void;
  onIndexChange: (index: number) => void;
};

/** Fullscreen gallery/lightbox: keyboard navigation + focus trap. */
export function Lightbox({ images, index, onClose, onIndexChange }: Props) {
  const t = useTranslations('product');
  const locale = useLocale();
  const dialogRef = useRef<HTMLDivElement>(null);

  const open = index !== null && index >= 0 && index < images.length;
  const image = open ? images[index] : null;
  const isRtl = locale === 'ar';

  useDialogBehavior(open, dialogRef);

  useEffect(() => {
    if (index === null || !open) return;
    const current = index;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
      if (event.key === 'ArrowLeft' && images.length > 1) {
        const target = isRtl ? current + 1 : current - 1 + images.length;
        onIndexChange(target % images.length);
      }
      if (event.key === 'ArrowRight' && images.length > 1) {
        const target = isRtl ? current - 1 + images.length : current + 1;
        onIndexChange(target % images.length);
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, index, images.length, onClose, onIndexChange, isRtl]);

  if (!open || !image) return null;

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label={t('galleryLabel')}
      tabIndex={-1}
      className="bg-navy-950/92 fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <button
        type="button"
        onClick={onClose}
        aria-label={t('lightboxClose')}
        className="absolute end-4 top-4 z-10 flex h-11 w-11 items-center justify-center rounded-md bg-white/10 text-white transition-colors hover:bg-white/20"
      >
        <X aria-hidden="true" className="h-6 w-6" />
      </button>

      {images.length > 1 && (
        <>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onIndexChange((index - 1 + images.length) % images.length);
            }}
            aria-label={t('lightboxPrev')}
            className="absolute start-3 z-10 flex h-11 w-11 items-center justify-center rounded-md bg-white/10 text-white transition-colors hover:bg-white/20 sm:start-6"
          >
            <ChevronLeft aria-hidden="true" className="h-6 w-6 rtl:rotate-180" />
          </button>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onIndexChange((index + 1) % images.length);
            }}
            aria-label={t('lightboxNext')}
            className="absolute end-3 z-10 flex h-11 w-11 items-center justify-center rounded-md bg-white/10 text-white transition-colors hover:bg-white/20 sm:end-6"
          >
            <ChevronRight aria-hidden="true" className="h-6 w-6 rtl:rotate-180" />
          </button>
        </>
      )}

      {/* eslint-disable-next-line @next/next/no-img-element -- static export, unoptimized remote storage URLs */}
      <img
        src={image.src}
        alt={image.alt}
        onClick={(event) => event.stopPropagation()}
        className={cn('max-h-[85dvh] max-w-[92vw] rounded-lg object-contain shadow-lg')}
      />
    </div>
  );
}
