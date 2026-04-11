'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { getSupabaseBrowser } from '@/lib/supabase/client';
import { buildGalleryQuery, type GalleryCardRow } from '@/lib/supabase/queries';
import type { FilterState } from '@/lib/filters';

const PAGE_SIZE = 60;

export function useInfiniteObjects(initialData: GalleryCardRow[], initialCount: number, filters: FilterState) {
  const [objects, setObjects] = useState<GalleryCardRow[]>(initialData);
  const [total, setTotal] = useState(initialCount);
  const [loading, setLoading] = useState(false);
  const offsetRef = useRef(initialData.length);

  // Reset when server data changes (filter navigation)
  useEffect(() => {
    setObjects(initialData);
    setTotal(initialCount);
    offsetRef.current = initialData.length;
  }, [initialData, initialCount]);

  const loadMore = useCallback(async () => {
    if (loading || offsetRef.current >= total) return;
    setLoading(true);
    try {
      const supabase = getSupabaseBrowser();
      const { data, count } = await buildGalleryQuery(supabase, filters, PAGE_SIZE, offsetRef.current);
      if (data) {
        setObjects(prev => {
          const existingIds = new Set(prev.map(o => o.id));
          const newItems = (data as GalleryCardRow[]).filter(o => !existingIds.has(o.id));
          return [...prev, ...newItems];
        });
        offsetRef.current += data.length;
      }
      if (count != null) setTotal(count);
    } finally {
      setLoading(false);
    }
  }, [filters, total, loading]);

  const hasMore = offsetRef.current < total;

  return { objects, total, loading, loadMore, hasMore };
}
