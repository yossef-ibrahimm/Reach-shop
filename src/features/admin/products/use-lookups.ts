'use client';

import { useCallback, useEffect, useState } from 'react';
import { supabaseBrowser } from '@/lib/supabase/browser';
import type { BrandRow, CategoryRow, SeriesRow, SpecDefinitionRow } from './types';

export type Lookups = {
  categories: CategoryRow[];
  brands: BrandRow[];
  series: SeriesRow[];
  specs: SpecDefinitionRow[];
};

type LookupsState =
  { status: 'loading' } | { status: 'error' } | { status: 'ready'; lookups: Lookups };

/**
 * Lookup tables for the admin forms and filters (categories, brands, series,
 * spec definitions). Readable by anyone per RLS; fetched once per mount.
 */
export function useLookups(): { state: LookupsState; reload: () => void } {
  const [state, setState] = useState<LookupsState>({ status: 'loading' });

  const load = useCallback(async () => {
    const supabase = supabaseBrowser();
    const [categories, brands, series, specs] = await Promise.all([
      supabase.from('categories').select('*').order('sort_order'),
      supabase.from('brands').select('*').order('sort_order'),
      supabase.from('series').select('*').order('name_ar'),
      supabase.from('spec_definitions').select('*').order('category_id').order('sort_order'),
    ]);

    if (
      categories.error ||
      brands.error ||
      series.error ||
      specs.error ||
      !categories.data ||
      !brands.data ||
      !series.data ||
      !specs.data
    ) {
      setState({ status: 'error' });
      return;
    }

    setState({
      status: 'ready',
      lookups: {
        categories: categories.data,
        brands: brands.data,
        series: series.data,
        specs: specs.data,
      },
    });
  }, []);

  useEffect(() => {
    async function initialLoad() {
      await load();
    }
    void initialLoad();
  }, [load]);

  return { state, reload: load };
}
