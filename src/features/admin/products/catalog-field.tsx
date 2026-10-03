'use client';

import { useRef } from 'react';
import { FileText, FileX, Replace, Undo2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useToast } from '@/features/admin/ui/toast';
import { PdfValidationError, validatePdf } from '@/features/admin/media/image-compress';
import type { CatalogField } from './types';

type Props = {
  label: string;
  field: CatalogField;
  onChange: (next: CatalogField) => void;
  disabled?: boolean;
};

/**
 * One catalog PDF slot (AR or EN, PROJECT_SPEC §7): optional, ≤10MB, staged
 * client-side — the file only uploads when the form is saved.
 */
export function CatalogField({ label, field, onChange, disabled = false }: Props) {
  const t = useTranslations('admin.form');
  const toast = useToast();
  const inputRef = useRef<HTMLInputElement>(null);

  const pickFile = (fileList: FileList | null) => {
    const file = fileList?.[0];
    if (!file) return;
    try {
      validatePdf(file);
    } catch (error) {
      const key =
        error instanceof PdfValidationError && error.code === 'type'
          ? 'errors.fileNotPdf'
          : 'errors.fileTooBig';
      toast(t(key), 'error');
      if (inputRef.current) inputRef.current.value = '';
      return;
    }
    onChange({ ...field, next: file, removed: false });
    if (inputRef.current) inputRef.current.value = '';
  };

  const pending = field.next !== null;
  const hasCurrent = field.currentUrl !== null && !field.removed;
  const isRemoved = field.removed;

  const button =
    'inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-60';
  const buttonMuted = `${button} border-border bg-surface hover:bg-surface-alt`;

  return (
    <div className="border-border bg-surface flex flex-col gap-2 border p-3">
      <p className="text-sm font-bold">{label}</p>
      <p className="text-muted text-xs font-bold">{t('fields.catalogHint')}</p>

      <input
        ref={inputRef}
        type="file"
        accept="application/pdf"
        className="sr-only"
        disabled={disabled}
        onChange={(event) => pickFile(event.target.files)}
      />

      <div className="flex flex-wrap items-center gap-2 text-xs">
        <FileText aria-hidden="true" className="text-muted size-4 shrink-0" />

        {pending && (
          <>
            <span className="text-text flex-1 truncate font-bold" dir="auto">
              {t('fields.pendingFile', { name: field.next?.name ?? '' })}
            </span>
            <button
              type="button"
              className={buttonMuted}
              disabled={disabled}
              onClick={() => inputRef.current?.click()}
            >
              <Replace aria-hidden="true" className="size-3.5" />
              {t('fields.chooseFile')}
            </button>
            <button
              type="button"
              className={`${buttonMuted} text-fire-700`}
              disabled={disabled}
              onClick={() => onChange({ ...field, next: null })}
            >
              <Undo2 aria-hidden="true" className="size-3.5" />
              {t('fields.cancelPending')}
            </button>
          </>
        )}

        {hasCurrent && (
          <>
            <span className="text-muted flex-1 truncate" dir="auto">
              {t('fields.catalogCurrent', { name: field.currentName ?? '' })}
            </span>
            <button
              type="button"
              className={buttonMuted}
              disabled={disabled}
              onClick={() => inputRef.current?.click()}
            >
              <Replace aria-hidden="true" className="size-3.5" />
              {t('fields.replace')}
            </button>
            <button
              type="button"
              className={`${buttonMuted} text-fire-700`}
              disabled={disabled}
              onClick={() => onChange({ ...field, next: null, removed: true })}
            >
              <FileX aria-hidden="true" className="size-3.5" />
              {t('fields.removeFile')}
            </button>
          </>
        )}

        {isRemoved && (
          <>
            <span className="text-muted flex-1 truncate font-bold">{t('fields.catalogNone')}</span>
            <button
              type="button"
              className={buttonMuted}
              disabled={disabled}
              onClick={() => onChange({ ...field, removed: false })}
            >
              <Undo2 aria-hidden="true" className="size-3.5" />
              {t('fields.revertRemove')}
            </button>
          </>
        )}

        {!pending && !hasCurrent && !isRemoved && (
          <>
            <span className="text-muted flex-1 truncate font-bold">{t('fields.catalogNone')}</span>
            <button
              type="button"
              className={buttonMuted}
              disabled={disabled}
              onClick={() => inputRef.current?.click()}
            >
              <FileText aria-hidden="true" className="size-3.5" />
              {t('fields.chooseFile')}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
