'use client';

import { useState, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';
import { BRAND_DISPLAY, BRANDS } from '@/lib/constants';
import type { BrandFamily } from '@/lib/constants';

interface HierarchicalFilterPillProps {
  label: string;
  families: BrandFamily[];
  selected: string[];
  onChange: (values: string[]) => void;
  onRemove: () => void;
  onEditFamilies?: () => void;
}

export function HierarchicalFilterPill({
  label,
  families,
  selected,
  onChange,
  onRemove,
  onEditFamilies,
}: HierarchicalFilterPillProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  const openMenu = () => {
    if (ref.current) {
      const rect = ref.current.getBoundingClientRect();
      setPos({ top: rect.bottom + 4, left: rect.left });
    }
    setOpen(true);
  };

  const toggleCollapse = (key: string) => {
    setCollapsed(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  // Find brands not in any family
  const assignedBrands = useMemo(() => {
    const set = new Set<string>();
    for (const fam of families) {
      for (const b of fam.brands) set.add(b);
    }
    return set;
  }, [families]);

  const ungroupedBrands = useMemo(
    () => BRANDS.filter(b => !assignedBrands.has(b)),
    [assignedBrands],
  );

  const searchLower = search.toLowerCase();

  // Filter families/brands by search
  const filteredFamilies = useMemo(() => {
    if (!search) return families;
    return families.filter(fam => {
      if (fam.label.toLowerCase().includes(searchLower)) return true;
      return fam.brands.some(b =>
        (BRAND_DISPLAY[b] || b).toLowerCase().includes(searchLower),
      );
    });
  }, [families, search, searchLower]);

  const filteredUngrouped = useMemo(() => {
    if (!search) return ungroupedBrands;
    return ungroupedBrands.filter(b =>
      (BRAND_DISPLAY[b] || b).toLowerCase().includes(searchLower),
    );
  }, [ungroupedBrands, search, searchLower]);

  // Family selection helpers
  const toggleBrand = (brand: string) => {
    onChange(
      selected.includes(brand)
        ? selected.filter(s => s !== brand)
        : [...selected, brand],
    );
  };

  const toggleFamily = (fam: BrandFamily) => {
    const allSelected = fam.brands.every(b => selected.includes(b));
    if (allSelected) {
      // Deselect all in family
      onChange(selected.filter(s => !fam.brands.includes(s)));
    } else {
      // Select all in family
      const newSet = new Set(selected);
      for (const b of fam.brands) newSet.add(b);
      onChange([...newSet]);
    }
  };

  const getFamilyState = (fam: BrandFamily): 'all' | 'some' | 'none' => {
    const count = fam.brands.filter(b => selected.includes(b)).length;
    if (count === 0) return 'none';
    if (count === fam.brands.length) return 'all';
    return 'some';
  };

  return (
    <>
      <div ref={ref} className="flex items-center gap-0 bg-neutral-800 rounded-lg border border-neutral-700 overflow-hidden">
        <button
          onClick={openMenu}
          className="px-2.5 py-1.5 text-xs text-white flex items-center gap-1.5 hover:bg-neutral-700/50"
        >
          {label}
          {selected.length > 0 && (
            <span className="bg-white/10 px-1.5 rounded text-[10px]">{selected.length}</span>
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
          <div className="fixed inset-0 z-[100]" onClick={() => { setOpen(false); setSearch(''); }} />
          <div
            className="fixed z-[101] w-[280px] max-h-[420px] bg-neutral-900 border border-neutral-800 rounded-lg shadow-xl overflow-hidden flex flex-col"
            style={{ top: pos.top, left: Math.min(pos.left, window.innerWidth - 300) }}
          >
            {/* Search */}
            <div className="px-2.5 py-2 border-b border-neutral-800">
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search brands..."
                className="w-full bg-transparent text-xs text-white outline-none placeholder:text-neutral-500"
                autoFocus
              />
            </div>

            {/* Scrollable list */}
            <div className="overflow-y-auto flex-1">
              {filteredFamilies.map(fam => {
                const state = getFamilyState(fam);
                const isCollapsed = collapsed.has(fam.key) && !search;
                const visibleBrands = search
                  ? fam.brands.filter(b => (BRAND_DISPLAY[b] || b).toLowerCase().includes(searchLower) || fam.label.toLowerCase().includes(searchLower))
                  : fam.brands;

                return (
                  <div key={fam.key}>
                    {/* Family header */}
                    <div className="flex items-center gap-1 px-2 py-1.5 hover:bg-neutral-800/50">
                      <button
                        onClick={() => toggleCollapse(fam.key)}
                        className="w-4 h-4 flex items-center justify-center text-neutral-500"
                      >
                        <svg
                          width="8" height="8" viewBox="0 0 8 8"
                          className={cn('transition-transform duration-150', isCollapsed ? '-rotate-90' : '')}
                        >
                          <path d="M1 2l3 3.5L7 2" fill="currentColor" />
                        </svg>
                      </button>
                      <button
                        onClick={() => toggleFamily(fam)}
                        className="flex items-center gap-2 flex-1 text-left"
                      >
                        <span className={cn(
                          'w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0',
                          state === 'all' ? 'bg-white border-white' : state === 'some' ? 'bg-white/40 border-white/60' : 'border-neutral-600',
                        )}>
                          {state === 'all' && (
                            <svg width="8" height="8" viewBox="0 0 8 8">
                              <path d="M1.5 4l2 2 3-3.5" stroke="#000" strokeWidth="1.2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          )}
                          {state === 'some' && (
                            <svg width="8" height="8" viewBox="0 0 8 8">
                              <path d="M2 4h4" stroke="#000" strokeWidth="1.5" strokeLinecap="round" />
                            </svg>
                          )}
                        </span>
                        <span className="text-xs font-medium text-white">{fam.label}</span>
                        <span className="text-[10px] text-neutral-500 ml-auto">{fam.brands.length}</span>
                      </button>
                    </div>

                    {/* Individual brands */}
                    {!isCollapsed && visibleBrands.map(brand => {
                      const active = selected.includes(brand);
                      return (
                        <button
                          key={brand}
                          onClick={() => toggleBrand(brand)}
                          className={cn(
                            'w-full text-left pl-9 pr-3 py-1 text-xs hover:bg-neutral-800 flex items-center gap-2',
                            active ? 'text-white' : 'text-neutral-400',
                          )}
                        >
                          <span className={cn(
                            'w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0',
                            active ? 'bg-white border-white' : 'border-neutral-600',
                          )}>
                            {active && (
                              <svg width="8" height="8" viewBox="0 0 8 8">
                                <path d="M1.5 4l2 2 3-3.5" stroke="#000" strokeWidth="1.2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                            )}
                          </span>
                          {BRAND_DISPLAY[brand] || brand}
                        </button>
                      );
                    })}
                  </div>
                );
              })}

              {/* Ungrouped brands */}
              {filteredUngrouped.length > 0 && (
                <div>
                  <div className="flex items-center gap-1 px-2 py-1.5 hover:bg-neutral-800/50">
                    <button
                      onClick={() => toggleCollapse('__ungrouped')}
                      className="w-4 h-4 flex items-center justify-center text-neutral-500"
                    >
                      <svg
                        width="8" height="8" viewBox="0 0 8 8"
                        className={cn('transition-transform duration-150', collapsed.has('__ungrouped') && !search ? '-rotate-90' : '')}
                      >
                        <path d="M1 2l3 3.5L7 2" fill="currentColor" />
                      </svg>
                    </button>
                    <span className="text-xs font-medium text-neutral-400">Other</span>
                    <span className="text-[10px] text-neutral-500 ml-auto">{ungroupedBrands.length}</span>
                  </div>
                  {!(collapsed.has('__ungrouped') && !search) && filteredUngrouped.map(brand => {
                    const active = selected.includes(brand);
                    return (
                      <button
                        key={brand}
                        onClick={() => toggleBrand(brand)}
                        className={cn(
                          'w-full text-left pl-9 pr-3 py-1 text-xs hover:bg-neutral-800 flex items-center gap-2',
                          active ? 'text-white' : 'text-neutral-400',
                        )}
                      >
                        <span className={cn(
                          'w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0',
                          active ? 'bg-white border-white' : 'border-neutral-600',
                        )}>
                          {active && (
                            <svg width="8" height="8" viewBox="0 0 8 8">
                              <path d="M1.5 4l2 2 3-3.5" stroke="#000" strokeWidth="1.2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          )}
                        </span>
                        {BRAND_DISPLAY[brand] || brand}
                      </button>
                    );
                  })}
                </div>
              )}

              {filteredFamilies.length === 0 && filteredUngrouped.length === 0 && (
                <div className="px-3 py-2 text-xs text-neutral-500">No matches</div>
              )}
            </div>

            {/* Footer with edit link */}
            {onEditFamilies && (
              <div className="border-t border-neutral-800 px-3 py-2">
                <button
                  onClick={() => { setOpen(false); setSearch(''); onEditFamilies(); }}
                  className="text-[10px] text-neutral-500 hover:text-white flex items-center gap-1"
                >
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1">
                    <path d="M7.5 1.5l1 1-5 5H2.5V6.5l5-5z" />
                  </svg>
                  Edit families
                </button>
              </div>
            )}
          </div>
        </>,
        document.body,
      )}
    </>
  );
}
