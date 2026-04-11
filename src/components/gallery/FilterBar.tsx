'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useFilters } from '@/hooks/useFilters';
import {
  BRANDS, BRAND_DISPLAY, CATEGORY_1_OPTIONS, RARITY_LEVELS, GENRE_OPTIONS,
  ACRONYM_CATEGORIES, ACRONYM_STYLES,
} from '@/lib/constants';
import { DEFAULT_GALLERY_BRANDS } from '@/lib/filters';
import { getSupabaseBrowser } from '@/lib/supabase/client';
import { PortalDropdown, FilterPill } from '@/components/ui/FilterControls';
import { getSortableColumns, getGroupableColumns } from '@/lib/columns';
import { cn } from '@/lib/utils';

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

const FILTER_COLUMNS: FilterColumn[] = [
  {
    key: 'brand', label: 'Brand', filterKey: 'brand', multi: true,
    options: BRANDS.map(b => ({ value: b, label: BRAND_DISPLAY[b] || b })),
  },
  {
    key: 'cat1', label: 'Category', filterKey: 'cat1',
    options: CATEGORY_1_OPTIONS.map(c => ({ value: c, label: c })),
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

  // Build column definitions with dynamic season options
  const columns = useMemo(() =>
    FILTER_COLUMNS.map(col =>
      col.key === 'season'
        ? { ...col, options: seasonOptions.map(s => ({ value: s, label: s })) }
        : col
    ),
    [seasonOptions],
  );

  // Determine which filters are currently active (have values in URL params)
  const getFilterValue = useCallback((col: FilterColumn): string[] => {
    const val = filters[col.filterKey as keyof typeof filters];
    if (val == null) return [];
    if (typeof val === 'boolean') return [String(val)];
    if (Array.isArray(val)) return val;
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
      setFilter(col.filterKey as keyof typeof filters, values[0] === 'true' ? true : undefined);
    } else if (col.multi) {
      setFilter(col.filterKey as keyof typeof filters, values.length ? values : undefined);
    } else {
      setFilter(col.filterKey as keyof typeof filters, values[0] || undefined);
    }
  };

  const handleRemoveFilter = (col: FilterColumn) => {
    // Clear the filter value
    if (col.type === 'boolean') {
      setFilter(col.filterKey as keyof typeof filters, undefined);
    } else {
      setFilter(col.filterKey as keyof typeof filters, undefined);
    }
    // Remove from added set
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
    (filters.brand?.length && !isDefaultBrands) || filters.cat1 || filters.genre?.length ||
    filters.rarity?.length || filters.in_stock != null || filters.copped != null ||
    filters.q || filters.price_min || filters.price_max ||
    filters.season?.length || filters.acronym_category || filters.acronym_style ||
    filters.group
  ), [filters, isDefaultBrands]);

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

      {/* Dynamic filter pills + controls */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Active filter pills */}
        {visibleFilters.map(col => {
          if (col.type === 'boolean') {
            const isActive = filters[col.filterKey as keyof typeof filters] === true;
            return (
              <div key={col.key} className="flex items-center gap-0 bg-neutral-800 rounded-lg border border-neutral-700 overflow-hidden">
                <button
                  onClick={() => handleFilterChange(col, isActive ? [] : ['true'])}
                  className={cn(
                    'px-2.5 py-1.5 text-xs flex items-center gap-1.5',
                    isActive ? 'text-white' : 'text-neutral-400',
                  )}
                >
                  {col.label}
                  {isActive && (
                    <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  )}
                </button>
                <button
                  onClick={() => handleRemoveFilter(col)}
                  className="px-1.5 py-1.5 text-neutral-500 hover:text-white hover:bg-neutral-700/50 border-l border-neutral-700"
                >
                  <svg width="8" height="8" viewBox="0 0 8 8">
                    <path d="M1 1l6 6M7 1l-6 6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                  </svg>
                </button>
              </div>
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

        {/* Group */}
        <GroupButton />

        {/* Sort */}
        <SortButton />

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
    </div>
  );
}

// ── Group Button ────────────────────────────────────────────────────────

function GroupButton() {
  const { filters, setFilter } = useFilters();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const groupableColumns = useMemo(() => getGroupableColumns(), []);
  const currentGroup = filters.group;
  const currentLabel = groupableColumns.find(c => c.key === currentGroup)?.label;
  const filtered = useMemo(() =>
    groupableColumns.filter(c => c.label.toLowerCase().includes(search.toLowerCase())),
    [groupableColumns, search],
  );

  return (
    <PortalDropdown
      trigger={
        <button
          onClick={() => setOpen(!open)}
          className={cn(
            'px-2.5 py-1.5 text-xs rounded-lg border transition-colors flex items-center gap-1',
            currentGroup
              ? 'bg-neutral-800 text-white border-neutral-700'
              : 'text-neutral-400 border-neutral-800 hover:text-white hover:bg-neutral-800/50',
          )}
        >
          <svg width="10" height="10" viewBox="0 0 10 10">
            <rect x="1" y="1" width="8" height="2" rx="0.5" fill="currentColor" />
            <rect x="1" y="4.5" width="8" height="2" rx="0.5" fill="currentColor" opacity="0.5" />
            <rect x="1" y="8" width="8" height="2" rx="0.5" fill="currentColor" opacity="0.3" />
          </svg>
          {currentGroup ? `Group: ${currentLabel}` : 'Group'}
        </button>
      }
      open={open}
      onClose={() => { setOpen(false); setSearch(''); }}
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
      <button
        onClick={() => { setFilter('group', undefined); setOpen(false); setSearch(''); }}
        className={cn('w-full text-left px-3 py-1.5 text-xs hover:bg-neutral-800', !currentGroup ? 'text-white' : 'text-neutral-400')}
      >
        None
      </button>
      {filtered.map(col => (
        <button
          key={col.key}
          onClick={() => { setFilter('group', col.key); setOpen(false); setSearch(''); }}
          className={cn(
            'w-full text-left px-3 py-1.5 text-xs hover:bg-neutral-800 flex items-center gap-2',
            currentGroup === col.key ? 'text-white' : 'text-neutral-400',
          )}
        >
          <span className="w-4 text-center text-[10px] text-neutral-600">{col.icon || '≡'}</span>
          {col.label}
        </button>
      ))}
    </PortalDropdown>
  );
}

// ── Sort Button ─────────────────────────────────────────────────────────

function SortButton() {
  const { filters, setFilter } = useFilters();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const sortableColumns = useMemo(() => getSortableColumns(), []);
  const currentSort = filters.sort || 'updated_at';
  const currentDir = filters.order || 'desc';
  const currentLabel = sortableColumns.find(c => c.key === currentSort)?.label || currentSort;
  const filtered = useMemo(() =>
    sortableColumns.filter(c => c.label.toLowerCase().includes(search.toLowerCase())),
    [sortableColumns, search],
  );

  const handleSelect = (key: string) => {
    if (currentSort === key) {
      // Toggle direction
      setFilter('order', currentDir === 'desc' ? 'asc' : 'desc');
    } else {
      setFilter('sort', key === 'updated_at' ? undefined : key);
      setFilter('order', undefined); // reset to default desc
    }
    setOpen(false);
    setSearch('');
  };

  return (
    <PortalDropdown
      trigger={
        <button
          onClick={() => setOpen(!open)}
          className="px-2.5 py-1.5 text-xs text-neutral-400 border border-neutral-800 rounded-lg hover:text-white hover:bg-neutral-800/50 transition-colors flex items-center gap-1"
        >
          Sort: {currentLabel} {currentDir === 'asc' ? '↑' : '↓'}
        </button>
      }
      open={open}
      onClose={() => { setOpen(false); setSearch(''); }}
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
        {filtered.map(col => (
          <button
            key={col.key}
            onClick={() => handleSelect(col.key)}
            className={cn(
              'w-full text-left px-3 py-1.5 text-xs hover:bg-neutral-800 flex items-center gap-2',
              currentSort === col.key ? 'text-white' : 'text-neutral-400',
            )}
          >
            <span className="w-4 text-center text-[10px] text-neutral-600">{col.icon || 'Aa'}</span>
            <span className="flex-1">{col.label}</span>
            {currentSort === col.key && (
              <span className="text-neutral-500">{currentDir === 'asc' ? '↑' : '↓'}</span>
            )}
          </button>
        ))}
      </div>
    </PortalDropdown>
  );
}
