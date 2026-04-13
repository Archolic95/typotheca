'use client';

import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';

// ── Portal Dropdown ─────────────────────────────────────────────────────

export function PortalDropdown({ trigger, children, open, onClose }: {
  trigger: React.ReactNode;
  children: React.ReactNode;
  open: boolean;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  useEffect(() => {
    if (open && ref.current) {
      const rect = ref.current.getBoundingClientRect();
      setPos({ top: rect.bottom + 4, left: rect.left });
    }
  }, [open]);

  return (
    <div ref={ref} className="inline-flex">
      {trigger}
      {open && pos && createPortal(
        <>
          <div className="fixed inset-0 z-[100]" onClick={onClose} />
          <div
            className="fixed z-[101] min-w-[200px] max-h-[320px] overflow-y-auto bg-neutral-900 border border-neutral-800 rounded-lg shadow-xl py-1"
            style={{ top: pos.top, left: Math.min(pos.left, window.innerWidth - 220) }}
          >
            {children}
          </div>
        </>,
        document.body
      )}
    </div>
  );
}

// ── Filter Pill ─────────────────────────────────────────────────────────

// Operator types for multi-select filters
export type FilterOperator = 'contains' | 'not_contains' | 'is_empty' | 'is_not_empty';

const OPERATOR_LABELS: Record<FilterOperator, string> = {
  contains: 'Contains',
  not_contains: 'Does not contain',
  is_empty: 'Is empty',
  is_not_empty: 'Is not empty',
};

/** Decode operator from stored values: !val = not_contains, __empty/__notempty = special */
export function decodeFilterValues(values: string[]): { operator: FilterOperator; cleanValues: string[] } {
  if (values.length === 1 && values[0] === '__empty') return { operator: 'is_empty', cleanValues: [] };
  if (values.length === 1 && values[0] === '__notempty') return { operator: 'is_not_empty', cleanValues: [] };
  if (values.length > 0 && values[0].startsWith('!')) return { operator: 'not_contains', cleanValues: values.map(v => v.replace(/^!/, '')) };
  return { operator: 'contains', cleanValues: values };
}

/** Encode operator + values back to stored format */
export function encodeFilterValues(operator: FilterOperator, values: string[]): string[] {
  if (operator === 'is_empty') return ['__empty'];
  if (operator === 'is_not_empty') return ['__notempty'];
  if (operator === 'not_contains') return values.map(v => '!' + v);
  return values;
}

export function FilterPill({ label, options, selected, onChange, onRemove, multi, onReorder }: {
  label: string;
  options: { value: string; label: string }[];
  selected: string[];
  onChange: (values: string[]) => void;
  onRemove: () => void;
  multi?: boolean;
  onReorder?: (newOptions: { value: string; label: string }[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

  // Decode current operator from stored values
  const { operator, cleanValues } = decodeFilterValues(selected);
  const [currentOp, setCurrentOp] = useState<FilterOperator>(operator);

  // Sync operator when selected changes externally
  const prevOpRef = useRef(operator);
  if (operator !== prevOpRef.current) { prevOpRef.current = operator; if (currentOp !== operator) setCurrentOp(operator); }

  const showValues = currentOp === 'contains' || currentOp === 'not_contains';

  const openMenu = () => {
    if (ref.current) {
      const rect = ref.current.getBoundingClientRect();
      setPos({ top: rect.bottom + 4, left: rect.left });
    }
    setOpen(true);
  };

  const handleOpChange = (op: FilterOperator) => {
    setCurrentOp(op);
    if (op === 'is_empty' || op === 'is_not_empty') {
      onChange(encodeFilterValues(op, []));
    } else {
      // Switch between contains/not_contains — keep same values
      onChange(encodeFilterValues(op, cleanValues));
    }
  };

  const handleValueToggle = (value: string) => {
    const next = cleanValues.includes(value)
      ? cleanValues.filter(v => v !== value)
      : [...cleanValues, value];
    onChange(encodeFilterValues(currentOp, next));
  };

  const filtered = search
    ? options.filter(o => o.label.toLowerCase().includes(search.toLowerCase()))
    : options;

  // Display label for the pill
  const pillSuffix = (() => {
    if (currentOp === 'is_empty') return ': empty';
    if (currentOp === 'is_not_empty') return ': not empty';
    if (currentOp === 'not_contains' && cleanValues.length > 0) return ` ≠ ${cleanValues.length}`;
    if (cleanValues.length > 0) return '';
    return '';
  })();

  return (
    <>
      <div ref={ref} className="flex items-center gap-0 bg-neutral-800 rounded-lg border border-neutral-700 overflow-hidden">
        <button
          onClick={openMenu}
          className="px-2.5 py-1.5 text-xs text-white flex items-center gap-1.5 hover:bg-neutral-700/50"
        >
          {label}
          {pillSuffix && <span className="text-neutral-400">{pillSuffix}</span>}
          {!pillSuffix && cleanValues.length > 0 && (
            <span className="bg-white/10 px-1.5 rounded text-[10px]">{cleanValues.length}</span>
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
            className="fixed z-[101] min-w-[220px] max-h-[380px] bg-neutral-900 border border-neutral-800 rounded-lg shadow-xl overflow-hidden"
            style={{ top: pos.top, left: Math.min(pos.left, window.innerWidth - 240) }}
          >
            {/* Operator selector */}
            {multi && (
              <div className="px-1.5 py-1.5 border-b border-neutral-800 flex flex-wrap gap-1">
                {(Object.entries(OPERATOR_LABELS) as [FilterOperator, string][]).map(([op, opLabel]) => (
                  <button
                    key={op}
                    onClick={() => handleOpChange(op)}
                    className={cn(
                      'px-2 py-1 text-[10px] rounded',
                      currentOp === op ? 'bg-white/15 text-white' : 'text-neutral-500 hover:text-neutral-300 hover:bg-neutral-800',
                    )}
                  >
                    {opLabel}
                  </button>
                ))}
              </div>
            )}
            {/* Value picker (hidden for is_empty / is_not_empty) */}
            {showValues && (
              <>
                {options.length > 8 && (
                  <div className="px-2.5 py-2 border-b border-neutral-800">
                    <input
                      value={search}
                      onChange={e => setSearch(e.target.value)}
                      placeholder="Search..."
                      className="w-full bg-transparent text-xs text-white outline-none placeholder:text-neutral-500"
                      autoFocus
                    />
                  </div>
                )}
                <div className="overflow-y-auto max-h-[260px]">
                  {filtered.map(({ value, label: optLabel }, idx) => {
                    const active = cleanValues.includes(value);
                    const canDrag = onReorder && !search; // only drag when not searching
                    return (
                      <div
                        key={value}
                        draggable={canDrag ? true : undefined}
                        onDragStart={canDrag ? () => setDragIdx(idx) : undefined}
                        onDragOver={canDrag ? (e) => { e.preventDefault(); setDragOverIdx(idx); } : undefined}
                        onDragEnd={canDrag ? () => {
                          if (dragIdx !== null && dragOverIdx !== null && dragIdx !== dragOverIdx) {
                            const reordered = [...filtered];
                            const [moved] = reordered.splice(dragIdx, 1);
                            reordered.splice(dragOverIdx, 0, moved);
                            onReorder(reordered);
                          }
                          setDragIdx(null);
                          setDragOverIdx(null);
                        } : undefined}
                        className={cn(
                          'flex items-center',
                          dragOverIdx === idx && dragIdx !== null && dragIdx !== idx && 'border-t border-blue-500',
                        )}
                      >
                        {canDrag && (
                          <span className="px-1 text-neutral-600 cursor-grab active:cursor-grabbing select-none text-[10px]">⠿</span>
                        )}
                        <button
                          onClick={() => {
                            if (multi) {
                              handleValueToggle(value);
                            } else {
                              onChange(active ? [] : [value]);
                              setOpen(false);
                              setSearch('');
                            }
                          }}
                          className={cn(
                            'flex-1 text-left pr-3 py-1.5 text-xs hover:bg-neutral-800 flex items-center gap-2',
                            canDrag ? 'pl-0.5' : 'pl-3',
                            active ? 'text-white' : 'text-neutral-400',
                          )}
                        >
                          {multi && (
                            <span className={cn(
                              'w-3.5 h-3.5 rounded border flex items-center justify-center',
                              active ? 'bg-white border-white' : 'border-neutral-600',
                            )}>
                              {active && (
                                <svg width="8" height="8" viewBox="0 0 8 8">
                                  <path d="M1.5 4l2 2 3-3.5" stroke="#000" strokeWidth="1.2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                              )}
                            </span>
                          )}
                          {optLabel}
                        </button>
                      </div>
                    );
                  })}
                  {filtered.length === 0 && (
                    <div className="px-3 py-2 text-xs text-neutral-500">No matches</div>
                  )}
                </div>
              </>
            )}
          </div>
        </>,
        document.body
      )}
    </>
  );
}
