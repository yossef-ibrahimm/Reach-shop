/**
 * Client-side image pipeline (PROJECT_SPEC §7): every selected image is
 * decoded, scaled and re-encoded to WebP — one full-size copy (≤1600px edge)
 * plus one thumbnail (≤480px edge) — before it is ever staged for upload.
 * The bucket only accepts `image/webp` ≤5MB (migration 0004), so validation
 * happens here with Arabic error codes the UI translates.
 */

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const MAX_PDF_BYTES = 10 * 1024 * 1024;
export const MAX_EDGE_PX = 1600;
export const THUMB_EDGE_PX = 480;
const WEBP_QUALITY = 0.82;

export type ImageErrorCode = 'type' | 'size' | 'decode' | 'webp';

export class ImageProcessError extends Error {
  readonly code: ImageErrorCode;

  constructor(code: ImageErrorCode) {
    super(code);
    this.name = 'ImageProcessError';
    this.code = code;
  }
}

export type CompressedImage = { blob: Blob; thumbBlob: Blob };

type Decodable = ImageBitmap | HTMLImageElement;

async function decode(file: File): Promise<Decodable> {
  try {
    return await createImageBitmap(file);
  } catch {
    // Fallback for browsers without createImageBitmap.
    try {
      const url = URL.createObjectURL(file);
      try {
        const image = new Image();
        image.decoding = 'async';
        await new Promise<void>((resolve, reject) => {
          image.onload = () => resolve();
          image.onerror = () => reject(new Error('decode failed'));
          image.src = url;
        });
        return image;
      } finally {
        URL.revokeObjectURL(url);
      }
    } catch {
      throw new ImageProcessError('decode');
    }
  }
}

function sourceSize(source: Decodable): { width: number; height: number } {
  if (source instanceof HTMLImageElement) {
    return { width: source.naturalWidth, height: source.naturalHeight };
  }
  return { width: source.width, height: source.height };
}

async function encodeScaled(source: Decodable, maxEdge: number): Promise<Blob> {
  const { width, height } = sourceSize(source);
  if (width === 0 || height === 0) throw new ImageProcessError('decode');

  const scale = Math.min(1, maxEdge / Math.max(width, height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));

  const context = canvas.getContext('2d');
  if (!context) throw new ImageProcessError('decode');
  context.drawImage(source, 0, 0, canvas.width, canvas.height);

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/webp', WEBP_QUALITY),
  );
  if (!blob) throw new ImageProcessError('decode');
  if (blob.type !== 'image/webp') throw new ImageProcessError('webp');
  if (blob.size > MAX_IMAGE_BYTES) throw new ImageProcessError('size');
  return blob;
}

/** Validates + compresses one picked file. Throws `ImageProcessError` with a stable code. */
export async function compressToWebp(file: File): Promise<CompressedImage> {
  if (!file.type.startsWith('image/')) throw new ImageProcessError('type');
  if (file.size > MAX_IMAGE_BYTES) throw new ImageProcessError('size');

  const source = await decode(file);
  try {
    const [blob, thumbBlob] = await Promise.all([
      encodeScaled(source, MAX_EDGE_PX),
      encodeScaled(source, THUMB_EDGE_PX),
    ]);
    return { blob, thumbBlob };
  } finally {
    if (source instanceof ImageBitmap) source.close();
  }
}

export type PdfErrorCode = 'type' | 'size';

export class PdfValidationError extends Error {
  readonly code: PdfErrorCode;

  constructor(code: PdfErrorCode) {
    super(code);
    this.name = 'PdfValidationError';
    this.code = code;
  }
}

/** Catalog uploads accept only PDF ≤10MB (bucket limit, enforced here too). */
export function validatePdf(file: File): void {
  if (file.type !== 'application/pdf') throw new PdfValidationError('type');
  if (file.size > MAX_PDF_BYTES) throw new PdfValidationError('size');
}
