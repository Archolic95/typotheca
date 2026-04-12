'use client';

import { useRef, useEffect, useState, useMemo, Suspense, useCallback } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { ObjectCard, ObjectRow, ObjectCardSkeleton } from './ObjectCard';
import { ObjectDetailModal } from './ObjectDetailModal';
import { FilterBar } from './FilterBar';
import { ViewBar } from '@/components/ui/ViewBar';
import { useViewConfig } from '@/hooks/useViewConfig';
import type { ViewConfig } from '@/lib/views';
import { useInfiniteObjects } from '@/hooks/useInfiniteObjects';
import { searchParamsToFilters, filtersToSearchParams, DEFAULT_GALLERY_BRANDS } from '@/lib/filters';
import type { FilterState } from '@/lib/filters';
import { brandDisplay, seasonSortKey } from '@/lib/utils';
import { Badge } from '@/components/ui/Badge';
import type { GalleryCardRow } from '@/lib/supabase/queries';

interface ObjectGridProps {
  initialData: GalleryCardRow[];
  initialCount: number;
}

/** Convert a ViewConfig into a FilterState for URL */
function viewToFilters(view: ViewConfig): FilterState {
  const f: FilterState = {};
  // Sorts
  if (view.sorts?.length) {
    f.sorts = view.sorts;
  } else if (view.sort && view.sort.col !== 'updated_at') {
    f.sorts = [view.sort];
  }
  // Groups
  if (view.groups?.length) {
    f.groups = view.groups;
  } else if (view.group) {
    f.groups = [view.group];
  }
  // Filters
  if (view.filters?.length) {
    for (const vf of view.filters) {
      if (vf.column === 'brand' && vf.values.length) f.brand = vf.values;
      if (vf.column === 'cat1' && vf.values[0]) f.cat1 = vf.values[0];
      if (vf.column === 'genre' && vf.values.length) f.genre = vf.values;
      if (vf.column === 'rarity' && vf.values.length) f.rarity = vf.values;
      if (vf.column === 'season' && vf.values.length) f.season = vf.values;
      if (vf.column === 'acronym_category' && vf.values[0]) f.acronym_category = vf.values[0];
      if (vf.column === 'acronym_style' && vf.values[0]) f.acronym_style = vf.values[0];
      if (vf.column === 'source_site' && vf.values[0]) f.source_site = vf.values[0];
    }
  }
  return f;
}

/** Convert current FilterState back into ViewConfig partial for saving */
function filtersToViewUpdate(filters: FilterState): Partial<ViewConfig> {
  const update: Partial<ViewConfig> = {};
  // Sorts
  if (filters.sorts?.length) {
    update.sorts = filters.sorts;
    update.sort = filters.sorts[0];
  } else {
    update.sorts = undefined;
    update.sort = { col: 'updated_at', dir: 'desc' };
  }
  // Groups
  if (filters.groups?.length) {
    update.groups = filters.groups;
    update.group = filters.groups[0];
  } else {
    update.groups = undefined;
    update.group = undefined;
  }
  // Filters
  const viewFilters: { column: string; values: string[] }[] = [];
  if (filters.brand?.length) viewFilters.push({ column: 'brand', values: filters.brand });
  if (filters.cat1) viewFilters.push({ column: 'cat1', values: [filters.cat1] });
  if (filters.genre?.length) viewFilters.push({ column: 'genre', values: filters.genre });
  if (filters.rarity?.length) viewFilters.push({ column: 'rarity', values: filters.rarity });
  if (filters.season?.length) viewFilters.push({ column: 'season', values: filters.season });
  if (filters.acronym_category) viewFilters.push({ column: 'acronym_category', values: [filters.acronym_category] });
  if (filters.acronym_style) viewFilters.push({ column: 'acronym_style', values: [filters.acronym_style] });
  if (filters.source_site) viewFilters.push({ column: 'source_site', values: [filters.source_site] });
  update.filters = viewFilters;
  return update;
}

function ObjectGridInner({ initialData, initialCount }: ObjectGridProps) {
  const galleryViewConfig = useViewConfig('gallery');
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const didRestoreRef = useRef(false);

  // ── Restore saved view on mount (when URL has no params) ────────────
  useEffect(() => {
    if (didRestoreRef.current) return;
    didRestoreRef.current = true;

    // Only restore if URL has no filter/sort/group params (fresh navigation)
    const hasParams = searchParams.has('brand') || searchParams.has('sorts') ||
      searchParams.has('groups') || searchParams.has('sort') || searchParams.has('group') ||
      searchParams.has('cat1') || searchParams.has('genre') || searchParams.has('rarity') ||
      searchParams.has('q') || searchParams.has('season');
    if (hasParams) return;

    const view = galleryViewConfig.activeView;
    const hasSavedState = view.sorts?.length || view.groups?.length || view.group ||
      (view.sort && view.sort.col !== 'updated_at') || view.filters?.length;
    if (!hasSavedState) return;

    const viewFilters = viewToFilters(view);
    if (!viewFilters.brand?.length) viewFilters.brand = DEFAULT_GALLERY_BRANDS;

    const params = filtersToSearchParams(viewFilters);
    const qs = params.toString();
    if (qs) router.replace(`${pathname}?${qs}`, { scroll: false });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const filters = useMemo(() => {
    const obj: Record<string, string> = {};
    searchParams.forEach((v, k) => { obj[k] = v; });
    const f = searchParamsToFilters(obj);
    const hasBrandParam = searchParams.has('brand');
    if (!hasBrandParam && !f.brand?.length && !f.q) {
      f.brand = DEFAULT_GALLERY_BRANDS;
    }
    return f;
  }, [searchParams]);

  // ── Save filters back to active view config on change ───────────────
  const prevFiltersRef = useRef<string>('');
  useEffect(() => {
    const key = JSON.stringify({
      sorts: filters.sorts, groups: filters.groups,
      brand: filters.brand, cat1: filters.cat1, genre: filters.genre,
      rarity: filters.rarity, season: filters.season,
    });
    if (key === prevFiltersRef.current) return;
    prevFiltersRef.current = key;

    // Don't save on very first render (before restore completes)
    if (!didRestoreRef.current) return;

    const update = filtersToViewUpdate(filters);
    galleryViewConfig.updateView(update);
  }, [filters]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Switch view → apply its config to URL ───────────────────────────
  const handleSwitchView = useCallback((viewId: string) => {
    galleryViewConfig.switchView(viewId);
    const view = galleryViewConfig.views.find(v => v.id === viewId);
    if (!view) return;

    const viewFilters = viewToFilters(view);
    if (!viewFilters.brand?.length) viewFilters.brand = DEFAULT_GALLERY_BRANDS;

    const params = filtersToSearchParams(viewFilters);
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [galleryViewConfig, router, pathname]);

  const { objects: rawObjects, total, loading, loadMore, hasMore } = useInfiniteObjects(initialData, initialCount, filters);

  // Client-side re-sort for season (server sorts alphabetically, we need chronological)
  const objects = useMemo(() => {
    const sorts = filters.sorts || [];
    const seasonSort = sorts.find(s => s.col === 'season');
    if (!seasonSort) return rawObjects;
    const ascending = seasonSort.dir === 'asc';
    return [...rawObjects].sort((a, b) => {
      const diff = seasonSortKey(a.season) - seasonSortKey(b.season);
      return ascending ? diff : -diff;
    });
  }, [rawObjects, filters.sorts]);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const sentinelRef = useRef<HTMLDivElement>(null);
  const viewMode = filters.view || 'grid';
  const groups = filters.groups || [];
  const primaryGroup = groups[0]; // first group level used for top-level sections

  const toggleGroup = (key: string) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  // Build grouped sections from flat objects list (using first group level)
  const grouped = useMemo(() => {
    if (!primaryGroup) return null;
    const sections: { key: string; label: string; items: GalleryCardRow[] }[] = [];
    const sectionMap = new Map<string, GalleryCardRow[]>();
    for (const obj of objects) {
      const raw = obj[primaryGroup as keyof GalleryCardRow];
      const keys = Array.isArray(raw) ? (raw.length > 0 ? raw as string[] : ['(none)']) : [String(raw || '(none)')];
      for (const k of keys) {
        const existing = sectionMap.get(k);
        if (existing) existing.push(obj);
        else sectionMap.set(k, [obj]);
      }
    }
    for (const [key, items] of sectionMap) {
      const label = primaryGroup === 'brand' ? brandDisplay(key) : key === '(none)' ? 'Uncategorized' : key;
      sections.push({ key, label, items });
    }
    // Sort sections: chronologically for season, alphabetically for others
    if (primaryGroup === 'season') {
      sections.sort((a, b) => seasonSortKey(b.key) - seasonSortKey(a.key));
    } else {
      sections.sort((a, b) => a.label.localeCompare(b.label));
    }
    return sections;
  }, [objects, primaryGroup]);

  // Infinite scroll observer
  useEffect(() => {
    if (!sentinelRef.current || !hasMore) return;
    const observer = new IntersectionObserver(
      (entries) => { if (entries[0].isIntersecting) loadMore(); },
      { rootMargin: '600px' },
    );
    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [hasMore, loadMore]);

  const gridClasses = "grid grid-cols-2 xs:grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 2xl:grid-cols-10 3xl:grid-cols-12 gap-2 sm:gap-3";

  const renderGroupLabel = (groupKey: string, key: string, label: string, count: number) => {
    if (groupKey === 'notion_rarity') return <><Badge rarity={label}>{label}</Badge> <span className="text-xs text-neutral-500 ml-2">{count}</span></>;
    return <><span className="text-sm font-medium text-white">{label}</span> <span className="text-xs text-neutral-500 ml-2">{count}</span></>;
  };

  return (
    <>
      <ViewBar
        views={galleryViewConfig.views}
        activeViewId={galleryViewConfig.activeViewId}
        onSwitchView={handleSwitchView}
        onCreateView={galleryViewConfig.createView}
        onRenameView={galleryViewConfig.renameView}
      />
      <FilterBar />

      <div className="flex items-center justify-between mt-4 mb-3">
        <p className="text-xs text-neutral-500">
          {total.toLocaleString()} objects
          {primaryGroup && hasMore && (
            <span className="ml-2 text-neutral-600">
              Loading {objects.length}/{total}...
            </span>
          )}
        </p>
      </div>

      {grouped ? (
        // Grouped view
        <div className="space-y-6">
          {grouped.map(({ key, label, items }) => {
            const isCollapsed = collapsedGroups.has(key);
            return (
              <div key={key}>
                <button
                  onClick={() => toggleGroup(key)}
                  className="flex items-center gap-2 mb-3 pb-2 border-b border-neutral-800 w-full text-left cursor-pointer hover:bg-neutral-900/30 -mx-1 px-1 rounded transition-colors"
                >
                  <svg
                    width="8" height="8" viewBox="0 0 8 8"
                    className={`text-neutral-500 transition-transform duration-150 ${isCollapsed ? '-rotate-90' : ''}`}
                  >
                    <path d="M1 2l3 3.5L7 2" fill="currentColor" />
                  </svg>
                  {renderGroupLabel(primaryGroup!, key, label, items.length)}
                </button>
                {viewMode === 'grid' ? (
                  <div className={`${gridClasses} ${isCollapsed ? 'hidden' : ''}`}>
                    {items.map((obj, i) => (
                      <ObjectCard key={obj.id} object={obj} onClick={() => setSelectedId(obj.id)} priority={i < 4} />
                    ))}
                  </div>
                ) : (
                  <div className={`border border-neutral-800 rounded-lg overflow-hidden ${isCollapsed ? 'hidden' : ''}`}>
                    {items.map((obj) => (
                      <ObjectRow key={obj.id} object={obj} onClick={() => setSelectedId(obj.id)} />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
          {/* Skeleton loading section while grouped data is still loading */}
          {hasMore && (
            <div>
              <div className="flex items-center gap-2 mb-3 pb-2 border-b border-neutral-800">
                <div className="w-16 h-3 bg-neutral-800 rounded animate-pulse" />
              </div>
              <div className={gridClasses}>
                {Array.from({ length: 12 }).map((_, i) => (
                  <ObjectCardSkeleton key={`skel-${i}`} />
                ))}
              </div>
            </div>
          )}
        </div>
      ) : viewMode === 'grid' ? (
        <div className={gridClasses}>
          {objects.map((obj, i) => (
            <ObjectCard key={obj.id} object={obj} onClick={() => setSelectedId(obj.id)} priority={i < 10} />
          ))}
        </div>
      ) : (
        <div className="border border-neutral-800 rounded-lg overflow-hidden">
          {objects.map((obj) => (
            <ObjectRow key={obj.id} object={obj} onClick={() => setSelectedId(obj.id)} />
          ))}
        </div>
      )}

      {/* Infinite scroll sentinel */}
      <div ref={sentinelRef} className="h-16 flex items-center justify-center">
        {loading && (
          <div className="flex gap-1">
            <div className="w-1.5 h-1.5 rounded-full bg-neutral-600 animate-pulse" />
            <div className="w-1.5 h-1.5 rounded-full bg-neutral-600 animate-pulse [animation-delay:150ms]" />
            <div className="w-1.5 h-1.5 rounded-full bg-neutral-600 animate-pulse [animation-delay:300ms]" />
          </div>
        )}
      </div>

      {selectedId && (
        <ObjectDetailModal
          objectId={selectedId}
          onClose={() => setSelectedId(null)}
          onDeleted={() => {
            setSelectedId(null);
            window.location.reload();
          }}
        />
      )}
    </>
  );
}

export function ObjectGrid(props: ObjectGridProps) {
  return (
    <Suspense fallback={<div className="text-neutral-500 text-sm">Loading...</div>}>
      <ObjectGridInner {...props} />
    </Suspense>
  );
}
