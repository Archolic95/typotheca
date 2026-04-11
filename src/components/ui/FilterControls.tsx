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

export function FilterPill({ label, options, selected, onChange, onRemove, multi }: {
  label: string;
  options: { value: string; label: string }[];
  selected: string[];
  onChange: (values: string[]) => void;
  onRemove: () => void;
  multi?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  const openMenu = () => {
    if (ref.current) {
      const rect = ref.current.getBoundingClientRect();
      setPos({ top: rect.bottom + 4, left: rect.left });
    }
    setOpen(true);
  };

  const filtered = search
    ? options.filter(o => o.label.toLowerCase().includes(search.toLowerCase()))
    : options;

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
            className="fixed z-[101] min-w-[200px] max-h-[320px] bg-neutral-900 border border-neutral-800 rounded-lg shadow-xl overflow-hidden"
            style={{ top: pos.top, left: Math.min(pos.left, window.innerWidth - 220) }}
          >
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
              {filtered.map(({ value, label: optLabel }) => {
                const active = selected.includes(value);
                return (
                  <button
                    key={value}
                    onClick={() => {
                      if (multi) {
                        onChange(active ? selected.filter(s => s !== value) : [...selected, value]);
                      } else {
                        onChange(active ? [] : [value]);
                        setOpen(false);
                        setSearch('');
                      }
                    }}
                    className={cn(
                      'w-full text-left px-3 py-1.5 text-xs hover:bg-neutral-800 flex items-center gap-2',
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
                );
              })}
              {filtered.length === 0 && (
                <div className="px-3 py-2 text-xs text-neutral-500">No matches</div>
              )}
            </div>
          </div>
        </>,
        document.body
      )}
    </>
  );
}
