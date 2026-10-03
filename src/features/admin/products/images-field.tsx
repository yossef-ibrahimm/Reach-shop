'use client';

import { useEffect, useRef, useState } from 'react';
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  rectSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, ImagePlus, Loader2, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/cn';
import { useToast } from '@/features/admin/ui/toast';
import { ImageProcessError, compressToWebp } from '@/features/admin/media/image-compress';
import type { ImageItem } from './types';

type Props = {
  images: ImageItem[];
  onChange: (next: ImageItem[]) => void;
  disabled?: boolean;
};

/**
 * Image slots (PROJECT_SPEC §7): multi-select → client-side WebP compression
 * (full + thumbnail) → staged as Blobs until Save. Drag handle reorders
 * (first tile = cover); alt text is edited per tile in both languages.
 */
export function ImagesField({ images, onChange, disabled = false }: Props) {
  const t = useTranslations('admin.form');
  const toast = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [processing, setProcessing] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  // Revoke staged preview URLs only when the whole form unmounts (removals
  // revoke immediately in their handler).
  const imagesRef = useRef(images);
  useEffect(() => {
    imagesRef.current = images;
  }, [images]);
  useEffect(
    () => () => {
      for (const item of imagesRef.current) {
        if (item.kind === 'new') URL.revokeObjectURL(item.previewUrl);
      }
    },
    [],
  );

  const handleFiles = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    setProcessing(true);
    const added: ImageItem[] = [];

    for (const file of Array.from(fileList)) {
      try {
        const { blob, thumbBlob } = await compressToWebp(file);
        added.push({
          key: `new-${crypto.randomUUID()}`,
          kind: 'new',
          blob,
          thumbBlob,
          previewUrl: URL.createObjectURL(blob),
          alt_ar: '',
          alt_en: '',
        });
      } catch (error) {
        const code = error instanceof ImageProcessError ? error.code : 'decode';
        const messageKey =
          code === 'type'
            ? 'errors.imageType'
            : code === 'size'
              ? 'errors.imageTooBig'
              : code === 'webp'
                ? 'errors.webpUnsupported'
                : 'errors.imageDecode';
        toast(t(messageKey), 'error');
      }
    }

    if (added.length > 0) onChange([...images, ...added]);
    setProcessing(false);
    if (inputRef.current) inputRef.current.value = '';
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = images.findIndex((item) => item.key === active.id);
    const newIndex = images.findIndex((item) => item.key === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    onChange(arrayMove(images, oldIndex, newIndex));
  };

  const updateItem = (key: string, patch: Partial<ImageItem>) => {
    onChange(
      images.map((item) => (item.key === key ? ({ ...item, ...patch } as ImageItem) : item)),
    );
  };

  const removeItem = (key: string) => {
    const target = images.find((item) => item.key === key);
    if (target?.kind === 'new') URL.revokeObjectURL(target.previewUrl);
    onChange(images.filter((item) => item.key !== key));
  };

  return (
    <div className="flex flex-col gap-3">
      <p className="text-muted text-xs font-bold">{t('fields.imagesHint')}</p>

      <div>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          className="sr-only"
          disabled={disabled || processing}
          onChange={(event) => void handleFiles(event.target.files)}
        />
        <button
          type="button"
          disabled={disabled || processing}
          onClick={() => inputRef.current?.click()}
          className="border-border bg-surface hover:bg-surface-alt inline-flex items-center gap-2 rounded-md border px-4 py-2 text-sm font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-60"
        >
          {processing ? (
            <Loader2 aria-hidden="true" className="size-4 animate-spin" />
          ) : (
            <ImagePlus aria-hidden="true" className="size-4" />
          )}
          {t('fields.imagesAdd')}
        </button>
      </div>

      {images.length === 0 ? (
        <p className="text-muted rounded-md border border-dashed p-4 text-center text-sm font-bold">
          {t('fields.imagesEmpty')}
        </p>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={images.map((item) => item.key)} strategy={rectSortingStrategy}>
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {images.map((item, index) => (
                <ImageCard
                  key={item.key}
                  item={item}
                  index={index}
                  disabled={disabled}
                  onPatch={(patch) => updateItem(item.key, patch)}
                  onRemove={() => removeItem(item.key)}
                />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
      )}
    </div>
  );
}

type CardProps = {
  item: ImageItem;
  index: number;
  disabled: boolean;
  onPatch: (patch: Partial<ImageItem>) => void;
  onRemove: () => void;
};

function ImageCard({ item, index, disabled, onPatch, onRemove }: CardProps) {
  const t = useTranslations('admin.form');
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.key,
    disabled,
  });

  const preview = item.kind === 'new' ? item.previewUrl : (item.thumb_url ?? item.url);

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        'border-border bg-surface flex flex-col gap-2 border p-2 shadow-sm',
        isDragging && 'z-10 opacity-70',
      )}
    >
      <div className="bg-surface-alt relative aspect-square overflow-hidden rounded-sm">
        {/* eslint-disable-next-line @next/next/no-img-element -- storage URLs, static export has no optimizer */}
        <img src={preview} alt="" loading="lazy" className="h-full w-full object-cover" />
        {index === 0 && (
          <span className="bg-navy-950/85 absolute start-1 bottom-1 rounded px-1.5 py-0.5 text-[10px] font-bold text-white">
            {t('fields.imagesCover')}
          </span>
        )}
        <button
          type="button"
          onClick={onRemove}
          disabled={disabled}
          aria-label={t('fields.removeImage')}
          className="bg-surface border-border text-fire-700 hover:bg-fire-50 absolute end-1 top-1 rounded-md border p-1 transition-colors disabled:opacity-60"
        >
          <X aria-hidden="true" className="size-3.5" />
        </button>
        <button
          type="button"
          disabled={disabled}
          aria-label={t('fields.dragHandle')}
          className="bg-surface border-border absolute start-1 top-1 cursor-grab touch-none rounded-md border p-1 active:cursor-grabbing"
          {...attributes}
          {...listeners}
        >
          <GripVertical aria-hidden="true" className="size-3.5" />
        </button>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="flex flex-col gap-0.5 text-[11px] font-bold">
          {t('fields.altAr')}
          <input
            type="text"
            value={item.alt_ar}
            disabled={disabled}
            onChange={(event) => onPatch({ alt_ar: event.target.value })}
            className="border-border focus:border-navy-700 w-full rounded-sm border px-2 py-1 text-xs font-normal outline-none"
          />
        </label>
        <label className="flex flex-col gap-0.5 text-[11px] font-bold">
          {t('fields.altEn')}
          <input
            type="text"
            dir="ltr"
            value={item.alt_en}
            disabled={disabled}
            onChange={(event) => onPatch({ alt_en: event.target.value })}
            className="border-border focus:border-navy-700 w-full rounded-sm border px-2 py-1 text-xs font-normal outline-none"
          />
        </label>
      </div>
    </li>
  );
}
