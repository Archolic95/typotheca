'use client';

import { useState, useCallback, useRef } from 'react';
import { getSupabaseBrowser } from '@/lib/supabase/client';

export interface ColorwaySibling {
  id: string;
  name: string;
  color_name: string;
  color_slug: string;
  image_url: string | null;
}

type Cache = Record<string, ColorwaySibling[]>;

/**
 * Hook to fetch and cache sibling colorways for a model_group.
 * Returns a lookup function that fetches on first call, then caches.
 */
export function useColorways() {
  const cache = useRef<Cache>({});
  const pending = useRef<{ [k: string]: Promise<ColorwaySibling[]> | undefined }>({});
  const [, setTick] = useState(0); // Force re-render when cache updates

  const getSiblings = useCallback(async (modelGroup: string): Promise<ColorwaySibling[]> => {
    if (cache.current[modelGroup]) return cache.current[modelGroup];
    const inflight = pending.current[modelGroup];
    if (inflight) return await inflight;

    const promise = (async () => {
      const supabase = getSupabaseBrowser();
      const { data } = await supabase
        .from('objects')
        .select('id, name, image_urls, structured_data')
        .eq('brand', 'arcteryx')
        .not('structured_data', 'is', null)
        .filter('structured_data->>model_group', 'eq', modelGroup)
        .order('name', { ascending: true })
        .limit(50);

      if (!data) return [];

      const siblings: ColorwaySibling[] = data.map((d: any) => ({
        id: d.id,
        name: d.name,
        color_name: d.structured_data?.color_name || 'Unknown',
        color_slug: d.structured_data?.color_slug || '',
        image_url: d.image_urls?.[0] || null,
      }));

      cache.current[modelGroup] = siblings;
      delete pending.current[modelGroup];
      setTick(t => t + 1);
      return siblings;
    })();

    pending.current[modelGroup] = promise;
    return promise;
  }, []);

  const getCached = useCallback((modelGroup: string): ColorwaySibling[] | undefined => {
    return cache.current[modelGroup];
  }, []);

  return { getSiblings, getCached };
}
