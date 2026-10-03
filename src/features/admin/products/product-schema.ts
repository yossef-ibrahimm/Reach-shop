import { z } from 'zod';
import type { Json } from '@/lib/supabase/database.types';
import type { SpecDefinitionRow } from './types';

/** Slug rules (PROJECT_SPEC §7): lowercase latin letters, digits and hyphens. */
export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Derives a URL slug from the English name (admin can still edit it). */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
    .replace(/-+$/g, '');
}

/** Arabic validation messages consumed by the schema factory (never scattered in JSX). */
export type ProductSchemaMessages = {
  required: string;
  nameLen: string;
  slugPattern: string;
  specNumber: string;
  specSelect: string;
};

type SelectOption = { value: string };

/** `spec_definitions.options` is stored as `[{ value, label_ar, label_en }]` (see seed.sql). */
export function selectOptionValues(options: Json): string[] {
  if (!Array.isArray(options)) return [];
  const values: string[] = [];
  for (const entry of options) {
    if (entry && typeof entry === 'object' && !Array.isArray(entry)) {
      const value = (entry as SelectOption).value;
      if (typeof value === 'string') values.push(value);
    }
  }
  return values;
}

export type SpecsByCategory = Record<string, SpecDefinitionRow[]>;

/**
 * One stable schema for both add and edit: spec constraints are derived from
 * `spec_definitions` of the *currently selected* category inside `superRefine`,
 * so switching categories never requires rebuilding the resolver.
 */
export function buildProductSchema(
  messages: ProductSchemaMessages,
  specsByCategory: SpecsByCategory,
) {
  return z
    .object({
      name_ar: z.string().trim().min(2, { message: messages.nameLen }),
      name_en: z.string().trim().min(2, { message: messages.nameLen }),
      description_ar: z.string(),
      description_en: z.string(),
      slug: z
        .string()
        .min(1, { message: messages.required })
        .regex(SLUG_PATTERN, { message: messages.slugPattern }),
      category_id: z.string().min(1, { message: messages.required }),
      brand_id: z.string(),
      series_id: z.string(),
      system_type: z.string(),
      search_keywords: z.string(),
      availability: z.enum(['in_stock', 'limited', 'on_request']),
      is_featured: z.boolean(),
      is_published: z.boolean(),
      specs: z.record(z.string(), z.string()),
    })
    .superRefine((value, ctx) => {
      const definitions = specsByCategory[value.category_id] ?? [];
      for (const definition of definitions) {
        const raw = (value.specs[definition.key] ?? '').trim();
        if (raw === '') continue;

        if (definition.value_type === 'number' && !Number.isFinite(Number(raw))) {
          ctx.addIssue({
            code: 'custom',
            path: ['specs', definition.key],
            message: messages.specNumber,
          });
        }
        if (definition.value_type === 'select') {
          const allowed = selectOptionValues(definition.options);
          if (allowed.length > 0 && !allowed.includes(raw)) {
            ctx.addIssue({
              code: 'custom',
              path: ['specs', definition.key],
              message: messages.specSelect,
            });
          }
        }
      }
    });
}

export type ProductSchema = ReturnType<typeof buildProductSchema>;

/** Converts staged spec strings to typed JSON values for the `specs` jsonb column. */
export function specsToJson(
  values: Record<string, string>,
  definitions: SpecDefinitionRow[],
): Record<string, string | number> {
  const specs: Record<string, string | number> = {};
  for (const definition of definitions) {
    const raw = (values[definition.key] ?? '').trim();
    if (raw === '') continue;
    specs[definition.key] = definition.value_type === 'number' ? Number(raw) : raw;
  }
  return specs;
}

/** Populates the form's string-valued spec fields from the stored jsonb object. */
export function specsToFormValues(
  specs: Json,
  definitions: SpecDefinitionRow[],
): Record<string, string> {
  const source =
    specs && typeof specs === 'object' && !Array.isArray(specs)
      ? (specs as Record<string, unknown>)
      : {};

  const values: Record<string, string> = {};
  for (const definition of definitions) {
    const stored = source[definition.key];
    values[definition.key] = stored === undefined || stored === null ? '' : String(stored).trim();
  }
  return values;
}
