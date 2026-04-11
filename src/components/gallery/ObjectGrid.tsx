'use client';

import { useRef, useEffect, useState, useMemo, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { ObjectCard, ObjectRow } from './ObjectCard';
import { ObjectDetailModal } from './ObjectDetailModal';
import { FilterBar } from './FilterBar';
import { ViewBar } from '@/components/ui/ViewBar';
import { useViewConfig } from '@/hooks/useViewConfig';
import { useInfiniteObjects } from '@/hooks/useInfiniteObjects';
import { searchParamsToFilters, DEFAULT_GALLERY_BRANDS } from '@/lib/filters';
import { brandDisplay } from '@/lib/utils';
import { Badge } from '@/components/ui/Badge';
import type { GalleryCardRow } from '@/lib/supabase/queries';

interface ObjectGridProps {
  initialData: GalleryCardRow[];
  initialCount: number;
}

function ObjectGridInner({ initialData, initialCount }: ObjectGridProps) {
  const galleryViewConfig = useViewConfig('gallery');
  const searchParams = useSearchParams();
  const filters = (() => {
    const obj: Record<string, string> = {};
    searchParams.forEach((v, k) => { obj[k] = v; });
    const f = searchParamsToFilters(obj);
    // Apply default brand filter only on initial load (no brand param in URL at all)
    // If user explicitly cleared brands, the URL will have brand= (empty) — don't override
    const hasBrandParam = searchParams.has('brand');
    if (!hasBrandParam && !f.brand?.length && !f.q) {
      f.brand = DEFAULT_GALLERY_BRANDS;
    }
    return f;
  })();

  const { objects, total, loading, loadMore, hasMore } = useInfiniteObjects(initialData, initialCount, filters);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const viewMode = filters.view || 'grid';
  const groupBy = filters.group;

  // Build grouped sections from flat objects list
  const grouped = useMemo(() => {
    if (!groupBy) return null;
    const sections: { key: string; label: string; items: GalleryCardRow[] }[] = [];
    const sectionMap = new Map<string, GalleryCardRow[]>();
    for (const obj of objects) {
      const raw = obj[groupBy as keyof GalleryCardRow];
      const keys = Array.isArray(raw) ? (raw.length > 0 ? raw as string[] : ['(none)']) : [String(raw || '(none)')];
      for (const k of keys) {
        const existing = sectionMap.get(k);
        if (existing) existing.push(obj);
        else sectionMap.set(k, [obj]);
      }
    }
    for (const [key, items] of sectionMap) {
      const label = groupBy === 'brand' ? brandDisplay(key) : key === '(none)' ? 'Uncategorized' : key;
      sections.push({ key, label, items });
    }
    return sections;
  }, [objects, groupBy]);

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

  const renderGroupLabel = (key: string, label: string, count: number) => {
    if (groupBy === 'notion_rarity') return <><Badge rarity={label}>{label}</Badge> <span className="text-xs text-neutral-500 ml-2">{count}</span></>;
    return <><span className="text-sm font-medium text-white">{label}</span> <span className="text-xs text-neutral-500 ml-2">{count}</span></>;
  };

  return (
    <>
      <ViewBar
        views={galleryViewConfig.views}
        activeViewId={galleryViewConfig.activeViewId}
        onSwitchView={galleryViewConfig.switchView}
        onCreateView={galleryViewConfig.createView}
        onRenameView={galleryViewConfig.renameView}
      />
      <FilterBar />

      <div className="flex items-center justify-between mt-4 mb-3">
        <p className="text-xs text-neutral-500">
          {total.toLocaleString()} objects
        </p>
      </div>

      {grouped ? (
        // Grouped view
        <div className="space-y-6">
          {grouped.map(({ key, label, items }) => (
            <div key={key}>
              <div className="flex items-center gap-2 mb-3 pb-2 border-b border-neutral-800">
                <svg width="8" height="8" viewBox="0 0 8 8" className="text-neutral-500"><path d="M1 2l3 3.5L7 2" fill="currentColor" /></svg>
                {renderGroupLabel(key, label, items.length)}
              </div>
              {viewMode === 'grid' ? (
                <div className={gridClasses}>
                  {items.map((obj, i) => (
                    <ObjectCard key={obj.id} object={obj} onClick={() => setSelectedId(obj.id)} priority={i < 4} />
                  ))}
                </div>
              ) : (
                <div className="border border-neutral-800 rounded-lg overflow-hidden">
                  {items.map((obj) => (
                    <ObjectRow key={obj.id} object={obj} onClick={() => setSelectedId(obj.id)} />
                  ))}
                </div>
              )}
            </div>
          ))}
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
