'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Badge } from '@/components/ui/Badge';

interface EditableCellProps {
  value: unknown;
  type: 'text' | 'select' | 'multi-select' | 'boolean' | 'number';
  options?: string[];
  onSave: (value: unknown) => void;
  fieldVariant?: 'rarity' | 'genre' | 'availability' | 'shipping';
}

export function EditableCell({ value, type, options, onSave, fieldVariant }: EditableCellProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [dropdownPos, setDropdownPos] = useState<{ top: number; left: number; maxHeight: number } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const openDropdown = useCallback(() => {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom - 8;
      const spaceAbove = rect.top - 8;
      const preferBelow = spaceBelow >= 120;
      const maxH = Math.min(280, preferBelow ? spaceBelow : spaceAbove);
      const top = preferBelow ? rect.bottom + 2 : rect.top - maxH - 2;
      setDropdownPos({ top, left: rect.left, maxHeight: maxH });
    }
    setEditing(true);
  }, []);

  const closeDropdown = useCallback(() => {
    setEditing(false);
    setDropdownPos(null);
    setDraft('');
  }, []);

  const renderBadge = (val: string) => {
    if (fieldVariant === 'rarity') return <Badge rarity={val}>{val}</Badge>;
    if (fieldVariant) return <Badge variant={fieldVariant} colorKey={val}>{val}</Badge>;
    return <span className="text-neutral-300 text-xs">{val}</span>;
  };

  // Boolean: single click toggles
  if (type === 'boolean') {
    const boolVal = !!value;
    return (
      <button onClick={() => onSave(!boolVal)} className="flex items-center h-full">
        <span className={`w-4 h-4 rounded border flex items-center justify-center ${
          boolVal ? 'bg-emerald-500 border-emerald-500' : 'border-neutral-600'
        }`}>
          {boolVal && (
            <svg width="10" height="10" viewBox="0 0 10 10">
              <path d="M2 5l2.5 2.5L8 3" stroke="white" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          )}
        </span>
      </button>
    );
  }

  // Select: portal dropdown
  if (type === 'select' && options) {
    return (
      <>
        <button ref={triggerRef} onClick={openDropdown} className="h-full flex items-center cursor-pointer">
          {(value as string) ? renderBadge(value as string) : <span className="text-neutral-600 text-xs">-</span>}
        </button>
        {editing && dropdownPos && createPortal(
          <>
            <div className="fixed inset-0 z-[100]" onClick={closeDropdown} />
            <div
              className="fixed z-[101] bg-neutral-900 border border-neutral-700 rounded-lg shadow-2xl py-1 min-w-[160px] overflow-y-auto"
              style={{ top: dropdownPos.top, left: dropdownPos.left, maxHeight: dropdownPos.maxHeight }}
            >
              <button
                onClick={() => { onSave(null); closeDropdown(); }}
                className="w-full text-left px-3 py-1.5 text-xs text-neutral-500 hover:bg-neutral-800"
              >
                (none)
              </button>
              {options.map(opt => (
                <button
                  key={opt}
                  onClick={() => { onSave(opt); closeDropdown(); }}
                  className={`w-full text-left px-3 py-1.5 text-xs hover:bg-neutral-800 ${
                    value === opt ? 'text-white bg-neutral-800/50' : 'text-neutral-400'
                  }`}
                >
                  {renderBadge(opt)}
                </button>
              ))}
            </div>
          </>,
          document.body
        )}
      </>
    );
  }

  // Multi-select with options: Notion-style checkbox dropdown via portal
  if (type === 'multi-select' && options) {
    const arr = (Array.isArray(value) ? value : []) as string[];
    const filteredOptions = draft
      ? options.filter(o => o.toLowerCase().includes(draft.toLowerCase()))
      : options;

    return (
      <>
        <button ref={triggerRef} onClick={openDropdown} className="h-full flex items-center gap-0.5 overflow-hidden cursor-pointer">
          {arr.length > 0 ? (
            arr.map(g => (
              fieldVariant === 'genre'
                ? <Badge key={g} variant="genre" colorKey={g} className="text-[10px] py-0">{g}</Badge>
                : <Badge key={g} className="text-[10px] py-0">{g}</Badge>
            ))
          ) : (
            <span className="text-neutral-600 text-xs">-</span>
          )}
        </button>
        {editing && dropdownPos && createPortal(
          <>
            <div className="fixed inset-0 z-[100]" onClick={closeDropdown} />
            <div
              className="fixed z-[101] bg-neutral-900 border border-neutral-700 rounded-lg shadow-2xl overflow-hidden"
              style={{ top: dropdownPos.top, left: dropdownPos.left, maxHeight: dropdownPos.maxHeight, minWidth: 220 }}
            >
              <div className="px-2.5 py-2 border-b border-neutral-800">
                <input
                  ref={inputRef}
                  value={draft}
                  onChange={e => setDraft(e.target.value)}
                  placeholder="Search..."
                  className="w-full bg-transparent text-xs text-white outline-none placeholder:text-neutral-500"
                />
              </div>
              <div className="overflow-y-auto" style={{ maxHeight: dropdownPos.maxHeight - 40 }}>
                {filteredOptions.map(opt => {
                  const active = arr.includes(opt);
                  return (
                    <button
                      key={opt}
                      onClick={() => {
                        onSave(active ? arr.filter(v => v !== opt) : [...arr, opt]);
                      }}
                      className="w-full text-left px-3 py-1.5 text-xs hover:bg-neutral-800 flex items-center gap-2"
                    >
                      <span className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 ${
                        active ? 'bg-white border-white' : 'border-neutral-600'
                      }`}>
                        {active && <svg width="8" height="8" viewBox="0 0 8 8"><path d="M1.5 4l2 2 3-3.5" stroke="#000" strokeWidth="1.2" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                      </span>
                      {renderBadge(opt)}
                    </button>
                  );
                })}
                {filteredOptions.length === 0 && (
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

  // Multi-select without predefined options: fallback text input
  if (type === 'multi-select') {
    const arr = (Array.isArray(value) ? value : []) as string[];
    if (editing) {
      return (
        <div className="flex items-center gap-1 h-full">
          <input
            ref={inputRef}
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && draft.trim()) {
                onSave([...arr, draft.trim()]);
                setDraft('');
              }
              if (e.key === 'Escape') setEditing(false);
              if (e.key === 'Backspace' && !draft && arr.length) {
                onSave(arr.slice(0, -1));
              }
            }}
            onBlur={() => setEditing(false)}
            className="bg-transparent text-xs text-white outline-none w-16"
            placeholder="Add..."
          />
        </div>
      );
    }
    return (
      <button onClick={() => setEditing(true)} className="h-full flex items-center gap-0.5 overflow-hidden cursor-pointer">
        {arr.length > 0 ? (
          arr.map(g => (
            fieldVariant === 'genre'
              ? <Badge key={g} variant="genre" colorKey={g} className="text-[10px] py-0">{g}</Badge>
              : <Badge key={g} className="text-[10px] py-0">{g}</Badge>
          ))
        ) : (
          <span className="text-neutral-600 text-xs">-</span>
        )}
      </button>
    );
  }

  // Number
  if (type === 'number') {
    if (editing) {
      return (
        <input
          ref={inputRef}
          type="number"
          defaultValue={value != null ? String(value) : ''}
          onKeyDown={e => {
            if (e.key === 'Enter') {
              const v = e.currentTarget.value;
              onSave(v ? Number(v) : null);
              setEditing(false);
            }
            if (e.key === 'Escape') setEditing(false);
          }}
          onBlur={e => {
            const v = e.currentTarget.value;
            onSave(v ? Number(v) : null);
            setEditing(false);
          }}
          className="bg-transparent text-sm text-white outline-none w-full"
        />
      );
    }
    return (
      <button onClick={() => setEditing(true)} className="h-full flex items-center cursor-pointer">
        <span className={value != null ? 'text-neutral-300 text-xs' : 'text-neutral-600 text-xs'}>
          {value != null ? String(value) : '-'}
        </span>
      </button>
    );
  }

  // Text (default)
  if (editing) {
    return (
      <input
        ref={inputRef}
        type="text"
        defaultValue={value != null ? String(value) : ''}
        onKeyDown={e => {
          if (e.key === 'Enter') {
            onSave(e.currentTarget.value || null);
            setEditing(false);
          }
          if (e.key === 'Escape') setEditing(false);
        }}
        onBlur={e => {
          onSave(e.currentTarget.value || null);
          setEditing(false);
        }}
        className="bg-transparent text-sm text-white outline-none w-full"
      />
    );
  }

  return (
    <button onClick={() => setEditing(true)} className="h-full flex items-center cursor-pointer w-full">
      <span className={value ? 'text-neutral-300 text-sm truncate' : 'text-neutral-600 text-xs'}>
        {value != null ? String(value) : '-'}
      </span>
    </button>
  );
}
