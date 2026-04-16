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
import { brandDisplay } from '@/lib/utils';
import { Badge } from '@/components/ui/Badge';
import { useHierarchy } from '@/hooks/useHierarchy';
import { optionSortKey } from '@/lib/optionOrder';
import { ColorwayProvider } from '@/contexts/ColorwayContext';
import type { GalleryCardRow } from '@/lib/supabase/queries';

interface ObjectGridProps {
  initialData: GalleryCardRow[];
  initialCount: number;
  readOnly?: boolean;
}

type GroupSection = { key: string; label: string; groupCol: string; items: GalleryCardRow[]; subgroups?: GroupSection[] };

function GroupSectionView({
  section, depth, collapsedGroups, toggleGroup, renderGroupLabel, viewMode, gridClasses, setSelectedId, onSelectColorway,
}: {
  section: GroupSection;
  depth: number;
  collapsedGroups: Set<string>;
  toggleGroup: (key: string) => void;
  renderGroupLabel: (groupKey: string, key: string, label: string, count: number) => React.ReactNode;
  viewMode: string;
  gridClasses: string;
  setSelectedId: (id: string) => void;
  onSelectColorway?: (id: string) => void;
}) {
  const collapseKey = `${depth}:${section.key}`;
  const isCollapsed = collapsedGroups.has(collapseKey);
  const indent = depth > 0 ? { paddingLeft: `${depth * 1.25}rem` } : undefined;

  return (
    <div style={indent}>
      <button
        onClick={() => toggleGroup(collapseKey)}
        className={`flex items-center gap-2 mb-3 pb-2 border-b w-full text-left cursor-pointer hover:bg-neutral-900/30 -mx-1 px-1 rounded transition-colors ${
          depth === 0 ? 'border-neutral-800' : 'border-neutral-800/50'
        }`}
      >
        <svg
          width="8" height="8" viewBox="0 0 8 8"
          className={`text-neutral-500 transition-transform duration-150 ${isCollapsed ? '-rotate-90' : ''}`}
        >
          <path d="M1 2l3 3.5L7 2" fill="currentColor" />
        </svg>
        {renderGroupLabel(section.groupCol, section.key, section.label, section.items.length)}
      </button>
      {!isCollapsed && (
        section.subgroups ? (
          <div className="space-y-4">
            {section.subgroups.map((sub) => (
              <GroupSectionView
                key={sub.key}
                section={sub}
                depth={depth + 1}
                collapsedGroups={collapsedGroups}
                toggleGroup={toggleGroup}
                renderGroupLabel={renderGroupLabel}
                viewMode={viewMode}
                gridClasses={gridClasses}
                setSelectedId={setSelectedId}
                onSelectColorway={onSelectColorway}
              />
            ))}
          </div>
        ) : viewMode === 'grid' ? (
          <div className={gridClasses}>
            {section.items.map((obj, i) => (
              <ObjectCard key={obj.id} object={obj} onClick={() => setSelectedId(obj.id)} onSelectColorway={onSelectColorway} priority={i < 4} />
            ))}
          </div>
        ) : (
          <div className="border border-neutral-800 rounded-lg overflow-hidden">
            {section.items.map((obj) => (
              <ObjectRow key={obj.id} object={obj} onClick={() => setSelectedId(obj.id)} />
            ))}
          </div>
        )
      )}
    </div>
  );
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
    f.groups = [{ col: view.group, dir: 'desc' }];
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
    update.group = filters.groups[0].col;
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

function ObjectGridInner({ initialData, initialCount, readOnly }: ObjectGridProps) {
  const galleryViewConfig = useViewConfig('gallery');
  const hierarchy = useHierarchy();
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

  const { objects: rawObjects, total, loading, loadMore, hasMore, updateObject } = useInfiniteObjects(initialData, initialCount, filters);

  // Client-side re-sort for columns with custom option ordering (season, rarity, etc.)
  const objects = useMemo(() => {
    const sorts = filters.sorts || [];
    const clientSort = sorts.find(s => ['season', 'notion_rarity', 'genre', 'category_1'].includes(s.col));
    if (!clientSort) return rawObjects;
    const ascending = clientSort.dir === 'asc';
    const col = clientSort.col as keyof GalleryCardRow;
    return [...rawObjects].sort((a, b) => {
      const aVal = String(a[col] || '');
      const bVal = String(b[col] || '');
      const diff = optionSortKey(clientSort.col, aVal) - optionSortKey(clientSort.col, bVal);
      return ascending ? diff : -diff;
    });
  }, [rawObjects, filters.sorts]);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const sentinelRef = useRef<HTMLDivElement>(null);
  const viewMode = filters.view || 'grid';
  const groups = filters.groups || [];
  const primaryGroupCondition = groups[0]; // first group level with direction
  const primaryGroup = primaryGroupCondition?.col;
  const primaryGroupDir = primaryGroupCondition?.dir || 'desc';

  const toggleGroup = (key: string) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  // Helper: resolve group key(s) for an object given a group column
  const resolveGroupKeys = useCallback((obj: GalleryCardRow, groupCol: string): string[] => {
    if (groupCol === 'brand_family') {
      const familyKey = hierarchy.brandToFamily.get(obj.brand);
      return [familyKey || '__other'];
    }
    const raw = obj[groupCol as keyof GalleryCardRow];
    return Array.isArray(raw) ? (raw.length > 0 ? raw as string[] : ['(none)']) : [String(raw || '(none)')];
  }, [hierarchy.brandToFamily]);

  // Helper: resolve display label for a group key
  const resolveGroupLabel = useCallback((groupCol: string, key: string): string => {
    if (groupCol === 'brand_family') return key === '__other' ? 'Other' : (hierarchy.familyByKey.get(key)?.label || key);
    if (groupCol === 'brand') return brandDisplay(key);
    if (key === '(none)') return 'None';
    return key;
  }, [hierarchy.familyByKey]);

  // Helper: sort sections by their group column using option ordering
  const sortSections = useCallback(<T extends { key: string; label: string }>(sections: T[], groupCol: string, dir: string): T[] => {
    const ascending = dir === 'asc';
    sections.sort((a, b) => {
      const aIsOther = a.key === '__other' || a.key === '(none)';
      const bIsOther = b.key === '__other' || b.key === '(none)';
      if (aIsOther && !bIsOther) return 1;
      if (!aIsOther && bIsOther) return -1;
      const aKey = optionSortKey(groupCol, a.key);
      const bKey = optionSortKey(groupCol, b.key);
      if (aKey !== bKey) return ascending ? aKey - bKey : bKey - aKey;
      const cmp = a.label.localeCompare(b.label);
      return ascending ? cmp : -cmp;
    });
    return sections;
  }, []);

  // Recursively build N-level grouped sections
  const buildGroupLevel = useCallback((items: GalleryCardRow[], levelIndex: number): GroupSection[] | undefined => {
    if (levelIndex >= groups.length) return undefined;
    const { col, dir = 'desc' } = groups[levelIndex];

    const sectionMap = new Map<string, GalleryCardRow[]>();
    for (const obj of items) {
      for (const k of resolveGroupKeys(obj, col)) {
        const existing = sectionMap.get(k);
        if (existing) existing.push(obj);
        else sectionMap.set(k, [obj]);
      }
    }

    const sections: GroupSection[] = [];
    for (const [key, sectionItems] of sectionMap) {
      sections.push({
        key,
        label: resolveGroupLabel(col, key),
        groupCol: col,
        items: sectionItems,
        subgroups: buildGroupLevel(sectionItems, levelIndex + 1),
      });
    }
    sortSections(sections, col, dir);
    return sections;
  }, [groups, resolveGroupKeys, resolveGroupLabel, sortSections]);

  const grouped = useMemo(() => {
    if (!primaryGroup) return null;
    return buildGroupLevel(objects, 0) || null;
  }, [objects, primaryGroup, buildGroupLevel]);

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
    if (groupKey === 'notion_rarity') {
      const rarityLabel = key === '(none)' ? 'None' : label;
      return <><Badge rarity={rarityLabel}>{rarityLabel}</Badge> <span className="text-xs text-neutral-500 ml-2">{count}</span></>;
    }
    return <><span className="text-sm font-medium text-white">{label}</span> <span className="text-xs text-neutral-500 ml-2">{count}</span></>;
  };

  // Handler to switch to a different colorway in the same model_group
  const handleSelectColorway = useCallback((id: string) => {
    setSelectedId(id);
  }, []);

  return (
    <ColorwayProvider objects={objects}>
      {!readOnly && (
        <ViewBar
          views={galleryViewConfig.views}
          activeViewId={galleryViewConfig.activeViewId}
          onSwitchView={handleSwitchView}
          onCreateView={galleryViewConfig.createView}
          onRenameView={galleryViewConfig.renameView}
        />
      )}
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
        // Grouped view — recursive renderer for N-level nesting
        <div className="space-y-6">
          {grouped.map((section) => (
            <GroupSectionView
              key={section.key}
              section={section}
              depth={0}
              collapsedGroups={collapsedGroups}
              toggleGroup={toggleGroup}
              renderGroupLabel={renderGroupLabel}
              viewMode={viewMode}
              gridClasses={gridClasses}
              setSelectedId={setSelectedId}
              onSelectColorway={handleSelectColorway}
            />
          ))}
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
            <ObjectCard key={obj.id} object={obj} onClick={() => setSelectedId(obj.id)} onSelectColorway={handleSelectColorway} priority={i < 10} />
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
          onObjectUpdated={updateObject}
          onNavigate={handleSelectColorway}
          readOnly={readOnly}
        />
      )}
    </ColorwayProvider>
  );
}

export function ObjectGrid(props: ObjectGridProps) {
  return (
    <Suspense fallback={<div className="text-neutral-500 text-sm">Loading...</div>}>
      <ObjectGridInner {...props} />
    </Suspense>
  );
}
