'use client';

import { FaWhatsapp } from 'react-icons/fa6';

type Props = {
  href: string;
  label: string;
};

/** Floating WhatsApp button on every page (PROJECT_SPEC §6.1). */
export function FloatingWhatsApp({ href, label }: Props) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={label}
      className="bg-whatsapp hover:bg-navy-950 fixed end-6 bottom-[calc(1.5rem+env(safe-area-inset-bottom))] z-30 flex h-14 w-14 items-center justify-center rounded-full text-white shadow-lg transition-transform duration-150 hover:scale-105"
    >
      <FaWhatsapp aria-hidden="true" className="h-7 w-7" />
    </a>
  );
}
