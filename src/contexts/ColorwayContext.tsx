'use client';

import { createContext, useContext, useMemo, useCallback, useRef, useState, useEffect } from 'react';
import { getSupabaseBrowser } from '@/lib/supabase/client';
import type { GalleryCardRow } from '@/lib/supabase/queries';
import { getObjectImageUrl } from '@/lib/r2';

export interface ColorwaySibling {
  id: string;
  name: string;
  color_name: string;
  color_slug: string;
  image_url: string | null;
}

interface ColorwayContextValue {
  /** Get siblings for a model_group (from cache, populated by background fetches) */
  getLocalSiblings: (modelGroup: string) => ColorwaySibling[];
  /** Fetch ALL siblings for a model_group from the database (for modal view) */
  fetchAllSiblings: (modelGroup: string) => Promise<ColorwaySibling[]>;
  /** Check if an item ID has colorway data loaded */
  hasColorwayData: (id: string) => boolean;
  /** Get the model_group for an item ID */
  getModelGroup: (id: string) => string | null;
}

const ColorwayContext = createContext<ColorwayContextValue>({
  getLocalSiblings: () => [],
  fetchAllSiblings: async () => [],
  hasColorwayData: () => false,
  getModelGroup: () => null,
});

export function useColorwayContext() {
  return useContext(ColorwayContext);
}

/**
 * ColorwayProvider loads colorway data (model_group, color) for visible arcteryx items
 * in a separate lightweight query, keeping the main gallery query fast.
 *
 * Two-phase loading:
 * Phase 1: Fetch model_group metadata for visible arcteryx items (by ID)
 * Phase 2: For each discovered model_group, fetch ALL siblings from DB
 */
export function ColorwayProvider({
  objects,
  children,
}: {
  objects: GalleryCardRow[];
  children: React.ReactNode;
}) {
  // model_group → full sibling list (from DB)
  const groupCache = useRef<Record<string, ColorwaySibling[]>>({});
  // Set of model_groups currently being fetched
  const pendingGroups = useRef<Set<string>>(new Set());
  // IDs we've already resolved to a model_group (or confirmed no colorway)
  const resolvedIdsRef = useRef<Set<string>>(new Set());
  // item ID → model_group
  const [idGroupMap, setIdGroupMap] = useState<Record<string, string>>({});
  // Bump to trigger re-renders when groupCache updates
  const [tick, setTick] = useState(0);

  // Extract arcteryx IDs that need model_group resolution
  const unresolvedIds = useMemo(() => {
    return objects
      .filter(o => o.brand === 'arcteryx')
      .map(o => o.id)
      .filter(id => !resolvedIdsRef.current.has(id));
  }, [objects]);

  // Phase 1 + 2: Resolve model_groups then fetch full sibling lists
  useEffect(() => {
    if (unresolvedIds.length === 0) return;

    const run = async () => {
      const supabase = getSupabaseBrowser();

      // Phase 1: Get model_group for visible items
      const { data } = await supabase
        .from('objects')
        .select(`
          id,
          sd_mg:structured_data->model_group
        `)
        .in('id', unresolvedIds.slice(0, 500));

      if (!data) return;

      const newIdGroups: Record<string, string> = {};
      const discoveredGroups = new Set<string>();

      for (const d of data as any[]) {
        resolvedIdsRef.current.add(d.id);
        if (d.sd_mg) {
          newIdGroups[d.id] = d.sd_mg;
          discoveredGroups.add(d.sd_mg);
        }
      }
      // Mark all queried IDs as resolved (including those without colorway data)
      for (const id of unresolvedIds.slice(0, 500)) {
        resolvedIdsRef.current.add(id);
      }

      // Update id→group map
      if (Object.keys(newIdGroups).length > 0) {
        setIdGroupMap(prev => ({ ...prev, ...newIdGroups }));
      }

      // Phase 2: Fetch full sibling lists for new model_groups
      const groupsToFetch = [...discoveredGroups].filter(
        mg => !groupCache.current[mg] && !pendingGroups.current.has(mg)
      );

      if (groupsToFetch.length === 0) return;

      // Mark as pending
      for (const mg of groupsToFetch) {
        pendingGroups.current.add(mg);
      }

      // Batch fetch siblings in small concurrent batches
      const BATCH = 6;
      for (let i = 0; i < groupsToFetch.length; i += BATCH) {
        const batch = groupsToFetch.slice(i, i + BATCH);
        const results = await Promise.all(
          batch.map(async (mg) => {
            const { data: siblings } = await supabase
              .from('objects')
              .select(`
                id, name, image_urls,
                sd_mg:structured_data->model_group,
                sd_cn:structured_data->color_name,
                sd_cs:structured_data->color_slug
              `)
              .eq('brand', 'arcteryx')
              .not('structured_data', 'is', null)
              .filter('structured_data->>model_group', 'eq', mg)
              .order('name', { ascending: true })
              .limit(60);
            return { mg, siblings };
          })
        );

        // Process results
        const extraIdGroups: Record<string, string> = {};
        for (const { mg, siblings } of results) {
          pendingGroups.current.delete(mg);
          if (!siblings) continue;

          const parsed: ColorwaySibling[] = (siblings as any[])
            .filter(d => d.sd_mg)
            .map(d => ({
              id: d.id,
              name: d.name,
              color_name: d.sd_cn || 'Unknown',
              color_slug: d.sd_cs || '',
              image_url: getObjectImageUrl(d.image_urls),
            }));

          groupCache.current[mg] = parsed;

          // Also register any sibling IDs we haven't seen
          for (const s of parsed) {
            if (!resolvedIdsRef.current.has(s.id)) {
              resolvedIdsRef.current.add(s.id);
              extraIdGroups[s.id] = mg;
            }
          }
        }

        if (Object.keys(extraIdGroups).length > 0) {
          setIdGroupMap(prev => ({ ...prev, ...extraIdGroups }));
        }
      }

      // Trigger re-render so getLocalSiblings returns fresh data
      setTick(t => t + 1);
    };

    run();
  }, [unresolvedIds]);

  const getLocalSiblings = useCallback(
    (modelGroup: string): ColorwaySibling[] => groupCache.current[modelGroup] || [],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tick],
  );

  const fetchAllSiblings = useCallback(
    async (modelGroup: string): Promise<ColorwaySibling[]> => {
      // Return from cache if available
      if (groupCache.current[modelGroup]) return groupCache.current[modelGroup];

      const supabase = getSupabaseBrowser();
      const { data } = await supabase
        .from('objects')
        .select(`
          id, name, image_urls,
          sd_mg:structured_data->model_group,
          sd_cn:structured_data->color_name,
          sd_cs:structured_data->color_slug
        `)
        .eq('brand', 'arcteryx')
        .not('structured_data', 'is', null)
        .filter('structured_data->>model_group', 'eq', modelGroup)
        .order('name', { ascending: true })
        .limit(60);

      if (!data) return [];

      const siblings: ColorwaySibling[] = (data as any[])
        .filter(d => d.sd_mg)
        .map(d => ({
          id: d.id,
          name: d.name,
          color_name: d.sd_cn || 'Unknown',
          color_slug: d.sd_cs || '',
          image_url: getObjectImageUrl(d.image_urls),
        }));

      groupCache.current[modelGroup] = siblings;
      setTick(t => t + 1);
      return siblings;
    },
    [],
  );

  const hasColorwayData = useCallback(
    (id: string): boolean => !!idGroupMap[id],
    [idGroupMap],
  );

  const getModelGroup = useCallback(
    (id: string): string | null => idGroupMap[id] || null,
    [idGroupMap],
  );

  const value = useMemo(
    () => ({ getLocalSiblings, fetchAllSiblings, hasColorwayData, getModelGroup }),
    [getLocalSiblings, fetchAllSiblings, hasColorwayData, getModelGroup],
  );

  return <ColorwayContext.Provider value={value}>{children}</ColorwayContext.Provider>;
}
