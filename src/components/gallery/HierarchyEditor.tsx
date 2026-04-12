'use client';

import { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';
import { BRANDS, BRAND_DISPLAY, DEFAULT_BRAND_FAMILIES, DEFAULT_CATEGORY_HIERARCHY } from '@/lib/constants';
import type { BrandFamily } from '@/lib/constants';

interface HierarchyEditorProps {
  open: boolean;
  onClose: () => void;
  // Brand families
  brandFamilies: BrandFamily[];
  onUpdateBrandFamilies: (families: BrandFamily[]) => void;
  onResetBrandFamilies: () => void;
  // Category hierarchy
  categoryHierarchy: Record<string, string[]>;
  onUpdateCategoryHierarchy: (h: Record<string, string[]>) => void;
  onResetCategoryHierarchy: () => void;
}

type Tab = 'brands' | 'categories';

export function HierarchyEditor({
  open,
  onClose,
  brandFamilies,
  onUpdateBrandFamilies,
  onResetBrandFamilies,
  categoryHierarchy,
  onUpdateCategoryHierarchy,
  onResetCategoryHierarchy,
}: HierarchyEditorProps) {
  const [tab, setTab] = useState<Tab>('brands');
  const [editingFamily, setEditingFamily] = useState<string | null>(null);
  const [editingCat, setEditingCat] = useState<string | null>(null);
  const [newFamilyName, setNewFamilyName] = useState('');
  const [newCatName, setNewCatName] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [addingSubcatTo, setAddingSubcatTo] = useState<string | null>(null);
  const [newSubcat, setNewSubcat] = useState('');

  if (!open) return null;

  const toggleExpand = (key: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  // ── Brand families ──────────────────────────────────────────────────

  const assignedBrands = useMemo(() => {
    const set = new Set<string>();
    for (const fam of brandFamilies) {
      for (const b of fam.brands) set.add(b);
    }
    return set;
  }, [brandFamilies]);

  const ungroupedBrands = BRANDS.filter(b => !assignedBrands.has(b));

  const renameFamily = (key: string, newLabel: string) => {
    onUpdateBrandFamilies(
      brandFamilies.map(f => f.key === key ? { ...f, label: newLabel } : f),
    );
    setEditingFamily(null);
  };

  const deleteFamily = (key: string) => {
    onUpdateBrandFamilies(brandFamilies.filter(f => f.key !== key));
  };

  const addFamily = () => {
    if (!newFamilyName.trim()) return;
    const key = newFamilyName.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-');
    onUpdateBrandFamilies([...brandFamilies, { key, label: newFamilyName.trim(), brands: [] }]);
    setNewFamilyName('');
  };

  const moveBrand = (brand: string, toFamilyKey: string | null) => {
    onUpdateBrandFamilies(
      brandFamilies.map(f => {
        const without = f.brands.filter(b => b !== brand);
        if (f.key === toFamilyKey) return { ...f, brands: [...without, brand] };
        return { ...f, brands: without };
      }),
    );
  };

  const removeBrandFromFamily = (brand: string) => {
    onUpdateBrandFamilies(
      brandFamilies.map(f => ({ ...f, brands: f.brands.filter(b => b !== brand) })),
    );
  };

  // ── Category hierarchy ──────────────────────────────────────────────

  const renameCat = (oldName: string, newName: string) => {
    if (!newName.trim() || newName === oldName) { setEditingCat(null); return; }
    const updated: Record<string, string[]> = {};
    for (const [k, v] of Object.entries(categoryHierarchy)) {
      updated[k === oldName ? newName.trim() : k] = v;
    }
    onUpdateCategoryHierarchy(updated);
    setEditingCat(null);
  };

  const deleteCat = (name: string) => {
    const updated = { ...categoryHierarchy };
    delete updated[name];
    onUpdateCategoryHierarchy(updated);
  };

  const addCat = () => {
    if (!newCatName.trim()) return;
    onUpdateCategoryHierarchy({ ...categoryHierarchy, [newCatName.trim()]: [] });
    setNewCatName('');
  };

  const addSubcat = (cat: string) => {
    if (!newSubcat.trim()) return;
    onUpdateCategoryHierarchy({
      ...categoryHierarchy,
      [cat]: [...(categoryHierarchy[cat] || []), newSubcat.trim()],
    });
    setNewSubcat('');
    setAddingSubcatTo(null);
  };

  const removeSubcat = (cat: string, subcat: string) => {
    onUpdateCategoryHierarchy({
      ...categoryHierarchy,
      [cat]: (categoryHierarchy[cat] || []).filter(s => s !== subcat),
    });
  };

  return createPortal(
    <>
      <div className="fixed inset-0 bg-black/60 z-[200]" onClick={onClose} />
      <div className="fixed inset-y-4 right-4 w-[400px] bg-neutral-900 border border-neutral-800 rounded-xl shadow-2xl z-[201] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-800">
          <h2 className="text-sm font-semibold text-white">Edit Hierarchy</h2>
          <button onClick={onClose} className="text-neutral-500 hover:text-white">
            <svg width="14" height="14" viewBox="0 0 14 14">
              <path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-neutral-800">
          <button
            onClick={() => setTab('brands')}
            className={cn('flex-1 px-4 py-2 text-xs font-medium', tab === 'brands' ? 'text-white border-b-2 border-white' : 'text-neutral-500 hover:text-white')}
          >
            Brand Families
          </button>
          <button
            onClick={() => setTab('categories')}
            className={cn('flex-1 px-4 py-2 text-xs font-medium', tab === 'categories' ? 'text-white border-b-2 border-white' : 'text-neutral-500 hover:text-white')}
          >
            Categories
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {tab === 'brands' ? (
            <>
              {brandFamilies.map(fam => (
                <div key={fam.key} className="border border-neutral-800 rounded-lg overflow-hidden">
                  {/* Family header */}
                  <div className="flex items-center gap-2 px-3 py-2 bg-neutral-800/30">
                    <button onClick={() => toggleExpand(fam.key)} className="text-neutral-500">
                      <svg width="8" height="8" viewBox="0 0 8 8" className={cn('transition-transform', expanded.has(fam.key) ? '' : '-rotate-90')}>
                        <path d="M1 2l3 3.5L7 2" fill="currentColor" />
                      </svg>
                    </button>
                    {editingFamily === fam.key ? (
                      <input
                        autoFocus
                        defaultValue={fam.label}
                        onBlur={e => renameFamily(fam.key, e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') renameFamily(fam.key, (e.target as HTMLInputElement).value); if (e.key === 'Escape') setEditingFamily(null); }}
                        className="flex-1 bg-neutral-800 border border-neutral-700 rounded px-1.5 py-0.5 text-xs text-white outline-none"
                      />
                    ) : (
                      <span
                        className="flex-1 text-xs font-medium text-white cursor-pointer hover:text-neutral-300"
                        onClick={() => setEditingFamily(fam.key)}
                        title="Click to rename"
                      >
                        {fam.label}
                      </span>
                    )}
                    <span className="text-[10px] text-neutral-500">{fam.brands.length}</span>
                    <button onClick={() => deleteFamily(fam.key)} className="text-neutral-600 hover:text-red-400" title="Delete family">
                      <svg width="10" height="10" viewBox="0 0 10 10">
                        <path d="M2 2l6 6M8 2l-6 6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                      </svg>
                    </button>
                  </div>

                  {/* Brands in family */}
                  {expanded.has(fam.key) && (
                    <div className="divide-y divide-neutral-800/50">
                      {fam.brands.map(brand => (
                        <div key={brand} className="flex items-center gap-2 px-3 py-1.5 pl-8 text-xs text-neutral-300 hover:bg-neutral-800/30">
                          <span className="flex-1">{BRAND_DISPLAY[brand] || brand}</span>
                          {/* Move dropdown */}
                          <select
                            value={fam.key}
                            onChange={e => moveBrand(brand, e.target.value || null)}
                            className="bg-neutral-800 border border-neutral-700 rounded text-[10px] text-neutral-400 px-1 py-0.5 outline-none"
                          >
                            {brandFamilies.map(f => (
                              <option key={f.key} value={f.key}>{f.label}</option>
                            ))}
                          </select>
                          <button onClick={() => removeBrandFromFamily(brand)} className="text-neutral-600 hover:text-red-400">
                            <svg width="8" height="8" viewBox="0 0 8 8">
                              <path d="M1 1l6 6M7 1l-6 6" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
                            </svg>
                          </button>
                        </div>
                      ))}
                      {fam.brands.length === 0 && (
                        <div className="px-3 py-2 pl-8 text-[10px] text-neutral-600">No brands assigned</div>
                      )}
                    </div>
                  )}
                </div>
              ))}

              {/* Ungrouped brands */}
              {ungroupedBrands.length > 0 && (
                <div className="border border-neutral-800 rounded-lg overflow-hidden">
                  <div className="flex items-center gap-2 px-3 py-2 bg-neutral-800/30">
                    <button onClick={() => toggleExpand('__ungrouped')} className="text-neutral-500">
                      <svg width="8" height="8" viewBox="0 0 8 8" className={cn('transition-transform', expanded.has('__ungrouped') ? '' : '-rotate-90')}>
                        <path d="M1 2l3 3.5L7 2" fill="currentColor" />
                      </svg>
                    </button>
                    <span className="flex-1 text-xs font-medium text-neutral-400">Ungrouped</span>
                    <span className="text-[10px] text-neutral-500">{ungroupedBrands.length}</span>
                  </div>
                  {expanded.has('__ungrouped') && (
                    <div className="divide-y divide-neutral-800/50">
                      {ungroupedBrands.map(brand => (
                        <div key={brand} className="flex items-center gap-2 px-3 py-1.5 pl-8 text-xs text-neutral-400 hover:bg-neutral-800/30">
                          <span className="flex-1">{BRAND_DISPLAY[brand] || brand}</span>
                          <select
                            value=""
                            onChange={e => { if (e.target.value) moveBrand(brand, e.target.value); }}
                            className="bg-neutral-800 border border-neutral-700 rounded text-[10px] text-neutral-500 px-1 py-0.5 outline-none"
                          >
                            <option value="">Assign to...</option>
                            {brandFamilies.map(f => (
                              <option key={f.key} value={f.key}>{f.label}</option>
                            ))}
                          </select>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Add new family */}
              <div className="flex items-center gap-2">
                <input
                  value={newFamilyName}
                  onChange={e => setNewFamilyName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') addFamily(); }}
                  placeholder="New family name..."
                  className="flex-1 bg-neutral-800 border border-neutral-700 rounded px-2.5 py-1.5 text-xs text-white outline-none placeholder:text-neutral-600 focus:border-neutral-600"
                />
                <button onClick={addFamily} className="px-3 py-1.5 text-xs text-white bg-neutral-700 hover:bg-neutral-600 rounded transition-colors">
                  Add
                </button>
              </div>
            </>
          ) : (
            /* ── Categories tab ──────────────────────────────────── */
            <>
              {Object.entries(categoryHierarchy).map(([cat, subcats]) => (
                <div key={cat} className="border border-neutral-800 rounded-lg overflow-hidden">
                  <div className="flex items-center gap-2 px-3 py-2 bg-neutral-800/30">
                    <button onClick={() => toggleExpand(`cat:${cat}`)} className="text-neutral-500">
                      <svg width="8" height="8" viewBox="0 0 8 8" className={cn('transition-transform', expanded.has(`cat:${cat}`) ? '' : '-rotate-90')}>
                        <path d="M1 2l3 3.5L7 2" fill="currentColor" />
                      </svg>
                    </button>
                    {editingCat === cat ? (
                      <input
                        autoFocus
                        defaultValue={cat}
                        onBlur={e => renameCat(cat, e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') renameCat(cat, (e.target as HTMLInputElement).value); if (e.key === 'Escape') setEditingCat(null); }}
                        className="flex-1 bg-neutral-800 border border-neutral-700 rounded px-1.5 py-0.5 text-xs text-white outline-none"
                      />
                    ) : (
                      <span
                        className="flex-1 text-xs font-medium text-white cursor-pointer hover:text-neutral-300"
                        onClick={() => setEditingCat(cat)}
                        title="Click to rename"
                      >
                        {cat}
                      </span>
                    )}
                    <span className="text-[10px] text-neutral-500">{subcats.length}</span>
                    <button onClick={() => deleteCat(cat)} className="text-neutral-600 hover:text-red-400" title="Delete category">
                      <svg width="10" height="10" viewBox="0 0 10 10">
                        <path d="M2 2l6 6M8 2l-6 6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                      </svg>
                    </button>
                  </div>
                  {expanded.has(`cat:${cat}`) && (
                    <div className="divide-y divide-neutral-800/50">
                      {subcats.map(sub => (
                        <div key={sub} className="flex items-center gap-2 px-3 py-1.5 pl-8 text-xs text-neutral-300 hover:bg-neutral-800/30">
                          <span className="flex-1">{sub}</span>
                          <button onClick={() => removeSubcat(cat, sub)} className="text-neutral-600 hover:text-red-400">
                            <svg width="8" height="8" viewBox="0 0 8 8">
                              <path d="M1 1l6 6M7 1l-6 6" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
                            </svg>
                          </button>
                        </div>
                      ))}
                      {/* Add subcategory */}
                      {addingSubcatTo === cat ? (
                        <div className="flex items-center gap-1 px-3 py-1.5 pl-8">
                          <input
                            autoFocus
                            value={newSubcat}
                            onChange={e => setNewSubcat(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') addSubcat(cat); if (e.key === 'Escape') { setAddingSubcatTo(null); setNewSubcat(''); } }}
                            placeholder="Subcategory name..."
                            className="flex-1 bg-neutral-800 border border-neutral-700 rounded px-1.5 py-0.5 text-xs text-white outline-none placeholder:text-neutral-600"
                          />
                          <button onClick={() => addSubcat(cat)} className="text-xs text-neutral-400 hover:text-white">Add</button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setAddingSubcatTo(cat)}
                          className="w-full text-left px-3 py-1.5 pl-8 text-[10px] text-neutral-600 hover:text-neutral-400"
                        >
                          + Add subcategory
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ))}

              {/* Add new category */}
              <div className="flex items-center gap-2">
                <input
                  value={newCatName}
                  onChange={e => setNewCatName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') addCat(); }}
                  placeholder="New category name..."
                  className="flex-1 bg-neutral-800 border border-neutral-700 rounded px-2.5 py-1.5 text-xs text-white outline-none placeholder:text-neutral-600 focus:border-neutral-600"
                />
                <button onClick={addCat} className="px-3 py-1.5 text-xs text-white bg-neutral-700 hover:bg-neutral-600 rounded transition-colors">
                  Add
                </button>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-neutral-800">
          <button
            onClick={() => {
              if (tab === 'brands') onResetBrandFamilies();
              else onResetCategoryHierarchy();
            }}
            className="text-xs text-neutral-500 hover:text-white"
          >
            Reset to defaults
          </button>
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-xs text-white bg-neutral-700 hover:bg-neutral-600 rounded transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </>,
    document.body,
  );
}
