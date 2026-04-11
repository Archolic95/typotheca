'use client';

import { useState, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';
import type { ViewConfig } from '@/lib/views';

interface ViewBarProps {
  views: ViewConfig[];
  activeViewId: string;
  onSwitchView: (id: string) => void;
  onCreateView?: (name: string, type: 'gallery' | 'table') => void;
  onRenameView?: (id: string, name: string) => void;
}

function ViewIcon({ type }: { type: 'gallery' | 'table' }) {
  if (type === 'gallery') {
    return (
      <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
        <rect x="0" y="0" width="5" height="5" rx="1" />
        <rect x="7" y="0" width="5" height="5" rx="1" />
        <rect x="0" y="7" width="5" height="5" rx="1" />
        <rect x="7" y="7" width="5" height="5" rx="1" />
      </svg>
    );
  }
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
      <rect x="0" y="0.5" width="12" height="2" rx="0.5" />
      <rect x="0" y="4.5" width="12" height="2" rx="0.5" />
      <rect x="0" y="8.5" width="12" height="2" rx="0.5" />
    </svg>
  );
}

function EditableName({ name, onSave }: { name: string; onSave: (n: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name);
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => { if (editing) ref.current?.focus(); }, [editing]);

  const save = () => {
    setEditing(false);
    if (draft.trim() && draft !== name) onSave(draft.trim());
    else setDraft(name);
  };

  if (!editing) {
    return (
      <span
        onDoubleClick={() => setEditing(true)}
        className="cursor-default select-none"
      >
        {name}
      </span>
    );
  }

  return (
    <input
      ref={ref}
      value={draft}
      onChange={e => setDraft(e.target.value)}
      onBlur={save}
      onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') { setDraft(name); setEditing(false); } }}
      className="bg-transparent border-b border-blue-500 outline-none text-xs text-white w-16 py-0"
      onClick={e => e.stopPropagation()}
    />
  );
}

export function ViewBar({ views, activeViewId, onSwitchView, onCreateView, onRenameView }: ViewBarProps) {
  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState<'gallery' | 'table'>('table');
  const newRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (showNew) newRef.current?.focus(); }, [showNew]);

  const handleCreate = () => {
    if (!newName.trim() || !onCreateView) return;
    onCreateView(newName.trim(), newType);
    setNewName('');
    setShowNew(false);
  };

  return (
    <div className="flex items-center gap-1 border-b border-neutral-800 pb-2 mb-4 overflow-x-auto">
      {views.map(view => (
        <button
          key={view.id}
          onClick={() => onSwitchView(view.id)}
          className={cn(
            'flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-md transition-colors shrink-0',
            activeViewId === view.id
              ? 'bg-neutral-800 text-white'
              : 'text-neutral-500 hover:text-neutral-300 hover:bg-neutral-800/50',
          )}
        >
          <ViewIcon type={view.type} />
          {onRenameView && !view.builtIn ? (
            <EditableName name={view.name} onSave={n => onRenameView(view.id, n)} />
          ) : (
            view.name
          )}
        </button>
      ))}

      {/* + New view */}
      {onCreateView && (
        <>
          {showNew ? (
            <div className="flex items-center gap-1 shrink-0">
              <select
                value={newType}
                onChange={e => setNewType(e.target.value as 'gallery' | 'table')}
                className="bg-neutral-900 border border-neutral-700 rounded px-1 py-1 text-xs text-neutral-300 outline-none"
              >
                <option value="table">Table</option>
                <option value="gallery">Gallery</option>
              </select>
              <input
                ref={newRef}
                value={newName}
                onChange={e => setNewName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleCreate(); if (e.key === 'Escape') setShowNew(false); }}
                placeholder="View name..."
                className="bg-neutral-900 border border-neutral-700 rounded px-2 py-1 text-xs text-neutral-200 outline-none focus:border-blue-500 w-24"
              />
              <button
                onClick={handleCreate}
                disabled={!newName.trim()}
                className="px-2 py-1 text-xs bg-blue-600 rounded text-white hover:bg-blue-500 disabled:opacity-30"
              >
                Add
              </button>
              <button
                onClick={() => setShowNew(false)}
                className="px-1 py-1 text-xs text-neutral-500 hover:text-white"
              >
                ✕
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowNew(true)}
              className="flex items-center gap-1 px-2 py-1.5 text-xs text-neutral-600 hover:text-neutral-400 transition-colors shrink-0"
            >
              <svg width="10" height="10" viewBox="0 0 10 10">
                <path d="M5 1v8M1 5h8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
              </svg>
            </button>
          )}
        </>
      )}
    </div>
  );
}
