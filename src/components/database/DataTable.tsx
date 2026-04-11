'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { getSupabaseBrowser } from '@/lib/supabase/client';
import { EditableCell } from './EditableCell';
import { useInlineEdit } from '@/hooks/useInlineEdit';
import { Badge } from '@/components/ui/Badge';
import { PortalDropdown, FilterPill } from '@/components/ui/FilterControls';
import { useViewConfig } from '@/hooks/useViewConfig';
import { brandDisplay, seasonSortKey, cn } from '@/lib/utils';
import { BRANDS, BRAND_DISPLAY } from '@/lib/constants';
import { ALL_COLUMNS, getColumnFilterOptions } from '@/lib/columns';
import type { ColumnDef } from '@/lib/columns';
import type { ObjectRow } from '@/lib/supabase/types';

type SortDir = 'asc' | 'desc';

// Active filter: column + selected values
interface ActiveFilter {
  column: string;
  values: string[];
}
const ROW_HEIGHT = 36;
const PAGE_SIZE = 200;

// ── Main DataTable ──────────────────────────────────────────────────────

interface DataTableProps {
  viewConfig: ReturnType<typeof useViewConfig>;
}

export function DataTable({ viewConfig }: DataTableProps) {
  const { activeView, setSort, setGroup, setColumns, setFilters: setViewFilters, updateView } = viewConfig;

  // Derive state from persisted view config
  const sortCol = activeView.sort.col;
  const sortDir = activeView.sort.dir;
  const groupBy = activeView.group;
  const visibleColumns = activeView.columns;
  const activeFilters = activeView.filters;

  // Setters that persist to localStorage via viewConfig
  const setSortCol = useCallback((col: string) => setSort(col, sortDir), [setSort, sortDir]);
  const setSortDir = useCallback((dir: SortDir | ((d: SortDir) => SortDir)) => {
    const newDir = typeof dir === 'function' ? dir(sortDir) : dir;
    setSort(sortCol, newDir);
  }, [setSort, sortCol, sortDir]);
  const setGroupBy = useCallback((g: string | undefined) => setGroup(g), [setGroup]);
  const setVisibleColumns = useCallback((cols: string[] | ((prev: string[]) => string[])) => {
    const next = typeof cols === 'function' ? cols(visibleColumns) : cols;
    setColumns(next);
  }, [setColumns, visibleColumns]);
  const setActiveFilters = useCallback((filters: ActiveFilter[] | ((prev: ActiveFilter[]) => ActiveFilter[])) => {
    const next = typeof filters === 'function' ? filters(activeFilters) : filters;
    setViewFilters(next);
  }, [setViewFilters, activeFilters]);

  const [rows, setRows] = useState<ObjectRow[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [showAddFilter, setShowAddFilter] = useState(false);
  const [showGroupBy, setShowGroupBy] = useState(false);
  const [groupSearch, setGroupSearch] = useState('');
  const [showColumns, setShowColumns] = useState(false);
  const [showSort, setShowSort] = useState(false);
  const [sortSearch, setSortSearch] = useState('');
  const parentRef = useRef<HTMLDivElement>(null);
  const headerInnerRef = useRef<HTMLDivElement>(null);
  const { save } = useInlineEdit();
  const loadedRanges = useRef<Set<string>>(new Set());

  const columns = useMemo(() => visibleColumns.map(key => ALL_COLUMNS[key]).filter(Boolean), [visibleColumns]);

  // Sync header scroll
  const handleBodyScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    if (headerInnerRef.current) {
      headerInnerRef.current.style.transform = `translateX(-${e.currentTarget.scrollLeft}px)`;
    }
  }, []);

  // Group rows
  const groupedData = useMemo(() => {
    if (!groupBy || rows.length === 0) return null;
    const groups = new Map<string, ObjectRow[]>();
    for (const row of rows) {
      const val = row[groupBy as keyof ObjectRow];
      const keys = Array.isArray(val) ? (val.length > 0 ? val as string[] : ['(none)']) : [String(val || '(none)')];
      for (const k of keys) {
        const existing = groups.get(k) || [];
        existing.push(row);
        groups.set(k, existing);
      }
    }
    const sortedKeys = [...groups.keys()].sort((a, b) => {
      if (groupBy === 'notion_rarity') {
        const order = ['Unicorn', 'ASAP', 'P00', 'P0', 'P1', 'P2', 'Not Ranked', '(none)'];
        return order.indexOf(a) - order.indexOf(b);
      }
      if (groupBy === 'season') {
        return seasonSortKey(b) - seasonSortKey(a);
      }
      return a.localeCompare(b);
    });
    return { groups, sortedKeys };
  }, [groupBy, rows]);

  const flatItems = useMemo(() => {
    if (!groupedData) return rows.map((r, i) => ({ type: 'row' as const, row: r, index: i }));
    const items: Array<{ type: 'header'; label: string; count: number } | { type: 'row'; row: ObjectRow; index: number }> = [];
    let idx = 0;
    for (const key of groupedData.sortedKeys) {
      const groupRows = groupedData.groups.get(key) || [];
      items.push({ type: 'header', label: key, count: groupRows.length });
      for (const row of groupRows) { items.push({ type: 'row', row, index: idx++ }); }
    }
    return items;
  }, [groupedData, rows]);

  // Build Supabase query with dynamic filters
  const applyFilters = useCallback((query: ReturnType<ReturnType<typeof getSupabaseBrowser>['from']>) => {
    let q = query;
    for (const f of activeFilters) {
      if (f.values.length === 0) continue;
      const col = ALL_COLUMNS[f.column];
      if (col?.type === 'multi-select') {
        q = q.overlaps(f.column, f.values);
      } else if (col?.type === 'boolean') {
        q = q.eq(f.column, f.values[0] === 'true');
      } else if (f.values.length === 1) {
        q = q.eq(f.column, f.values[0]);
      } else {
        q = q.in(f.column, f.values);
      }
    }
    if (search) {
      q = q.or(`name.ilike.%${search}%,model_code.ilike.%${search}%,brand.ilike.%${search}%`);
    }
    return q;
  }, [activeFilters, search]);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    loadedRanges.current.clear();
    const supabase = getSupabaseBrowser();
    let query = supabase.from('objects').select('*', { count: 'exact' });
    query = applyFilters(query) as typeof query;
    query = query.order(sortCol, { ascending: sortDir === 'asc' });
    const limit = groupBy ? 1000 : PAGE_SIZE;
    query = query.range(0, limit - 1);
    const { data, count } = await query;
    if (data) setRows(data as ObjectRow[]);
    if (count != null) setTotal(count);
    setLoading(false);
  }, [sortCol, sortDir, applyFilters, groupBy]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const fetchPage = useCallback(async (offset: number) => {
    if (groupBy) return;
    const rangeKey = `${offset}-${sortCol}-${sortDir}-${search}-${JSON.stringify(activeFilters)}`;
    if (loadedRanges.current.has(rangeKey)) return;
    loadedRanges.current.add(rangeKey);
    const supabase = getSupabaseBrowser();
    let query = supabase.from('objects').select('*');
    query = applyFilters(query) as typeof query;
    query = query.order(sortCol, { ascending: sortDir === 'asc' }).range(offset, offset + PAGE_SIZE - 1);
    const { data } = await query;
    if (data) {
      setRows(prev => {
        const next = [...prev];
        data.forEach((row, i) => { next[offset + i] = row as ObjectRow; });
        return next;
      });
    }
  }, [sortCol, sortDir, applyFilters, groupBy, search, activeFilters]);

  const virtualizer = useVirtualizer({
    count: groupBy ? flatItems.length : total,
    getScrollElement: () => parentRef.current,
    estimateSize: (i) => {
      if (groupBy && flatItems[i]?.type === 'header') return 40;
      return ROW_HEIGHT;
    },
    overscan: 20,
  });

  const virtualItems = virtualizer.getVirtualItems();
  useEffect(() => {
    if (groupBy || virtualItems.length === 0) return;
    const first = virtualItems[0].index;
    const last = virtualItems[virtualItems.length - 1].index;
    const pageStart = Math.floor(first / PAGE_SIZE) * PAGE_SIZE;
    const pageEnd = Math.floor(last / PAGE_SIZE) * PAGE_SIZE;
    for (let p = pageStart; p <= pageEnd; p += PAGE_SIZE) { fetchPage(p); }
  }, [virtualItems, fetchPage, groupBy]);

  const handleSort = (col: string) => {
    if (sortCol === col) setSort(col, sortDir === 'asc' ? 'desc' : 'asc');
    else setSort(col, 'asc');
  };

  const handleCellSave = useCallback(async (row: ObjectRow, field: string, value: unknown) => {
    const rowIdx = rows.findIndex(r => r.id === row.id);
    if (rowIdx < 0) return;
    setRows(prev => { const next = [...prev]; next[rowIdx] = { ...next[rowIdx], [field]: value }; return next; });
    const ok = await save(row.id, field, value);
    if (!ok) { setRows(prev => { const next = [...prev]; next[rowIdx] = row; return next; }); }
  }, [rows, save]);

  // Dynamic filter management
  const addFilter = (column: string) => {
    if (activeFilters.some(f => f.column === column)) return;
    setActiveFilters(prev => [...prev, { column, values: [] }]);
    setShowAddFilter(false);
  };
  const updateFilterValues = (column: string, values: string[]) => {
    setActiveFilters(prev => prev.map(f => f.column === column ? { ...f, values } : f));
  };
  const removeFilter = (column: string) => {
    setActiveFilters(prev => prev.filter(f => f.column !== column));
  };

  // Get filter options for a column (from predefined or loaded data)
  const getFilterOptions = (col: ColumnDef): { value: string; label: string }[] => {
    const predefined = getColumnFilterOptions(col);
    if (predefined) return predefined;
    // Dynamic: extract unique values from loaded rows
    const values = new Set<string>();
    rows.forEach(r => {
      const val = r[col.key as keyof ObjectRow];
      if (Array.isArray(val)) val.forEach(v => values.add(String(v)));
      else if (val != null && val !== '') values.add(String(val));
    });
    return [...values].sort().map(v => ({ value: v, label: v }));
  };

  const filterableColumns = Object.values(ALL_COLUMNS).filter(c => c.filterable) as ColumnDef[];
  const groupableColumns = Object.values(ALL_COLUMNS).filter(c => c.groupable) as ColumnDef[];
  const totalWidth = columns.reduce((acc, c) => acc + c.width, 0);

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      {/* Toolbar: Search + Controls */}
      <div className="flex items-center gap-2 mb-3">
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search..."
          className="flex-1 bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-1.5 text-sm text-white placeholder:text-neutral-500 focus:outline-none focus:border-neutral-600"
        />
        <span className="text-xs text-neutral-500 shrink-0">{total.toLocaleString()} objects</span>
      </div>

      {/* Dynamic Controls: Filter + Group + Sort + Columns */}
      <div className="flex flex-wrap items-center gap-2 mb-3">
        {/* Active filters */}
        {activeFilters.map(f => {
          const col = ALL_COLUMNS[f.column];
          if (!col) return null;
          return (
            <FilterPill
              key={f.column}
              label={col.label}
              options={getFilterOptions(col)}
              selected={f.values}
              onChange={(v) => updateFilterValues(f.column, v)}
              onRemove={() => removeFilter(f.column)}
              multi={col.type !== 'boolean'}
            />
          );
        })}

        {/* Add Filter button */}
        <PortalDropdown
          trigger={
            <button onClick={() => setShowAddFilter(!showAddFilter)} className="px-2.5 py-1.5 text-xs text-neutral-400 border border-dashed border-neutral-700 rounded-lg hover:text-white hover:border-neutral-600 transition-colors flex items-center gap-1">
              <svg width="10" height="10" viewBox="0 0 10 10"><path d="M5 1v8M1 5h8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>
              Filter
            </button>
          }
          open={showAddFilter}
          onClose={() => setShowAddFilter(false)}
        >
          {filterableColumns.filter(c => !activeFilters.some(f => f.column === c.key)).map(col => (
            <button key={col.key} onClick={() => addFilter(col.key)} className="w-full text-left px-3 py-1.5 text-xs text-neutral-400 hover:bg-neutral-800 hover:text-white">
              {col.label}
            </button>
          ))}
        </PortalDropdown>

        <div className="w-px h-5 bg-neutral-800" />

        {/* Group By */}
        <PortalDropdown
          trigger={
            <button onClick={() => setShowGroupBy(!showGroupBy)} className={cn('px-2.5 py-1.5 text-xs rounded-lg border transition-colors flex items-center gap-1', groupBy ? 'bg-neutral-800 text-white border-neutral-700' : 'text-neutral-400 border-neutral-800 hover:text-white hover:bg-neutral-800/50')}>
              <svg width="10" height="10" viewBox="0 0 10 10"><rect x="1" y="1" width="8" height="2" rx="0.5" fill="currentColor"/><rect x="1" y="4.5" width="8" height="2" rx="0.5" fill="currentColor" opacity="0.5"/><rect x="1" y="8" width="8" height="2" rx="0.5" fill="currentColor" opacity="0.3"/></svg>
              {groupBy ? `Group: ${ALL_COLUMNS[groupBy]?.label}` : 'Group'}
            </button>
          }
          open={showGroupBy}
          onClose={() => { setShowGroupBy(false); setGroupSearch(''); }}
        >
          <div className="px-2 pb-1">
            <input
              type="text"
              value={groupSearch}
              onChange={e => setGroupSearch(e.target.value)}
              placeholder="Group by..."
              className="w-full bg-neutral-800 border border-neutral-700 rounded px-2 py-1 text-xs text-neutral-200 outline-none focus:border-blue-500"
              autoFocus
            />
          </div>
          <button onClick={() => { setGroupBy(undefined); setShowGroupBy(false); setGroupSearch(''); }} className={cn('w-full text-left px-3 py-1.5 text-xs hover:bg-neutral-800', !groupBy ? 'text-white' : 'text-neutral-400')}>
            None
          </button>
          {groupableColumns.filter(c => c.label.toLowerCase().includes(groupSearch.toLowerCase())).map(col => (
            <button key={col.key} onClick={() => { setGroupBy(col.key); setShowGroupBy(false); setGroupSearch(''); }} className={cn('w-full text-left px-3 py-1.5 text-xs hover:bg-neutral-800 flex items-center gap-2', groupBy === col.key ? 'text-white' : 'text-neutral-400')}>
              <span className="w-4 text-center text-[10px] text-neutral-600">{col.icon || '≡'}</span>
              {col.label}
            </button>
          ))}
        </PortalDropdown>

        {/* Sort */}
        <PortalDropdown
          trigger={
            <button onClick={() => setShowSort(!showSort)} className="px-2.5 py-1.5 text-xs text-neutral-400 border border-neutral-800 rounded-lg hover:text-white hover:bg-neutral-800/50 transition-colors flex items-center gap-1">
              Sort: {ALL_COLUMNS[sortCol]?.label || sortCol} {sortDir === 'asc' ? '↑' : '↓'}
            </button>
          }
          open={showSort}
          onClose={() => { setShowSort(false); setSortSearch(''); }}
        >
          <div className="px-2 pb-1">
            <input
              type="text"
              value={sortSearch}
              onChange={e => setSortSearch(e.target.value)}
              placeholder="Sort by..."
              className="w-full bg-neutral-800 border border-neutral-700 rounded px-2 py-1 text-xs text-neutral-200 outline-none focus:border-blue-500"
              autoFocus
            />
          </div>
          <div className="max-h-[280px] overflow-y-auto">
            {Object.values(ALL_COLUMNS).filter(c => c.sortable && c.label.toLowerCase().includes(sortSearch.toLowerCase())).map(col => (
              <button
                key={col.key}
                onClick={() => {
                  if (sortCol === col.key) setSort(col.key, sortDir === 'asc' ? 'desc' : 'asc');
                  else setSort(col.key, 'asc');
                  setShowSort(false); setSortSearch('');
                }}
                className={cn('w-full text-left px-3 py-1.5 text-xs hover:bg-neutral-800 flex items-center gap-2', sortCol === col.key ? 'text-white' : 'text-neutral-400')}
              >
                <span className="w-4 text-center text-[10px] text-neutral-600">{col.icon || 'Aa'}</span>
                <span className="flex-1">{col.label}</span>
                {sortCol === col.key && <span className="text-neutral-500">{sortDir === 'asc' ? '↑' : '↓'}</span>}
              </button>
            ))}
          </div>
        </PortalDropdown>

        {/* Columns toggle */}
        <PortalDropdown
          trigger={
            <button onClick={() => setShowColumns(!showColumns)} className="px-2.5 py-1.5 text-xs text-neutral-400 border border-neutral-800 rounded-lg hover:text-white hover:bg-neutral-800/50 transition-colors flex items-center gap-1">
              <svg width="10" height="10" viewBox="0 0 10 10"><path d="M1 2h8M1 5h8M1 8h8" stroke="currentColor" strokeWidth="1" strokeLinecap="round"/></svg>
              Columns
            </button>
          }
          open={showColumns}
          onClose={() => setShowColumns(false)}
        >
          {Object.values(ALL_COLUMNS).map(col => {
            const active = visibleColumns.includes(col.key);
            return (
              <button key={col.key} onClick={() => setVisibleColumns(prev => active ? prev.filter(k => k !== col.key) : [...prev, col.key])} className="w-full text-left px-3 py-1.5 text-xs hover:bg-neutral-800 flex items-center gap-2">
                <span className={cn('w-3.5 h-3.5 rounded border flex items-center justify-center', active ? 'bg-white border-white' : 'border-neutral-600')}>
                  {active && <svg width="8" height="8" viewBox="0 0 8 8"><path d="M1.5 4l2 2 3-3.5" stroke="#000" strokeWidth="1.2" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                </span>
                <span className={active ? 'text-white' : 'text-neutral-500'}>{col.label}</span>
              </button>
            );
          })}
        </PortalDropdown>

        {/* Clear all */}
        {(activeFilters.length > 0 || groupBy) && (
          <button onClick={() => { setActiveFilters([]); setGroupBy(undefined); }} className="px-2.5 py-1.5 text-xs text-neutral-400 hover:text-white transition-colors">
            Clear all
          </button>
        )}
      </div>

      {/* Table */}
      <div className="flex-1 border border-neutral-800 rounded-lg overflow-hidden flex flex-col min-h-0">
        {/* Header */}
        <div className="shrink-0 border-b border-neutral-800 bg-neutral-900 overflow-hidden">
          <div ref={headerInnerRef} className="flex" style={{ minWidth: totalWidth }}>
            {columns.map(col => (
              <button key={col.key} onClick={() => handleSort(col.key)} className="text-left px-3 py-2 text-[11px] uppercase tracking-wider text-neutral-500 hover:text-white font-medium shrink-0 flex items-center gap-1" style={{ width: col.width }}>
                {col.label}
                {sortCol === col.key && <span className="text-white">{sortDir === 'asc' ? '↑' : '↓'}</span>}
              </button>
            ))}
          </div>
        </div>

        {/* Rows */}
        <div ref={parentRef} className="flex-1 overflow-auto" onScroll={handleBodyScroll}>
          {loading ? (
            <div className="flex items-center justify-center h-full text-neutral-500 text-sm">Loading...</div>
          ) : (
            <div style={{ height: virtualizer.getTotalSize(), position: 'relative', minWidth: totalWidth }}>
              {virtualItems.map(virtualRow => {
                const item = groupBy ? flatItems[virtualRow.index] : null;
                if (item?.type === 'header') {
                  return (
                    <div key={`header-${item.label}`} className="absolute left-0 right-0 flex items-center gap-2 px-3 bg-neutral-900/80 border-b border-neutral-800" style={{ height: 40, transform: `translateY(${virtualRow.start}px)` }}>
                      <svg width="8" height="8" viewBox="0 0 8 8" className="text-neutral-500"><path d="M1 2l3 3.5L7 2" fill="currentColor" /></svg>
                      {groupBy === 'notion_rarity' ? <Badge rarity={item.label}>{item.label}</Badge>
                        : groupBy === 'genre' ? <Badge variant="genre" colorKey={item.label}>{item.label}</Badge>
                        : groupBy === 'brand' ? <span className="text-sm font-medium text-white">{brandDisplay(item.label)}</span>
                        : <span className="text-sm font-medium text-white">{item.label === '(none)' ? 'Uncategorized' : item.label}</span>}
                      <span className="text-xs text-neutral-500">{item.count}</span>
                    </div>
                  );
                }
                const row = item?.type === 'row' ? item.row : rows[virtualRow.index];
                return (
                  <div key={row?.id || virtualRow.index} className="absolute left-0 right-0 flex items-center border-b border-neutral-800/50 hover:bg-neutral-800/30" style={{ height: ROW_HEIGHT, transform: `translateY(${virtualRow.start}px)` }}>
                    {row ? columns.map(col => (
                      <div key={col.key} className="px-3 text-sm truncate shrink-0 flex items-center" style={{ width: col.width, height: ROW_HEIGHT }}>
                        {col.editable ? (
                          <EditableCell
                            value={(row as unknown as Record<string, unknown>)[col.key]}
                            type={col.type || 'text'}
                            options={col.options}
                            onSave={(v) => handleCellSave(row, col.key, v)}
                            fieldVariant={col.key === 'notion_rarity' ? 'rarity' : col.key === 'notion_availability' ? 'availability' : col.key === 'notion_shipping' ? 'shipping' : col.key === 'genre' ? 'genre' : undefined}
                          />
                        ) : col.render ? col.render(row) : (
                          <span className="text-neutral-300">{String((row as unknown as Record<string, unknown>)[col.key] ?? '')}</span>
                        )}
                      </div>
                    )) : <div className="px-3 text-xs text-neutral-600 animate-pulse">Loading...</div>}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

