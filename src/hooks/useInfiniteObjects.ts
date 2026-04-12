'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { getSupabaseBrowser } from '@/lib/supabase/client';
import { buildGalleryQuery, type GalleryCardRow } from '@/lib/supabase/queries';
import type { FilterState } from '@/lib/filters';

const PAGE_SIZE = 60;
const GROUPED_PAGE_SIZE = 500;

export function useInfiniteObjects(initialData: GalleryCardRow[], initialCount: number, filters: FilterState) {
  const isGrouped = !!(filters.groups?.length || filters.group);
  const [objects, setObjects] = useState<GalleryCardRow[]>(initialData);
  const [total, setTotal] = useState(initialCount);
  const [loading, setLoading] = useState(false);
  const offsetRef = useRef(initialData.length);
  const loadingRef = useRef(false);

  // Reset when server data changes (filter navigation)
  useEffect(() => {
    setObjects(initialData);
    setTotal(initialCount);
    offsetRef.current = initialData.length;
  }, [initialData, initialCount]);

  const loadMore = useCallback(async () => {
    if (loadingRef.current || offsetRef.current >= total) return;
    loadingRef.current = true;
    setLoading(true);
    try {
      const supabase = getSupabaseBrowser();
      const pageSize = isGrouped ? GROUPED_PAGE_SIZE : PAGE_SIZE;
      const { data, count } = await buildGalleryQuery(supabase, filters, pageSize, offsetRef.current);
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
      loadingRef.current = false;
      setLoading(false);
    }
  }, [filters, total, isGrouped]);

  const hasMore = offsetRef.current < total;

  // When grouped, auto-load ALL data (don't wait for scroll)
  useEffect(() => {
    if (isGrouped && hasMore && !loadingRef.current) {
      loadMore();
    }
  }, [isGrouped, hasMore, objects.length, loadMore]);

  return { objects, total, loading, loadMore, hasMore };
}
