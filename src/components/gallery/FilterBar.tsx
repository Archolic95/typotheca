'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useFilters } from '@/hooks/useFilters';
import {
  BRANDS, BRAND_DISPLAY, CATEGORY_1_OPTIONS, RARITY_LEVELS, GENRE_OPTIONS,
  ACRONYM_CATEGORIES, ACRONYM_STYLES,
} from '@/lib/constants';
import { DEFAULT_GALLERY_BRANDS } from '@/lib/filters';
import type { SortCondition } from '@/lib/filters';
import { getSupabaseBrowser } from '@/lib/supabase/client';
import { PortalDropdown, FilterPill } from '@/components/ui/FilterControls';
import { HierarchicalFilterPill } from './HierarchicalFilterPill';
import { HierarchyEditor } from './HierarchyEditor';
import { useHierarchy } from '@/hooks/useHierarchy';
import { getSortableColumns, getGroupableColumns } from '@/lib/columns';
import { cn } from '@/lib/utils';
import { useOptionOrder } from '@/hooks/useOptionOrder';

// ── Filter column definitions ───────────────────────────────────────────

interface FilterColumn {
  key: string;
  label: string;
  filterKey: string; // key in FilterState
  multi?: boolean;
  options?: { value: string; label: string }[];
  type?: 'boolean';
  acronymOnly?: boolean;
}

// ── Boolean Filter Pill (3-state: Checked / Unchecked / Clear) ──────────

function BooleanFilterPill({ label, stateLabel, onSelect, onRemove }: {
  label: string;
  stateLabel: string | null; // 'Checked' | 'Unchecked' | null (not set)
  onSelect: (v: 'true' | 'false' | 'clear') => void;
  onRemove: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  const openMenu = () => {
    if (ref.current) {
      const rect = ref.current.getBoundingClientRect();
      setPos({ top: rect.bottom + 4, left: rect.left });
    }
    setOpen(true);
  };

  const options = [
    { value: 'true' as const, label: 'Checked', icon: '✓' },
    { value: 'false' as const, label: 'Unchecked', icon: '✕' },
    { value: 'clear' as const, label: 'Clear', icon: '—' },
  ];

  return (
    <>
      <div ref={ref} className="flex items-center gap-0 bg-neutral-800 rounded-lg border border-neutral-700 overflow-hidden">
        <button
          onClick={openMenu}
          className="px-2.5 py-1.5 text-xs text-white flex items-center gap-1.5 hover:bg-neutral-700/50"
        >
          {label}
          {stateLabel && (
            <span className="text-neutral-400">: {stateLabel}</span>
          )}
          <svg width="8" height="8" viewBox="0 0 8 8" className="ml-0.5">
            <path d="M1 3l3 3 3-3" stroke="currentColor" strokeWidth="1.2" fill="none" strokeLinecap="round" />
          </svg>
        </button>
        <button
          onClick={onRemove}
          className="px-1.5 py-1.5 text-neutral-500 hover:text-white hover:bg-neutral-700/50 border-l border-neutral-700"
        >
          <svg width="8" height="8" viewBox="0 0 8 8">
            <path d="M1 1l6 6M7 1l-6 6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
          </svg>
        </button>
      </div>
      {open && pos && createPortal(
        <>
          <div className="fixed inset-0 z-[100]" onClick={() => setOpen(false)} />
          <div
            className="fixed z-[101] min-w-[160px] bg-neutral-900 border border-neutral-800 rounded-lg shadow-xl py-1"
            style={{ top: pos.top, left: Math.min(pos.left, window.innerWidth - 180) }}
          >
            {options.map(opt => (
              <button
                key={opt.value}
                onClick={() => { onSelect(opt.value); setOpen(false); }}
                className={cn(
                  'w-full text-left px-3 py-1.5 text-xs hover:bg-neutral-800 flex items-center gap-2',
                  stateLabel === opt.label ? 'text-white' : 'text-neutral-400',
                )}
              >
                <span className="w-4 text-center">{opt.icon}</span>
                {opt.label}
                {stateLabel === opt.label && (
                  <svg width="8" height="8" viewBox="0 0 8 8" className="ml-auto">
                    <path d="M1.5 4l2 2 3-3.5" stroke="currentColor" strokeWidth="1.2" fill="none" />
                  </svg>
                )}
              </button>
            ))}
          </div>
        </>,
        document.body
      )}
    </>
  );
}

// ── Filter column definitions ───────────────────────────────────────────

const FILTER_COLUMNS: FilterColumn[] = [
  {
    key: 'brand', label: 'Brand', filterKey: 'brand', multi: true,
    options: BRANDS.map(b => ({ value: b, label: BRAND_DISPLAY[b] || b })),
  },
  {
    key: 'cat1', label: 'Category', filterKey: 'cat1',
    options: CATEGORY_1_OPTIONS.map(c => ({ value: c, label: c })),
  },
  {
    key: 'cat2', label: 'Subcategory', filterKey: 'cat2',
    options: [], // filled dynamically based on cat1 selection
  },
  { key: 'season', label: 'Season', filterKey: 'season', multi: true, options: [] }, // filled dynamically
  {
    key: 'genre', label: 'Genre', filterKey: 'genre', multi: true,
    options: GENRE_OPTIONS.map(g => ({ value: g, label: g })),
  },
  {
    key: 'rarity', label: 'Rarity', filterKey: 'rarity', multi: true,
    options: RARITY_LEVELS.map(r => ({ value: r, label: r })),
  },
  { key: 'in_stock', label: 'In Stock', filterKey: 'in_stock', type: 'boolean' },
  { key: 'copped', label: 'Copped', filterKey: 'copped', type: 'boolean' },
  {
    key: 'acronym_category', label: 'Acrn Type', filterKey: 'acronym_category', acronymOnly: true,
    options: ACRONYM_CATEGORIES.map(c => ({ value: c, label: c })),
  },
  {
    key: 'acronym_style', label: 'Acrn Style', filterKey: 'acronym_style', acronymOnly: true,
    options: ACRONYM_STYLES.map(s => ({ value: s, label: s })),
  },
];

// ── Main FilterBar ──────────────────────────────────────────────────────

export function FilterBar() {
  const { filters, setFilter, setFilters, clearFilters } = useFilters();
  const [search, setSearch] = useState(filters.q || '');
  const [showAddFilter, setShowAddFilter] = useState(false);
  const [showHierarchyEditor, setShowHierarchyEditor] = useState(false);
  const hierarchy = useHierarchy();
  const optionOrder = useOptionOrder();

  // Fetch distinct seasons — cached in localStorage for 1 hour
  const [seasonOptions, setSeasonOptions] = useState<string[]>([]);
  useEffect(() => {
    const CACHE_KEY = 'typotheca_seasons';
    const CACHE_TTL = 60 * 60 * 1000;

    const sortSeasons = (seasons: string[]) => {
      seasons.sort((a, b) => {
        const parseS = (s: string) => {
          const m = s.match(/(SS|FW|AW)(\d{2,4})/);
          if (!m) return 0;
          const year = m[2].length === 2 ? 2000 + parseInt(m[2]) : parseInt(m[2]);
          return year * 10 + (m[1] === 'SS' ? 0 : 5);
        };
        return parseS(b) - parseS(a);
      });
      return seasons;
    };

    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        const { data, ts } = JSON.parse(cached);
        if (Date.now() - ts < CACHE_TTL && Array.isArray(data) && data.length > 0) {
          setSeasonOptions(data);
          return;
        }
      }
    } catch { /* ignore */ }

    const supabase = getSupabaseBrowser();
    supabase.from('objects').select('season').not('season', 'is', null)
      .order('updated_at', { ascending: false }).limit(2000)
      .then(({ data }) => {
        if (data) {
          const unique = [...new Set(
            (data as { season: string }[]).map(r => r.season).filter(Boolean)
          )];
          const sorted = sortSeasons(unique);
          setSeasonOptions(sorted);
          try { localStorage.setItem(CACHE_KEY, JSON.stringify({ data: sorted, ts: Date.now() })); } catch { /* ignore */ }
        }
      });
  }, []);

  // Build column definitions with dynamic season + cat2 options
  const columns = useMemo(() => {
    const selectedCat1 = filters.cat1;
    const cat2Options = selectedCat1
      ? (hierarchy.categoryHierarchy[selectedCat1] || [])
      : Object.values(hierarchy.categoryHierarchy).flat();
    const uniqueCat2 = [...new Set(cat2Options)].sort();

    return FILTER_COLUMNS.map(col => {
      if (col.key === 'season') return { ...col, options: seasonOptions.map(s => ({ value: s, label: s })) };
      if (col.key === 'cat2') return { ...col, options: uniqueCat2.map(c => ({ value: c, label: c })) };
      // For fields with custom ordering, use the stored order
      const fieldKey = col.filterKey;
      const customOrder = optionOrder.getOrder(fieldKey);
      if (customOrder.length > 0 && col.options && col.options.length > 0) {
        // Reorder options to match the custom order
        const optMap = new Map(col.options.map(o => [o.value, o]));
        const reordered = customOrder
          .filter(v => optMap.has(v))
          .map(v => optMap.get(v)!);
        // Append any options not in the custom order
        for (const o of col.options) {
          if (!customOrder.includes(o.value)) reordered.push(o);
        }
        return { ...col, options: reordered };
      }
      return col;
    });
  }, [seasonOptions, filters.cat1, hierarchy.categoryHierarchy, optionOrder]);

  // Determine which filters are currently active (have values in URL params)
  const getFilterValue = useCallback((col: FilterColumn): string[] => {
    const val = filters[col.filterKey as keyof typeof filters];
    if (val == null) return [];
    if (typeof val === 'boolean') return [String(val)];
    if (Array.isArray(val)) return val.filter((v): v is string => typeof v === 'string');
    return [String(val)];
  }, [filters]);

  // Track which filter columns are shown (active = has value or user added it)
  const [addedFilters, setAddedFilters] = useState<Set<string>>(new Set());

  // Auto-show filters that have URL param values
  const activeFilterKeys = useMemo(() => {
    const keys = new Set(addedFilters);
    for (const col of columns) {
      if (getFilterValue(col).length > 0) keys.add(col.key);
    }
    return keys;
  }, [addedFilters, columns, getFilterValue]);

  // Show acronym filters only when acronym is the sole selected brand
  const showAcronymFilters = useMemo(() =>
    filters.brand?.includes('acronym') && filters.brand.length === 1,
    [filters.brand],
  );

  const visibleFilters = useMemo(() =>
    columns.filter(col => {
      if (col.acronymOnly && !showAcronymFilters) return false;
      return activeFilterKeys.has(col.key);
    }),
    [columns, activeFilterKeys, showAcronymFilters],
  );

  const availableFilters = useMemo(() =>
    columns.filter(col => {
      if (col.acronymOnly && !showAcronymFilters) return false;
      return !activeFilterKeys.has(col.key);
    }),
    [columns, activeFilterKeys, showAcronymFilters],
  );

  // Default: always show Brand filter
  useEffect(() => {
    if (!activeFilterKeys.has('brand')) {
      setAddedFilters(prev => new Set(prev).add('brand'));
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleFilterChange = (col: FilterColumn, values: string[]) => {
    if (col.type === 'boolean') {
      const v = values[0];
      setFilter(col.filterKey as keyof typeof filters, v === 'true' ? true : v === 'false' ? false : undefined);
    } else if (col.multi) {
      setFilter(col.filterKey as keyof typeof filters, values.length ? values : undefined);
    } else {
      setFilter(col.filterKey as keyof typeof filters, values[0] || undefined);
      // When cat1 changes, clear cat2 since subcategories are different
      if (col.key === 'cat1') {
        setFilter('cat2' as keyof typeof filters, undefined);
      }
    }
  };

  const handleRemoveFilter = (col: FilterColumn) => {
    if (col.type === 'boolean') {
      setFilter(col.filterKey as keyof typeof filters, undefined);
    } else {
      setFilter(col.filterKey as keyof typeof filters, undefined);
    }
    setAddedFilters(prev => {
      const next = new Set(prev);
      next.delete(col.key);
      return next;
    });
  };

  const addFilter = (key: string) => {
    setAddedFilters(prev => new Set(prev).add(key));
    setShowAddFilter(false);
  };

  const isDefaultBrands = useMemo(() => {
    const activeBrands = filters.brand || [];
    return activeBrands.length === DEFAULT_GALLERY_BRANDS.length &&
      activeBrands.every(b => DEFAULT_GALLERY_BRANDS.includes(b));
  }, [filters.brand]);

  const hasFilters = useMemo(() => !!(
    (filters.brand?.length && !isDefaultBrands) || filters.cat1 || filters.cat2 || filters.genre?.length ||
    filters.rarity?.length || filters.in_stock != null || filters.copped != null ||
    filters.q || filters.price_min || filters.price_max ||
    filters.season?.length || filters.acronym_category || filters.acronym_style ||
    (filters.sorts?.length) || (filters.groups?.length)
  ), [filters, isDefaultBrands]);

  // ── Sort helpers ──────────────────────────────────────────────────────
  const sorts = filters.sorts || [];

  const addSort = (col: string) => {
    setFilter('sorts', [...sorts, { col, dir: 'desc' as const }]);
  };
  const updateSort = (index: number, updates: Partial<SortCondition>) => {
    const next = sorts.map((s, i) => i === index ? { ...s, ...updates } : s);
    setFilter('sorts', next);
  };
  const removeSort = (index: number) => {
    const next = sorts.filter((_, i) => i !== index);
    setFilter('sorts', next.length ? next : undefined);
  };

  // ── Group helpers ─────────────────────────────────────────────────────
  const groups = filters.groups || [];

  const addGroup = (col: string) => {
    setFilter('groups', [...groups, { col, dir: 'desc' as const }]);
  };
  const updateGroup = (index: number, updates: Partial<SortCondition>) => {
    const next = groups.map((g, i) => i === index ? { ...g, ...updates } : g);
    setFilter('groups', next);
  };
  const removeGroup = (index: number) => {
    const next = groups.filter((_, i) => i !== index);
    setFilter('groups', next.length ? next : undefined);
  };

  return (
    <div className="space-y-3">
      {/* Search + View toggle */}
      <div className="flex gap-3">
        <div className="flex-1 relative">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') setFilter('q', search || undefined);
            }}
            placeholder="Search objects..."
            className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-4 py-2 text-sm text-white placeholder:text-neutral-500 focus:outline-none focus:border-neutral-600"
          />
          {search && (
            <button
              onClick={() => { setSearch(''); setFilter('q', undefined); }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-white"
            >
              <svg width="12" height="12" viewBox="0 0 12 12">
                <path d="M1 1l10 10M11 1L1 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>
          )}
        </div>
        <div className="flex rounded-lg border border-neutral-800 overflow-hidden">
          <button
            onClick={() => setFilter('view', 'grid')}
            className={cn(
              'px-3 py-2 text-sm',
              (filters.view || 'grid') === 'grid' ? 'bg-neutral-800 text-white' : 'text-neutral-500 hover:text-white',
            )}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
              <rect x="0" y="0" width="6" height="6" rx="1" />
              <rect x="8" y="0" width="6" height="6" rx="1" />
              <rect x="0" y="8" width="6" height="6" rx="1" />
              <rect x="8" y="8" width="6" height="6" rx="1" />
            </svg>
          </button>
          <button
            onClick={() => setFilter('view', 'list')}
            className={cn(
              'px-3 py-2 text-sm',
              filters.view === 'list' ? 'bg-neutral-800 text-white' : 'text-neutral-500 hover:text-white',
            )}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
              <rect x="0" y="1" width="14" height="2.5" rx="0.5" />
              <rect x="0" y="5.75" width="14" height="2.5" rx="0.5" />
              <rect x="0" y="10.5" width="14" height="2.5" rx="0.5" />
            </svg>
          </button>
        </div>
      </div>

      {/* Filter pills row */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Active filter pills */}
        {visibleFilters.map(col => {
          if (col.type === 'boolean') {
            const val = filters[col.filterKey as keyof typeof filters];
            const stateLabel = val === true ? 'Checked' : val === false ? 'Unchecked' : null;
            return (
              <BooleanFilterPill
                key={col.key}
                label={col.label}
                stateLabel={stateLabel}
                onSelect={(v) => handleFilterChange(col, v === 'clear' ? [] : [v])}
                onRemove={() => handleRemoveFilter(col)}
              />
            );
          }

          // Use hierarchical pill for brand filter
          if (col.key === 'brand') {
            return (
              <HierarchicalFilterPill
                key={col.key}
                label={col.label}
                families={hierarchy.brandFamilies}
                selected={getFilterValue(col)}
                onChange={(v) => handleFilterChange(col, v)}
                onRemove={() => handleRemoveFilter(col)}
                onEditFamilies={() => setShowHierarchyEditor(true)}
              />
            );
          }

          return (
            <FilterPill
              key={col.key}
              label={col.label}
              options={col.options || []}
              selected={getFilterValue(col)}
              onChange={(v) => handleFilterChange(col, v)}
              onRemove={() => handleRemoveFilter(col)}
              multi={col.multi}
              onReorder={(newOpts) => optionOrder.setOrder(col.filterKey, newOpts.map(o => o.value))}
              onColorChange={(value, color) => optionOrder.setColor(col.filterKey, value, color)}
              getColor={(value) => optionOrder.getColor(col.filterKey, value)}
            />
          );
        })}

        {/* + Filter button */}
        {availableFilters.length > 0 && (
          <PortalDropdown
            trigger={
              <button
                onClick={() => setShowAddFilter(!showAddFilter)}
                className="px-2.5 py-1.5 text-xs text-neutral-400 border border-dashed border-neutral-700 rounded-lg hover:text-white hover:border-neutral-600 transition-colors flex items-center gap-1"
              >
                <svg width="10" height="10" viewBox="0 0 10 10">
                  <path d="M5 1v8M1 5h8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                </svg>
                Filter
              </button>
            }
            open={showAddFilter}
            onClose={() => setShowAddFilter(false)}
          >
            {availableFilters.map(col => (
              <button
                key={col.key}
                onClick={() => addFilter(col.key)}
                className="w-full text-left px-3 py-1.5 text-xs text-neutral-400 hover:bg-neutral-800 hover:text-white"
              >
                {col.label}
              </button>
            ))}
          </PortalDropdown>
        )}

        <div className="w-px h-5 bg-neutral-800" />

        {/* Sort pills */}
        <SortPills sorts={sorts} onAdd={addSort} onUpdate={updateSort} onRemove={removeSort} />

        <div className="w-px h-5 bg-neutral-800" />

        {/* Group pills */}
        <GroupPills groups={groups} onAdd={addGroup} onUpdate={updateGroup} onRemove={removeGroup} />

        {/* Clear all */}
        {hasFilters && (
          <button
            onClick={() => { clearFilters(); setAddedFilters(new Set(['brand'])); }}
            className="px-2.5 py-1.5 text-xs text-neutral-400 hover:text-white transition-colors"
          >
            Clear all
          </button>
        )}
      </div>

      {/* Hierarchy Editor Modal */}
      <HierarchyEditor
        open={showHierarchyEditor}
        onClose={() => setShowHierarchyEditor(false)}
        brandFamilies={hierarchy.brandFamilies}
        onUpdateBrandFamilies={hierarchy.updateBrandFamilies}
        onResetBrandFamilies={hierarchy.resetBrandFamilies}
        categoryHierarchy={hierarchy.categoryHierarchy}
        onUpdateCategoryHierarchy={hierarchy.updateCategoryHierarchy}
        onResetCategoryHierarchy={hierarchy.resetCategoryHierarchy}
      />
    </div>
  );
}

// ── Sort Pills ───���───────────────────────���───────────────────────────���─

function SortPills({ sorts, onAdd, onUpdate, onRemove }: {
  sorts: SortCondition[];
  onAdd: (col: string) => void;
  onUpdate: (index: number, updates: Partial<SortCondition>) => void;
  onRemove: (index: number) => void;
}) {
  const [showAdd, setShowAdd] = useState(false);
  const [search, setSearch] = useState('');
  const sortableColumns = useMemo(() => getSortableColumns(), []);
  const usedCols = new Set(sorts.map(s => s.col));
  const available = useMemo(() =>
    sortableColumns.filter(c => !usedCols.has(c.key) && c.label.toLowerCase().includes(search.toLowerCase())),
    [sortableColumns, usedCols, search],
  );

  return (
    <>
      {sorts.map((s, i) => {
        const col = sortableColumns.find(c => c.key === s.col);
        return (
          <div key={`sort-${i}`} className="flex items-center gap-0 bg-neutral-800 rounded-lg border border-neutral-700 overflow-hidden">
            <button
              onClick={() => onUpdate(i, { dir: s.dir === 'desc' ? 'asc' : 'desc' })}
              className="px-2.5 py-1.5 text-xs text-white flex items-center gap-1.5 hover:bg-neutral-700/50"
              title={`Sort ${s.dir === 'desc' ? 'descending' : 'ascending'} — click to flip`}
            >
              <span className="text-[10px] text-neutral-500">{col?.icon || 'Aa'}</span>
              {col?.label || s.col}
              <span className="text-neutral-400">{s.dir === 'asc' ? '↑' : '↓'}</span>
            </button>
            <button
              onClick={() => onRemove(i)}
              className="px-1.5 py-1.5 text-neutral-500 hover:text-white hover:bg-neutral-700/50 border-l border-neutral-700"
            >
              <svg width="8" height="8" viewBox="0 0 8 8">
                <path d="M1 1l6 6M7 1l-6 6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        );
      })}
      <PortalDropdown
        trigger={
          <button
            onClick={() => setShowAdd(!showAdd)}
            className="px-2.5 py-1.5 text-xs text-neutral-400 border border-dashed border-neutral-700 rounded-lg hover:text-white hover:border-neutral-600 transition-colors flex items-center gap-1"
          >
            <svg width="10" height="10" viewBox="0 0 10 10">
              <path d="M5 1v8M1 5h8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
            </svg>
            Sort
          </button>
        }
        open={showAdd}
        onClose={() => { setShowAdd(false); setSearch(''); }}
      >
        <div className="px-2 pb-1">
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Sort by..."
            className="w-full bg-neutral-800 border border-neutral-700 rounded px-2 py-1 text-xs text-neutral-200 outline-none focus:border-blue-500"
            autoFocus
          />
        </div>
        <div className="max-h-[280px] overflow-y-auto">
          {available.map(col => (
            <button
              key={col.key}
              onClick={() => { onAdd(col.key); setShowAdd(false); setSearch(''); }}
              className="w-full text-left px-3 py-1.5 text-xs text-neutral-400 hover:bg-neutral-800 hover:text-white flex items-center gap-2"
            >
              <span className="w-4 text-center text-[10px] text-neutral-600">{col.icon || 'Aa'}</span>
              {col.label}
            </button>
          ))}
          {available.length === 0 && (
            <div className="px-3 py-2 text-xs text-neutral-500">No more columns</div>
          )}
        </div>
      </PortalDropdown>
    </>
  );
}

// ── Group Pills ────────────────────────────────────────────────────────

function GroupPills({ groups, onAdd, onUpdate, onRemove }: {
  groups: SortCondition[];
  onAdd: (col: string) => void;
  onUpdate: (index: number, updates: Partial<SortCondition>) => void;
  onRemove: (index: number) => void;
}) {
  const [showAdd, setShowAdd] = useState(false);
  const [search, setSearch] = useState('');
  const groupableColumns = useMemo(() => getGroupableColumns(), []);
  const usedCols = new Set(groups.map(g => g.col));
  const available = useMemo(() =>
    groupableColumns.filter(c => !usedCols.has(c.key) && c.label.toLowerCase().includes(search.toLowerCase())),
    [groupableColumns, usedCols, search],
  );

  return (
    <>
      {groups.map((g, i) => {
        const col = groupableColumns.find(c => c.key === g.col);
        return (
          <div key={`group-${i}`} className="flex items-center gap-0 bg-neutral-800 rounded-lg border border-neutral-700 overflow-hidden">
            <button
              onClick={() => onUpdate(i, { dir: g.dir === 'desc' ? 'asc' : 'desc' })}
              className="px-2.5 py-1.5 text-xs text-white flex items-center gap-1.5 hover:bg-neutral-700/50"
              title={`Group ${g.dir === 'desc' ? 'descending' : 'ascending'} — click to flip`}
            >
              <svg width="10" height="10" viewBox="0 0 10 10" className="text-neutral-500">
                <rect x="1" y="1" width="8" height="2" rx="0.5" fill="currentColor" />
                <rect x="1" y="4.5" width="8" height="2" rx="0.5" fill="currentColor" opacity="0.5" />
                <rect x="1" y="8" width="8" height="2" rx="0.5" fill="currentColor" opacity="0.3" />
              </svg>
              {col?.label || g.col}
              <span className="text-neutral-400">{g.dir === 'asc' ? '↑' : '↓'}</span>
            </button>
            <button
              onClick={() => onRemove(i)}
              className="px-1.5 py-1.5 text-neutral-500 hover:text-white hover:bg-neutral-700/50 border-l border-neutral-700"
            >
              <svg width="8" height="8" viewBox="0 0 8 8">
                <path d="M1 1l6 6M7 1l-6 6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        );
      })}
      <PortalDropdown
        trigger={
          <button
            onClick={() => setShowAdd(!showAdd)}
            className="px-2.5 py-1.5 text-xs text-neutral-400 border border-dashed border-neutral-700 rounded-lg hover:text-white hover:border-neutral-600 transition-colors flex items-center gap-1"
          >
            <svg width="10" height="10" viewBox="0 0 10 10">
              <path d="M5 1v8M1 5h8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
            </svg>
            Group
          </button>
        }
        open={showAdd}
        onClose={() => { setShowAdd(false); setSearch(''); }}
      >
        <div className="px-2 pb-1">
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Group by..."
            className="w-full bg-neutral-800 border border-neutral-700 rounded px-2 py-1 text-xs text-neutral-200 outline-none focus:border-blue-500"
            autoFocus
          />
        </div>
        <div className="max-h-[280px] overflow-y-auto">
          {available.map(col => (
            <button
              key={col.key}
              onClick={() => { onAdd(col.key); setShowAdd(false); setSearch(''); }}
              className="w-full text-left px-3 py-1.5 text-xs text-neutral-400 hover:bg-neutral-800 hover:text-white flex items-center gap-2"
            >
              <span className="w-4 text-center text-[10px] text-neutral-600">{col.icon || '≡'}</span>
              {col.label}
            </button>
          ))}
          {available.length === 0 && (
            <div className="px-3 py-2 text-xs text-neutral-500">No more columns</div>
          )}
        </div>
      </PortalDropdown>
    </>
  );
}
