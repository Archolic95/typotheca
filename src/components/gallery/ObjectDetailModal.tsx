'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Image from 'next/image';
import { Modal } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';
import { resolveImageUrl, isOptimizableUrl, isVideoUrl } from '@/lib/r2';
import { formatPrice, brandDisplay, relativeTime } from '@/lib/utils';
import {
  RARITY_LEVELS, GENRE_OPTIONS, CATEGORY_1_OPTIONS, AVAILABILITY_OPTIONS,
  SHIPPING_OPTIONS, ACRONYM_CATEGORIES, ACRONYM_STYLES, SEASON_OPTIONS,
} from '@/lib/constants';
import type { ObjectRow, ObjectColorwayRow, ObjectMaterialRow, PricePointRow } from '@/lib/supabase/types';

/** Safe image: uses Next.js Image for whitelisted hosts, plain <img> otherwise */
function SafeImage({ src, alt, fill, className, sizes, ...rest }: { src: string; alt: string; fill?: boolean; className?: string; sizes?: string; [k: string]: unknown }) {
  if (isOptimizableUrl(src)) {
    return <Image src={src} alt={alt} fill={fill} className={className} sizes={sizes} {...rest} />;
  }
  /* eslint-disable-next-line @next/next/no-img-element */
  return <img src={src} alt={alt} className={`${fill ? 'absolute inset-0 w-full h-full' : ''} ${className || ''}`} loading="lazy" />;
}

interface ObjectDetailModalProps {
  objectId: string;
  onClose: () => void;
  onDeleted?: () => void;
}

interface DetailData {
  object: ObjectRow;
  colorways: ObjectColorwayRow[];
  materials: ObjectMaterialRow[];
  priceHistory: PricePointRow[];
}

/* ─── Inline editable field components ────────────────────────────────── */

function EditableText({ value, field, objectId, onSaved, placeholder, multiline }: {
  value: string; field: string; objectId: string; onSaved: (v: string) => void; placeholder?: string; multiline?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value || '');
  const ref = useRef<HTMLTextAreaElement | HTMLInputElement>(null);

  useEffect(() => { setDraft(value || ''); }, [value]);
  useEffect(() => { if (editing) ref.current?.focus(); }, [editing]);

  const save = async () => {
    setEditing(false);
    if (draft === (value || '')) return;
    const res = await fetch(`/api/objects/${objectId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [field]: draft }),
    });
    if (res.ok) onSaved(draft);
  };

  if (!editing) {
    return (
      <span onClick={() => setEditing(true)} className="cursor-pointer hover:bg-neutral-800/50 px-1 -mx-1 rounded transition-colors min-w-[40px] inline-block">
        {value || <span className="text-neutral-600 italic">{placeholder || 'Click to edit'}</span>}
      </span>
    );
  }

  if (multiline) {
    return (
      <textarea
        ref={ref as React.RefObject<HTMLTextAreaElement>}
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={save}
        onKeyDown={e => { if (e.key === 'Escape') { setDraft(value || ''); setEditing(false); } }}
        className="w-full bg-neutral-900 border border-neutral-700 rounded px-2 py-1 text-sm text-neutral-200 outline-none focus:border-blue-500 resize-y min-h-[60px]"
        placeholder={placeholder}
        rows={3}
      />
    );
  }

  return (
    <input
      ref={ref as React.RefObject<HTMLInputElement>}
      type="text"
      value={draft}
      onChange={e => setDraft(e.target.value)}
      onBlur={save}
      onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') { setDraft(value || ''); setEditing(false); } }}
      className="bg-neutral-900 border border-neutral-700 rounded px-2 py-0.5 text-sm text-neutral-200 outline-none focus:border-blue-500 w-full"
      placeholder={placeholder}
    />
  );
}

function EditableSelect({ value, field, objectId, options, onSaved, variant }: {
  value: string | null; field: string; objectId: string; options: readonly string[]; onSaved: (v: string | null) => void; variant?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const select = async (v: string | null) => {
    setOpen(false);
    const res = await fetch(`/api/objects/${objectId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [field]: v }),
    });
    if (res.ok) onSaved(v);
  };

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen(!open)} className="cursor-pointer hover:bg-neutral-800/50 px-1 -mx-1 rounded transition-colors">
        {value ? (
          <Badge variant={(variant as any) || 'default'} colorKey={value}>{value}</Badge>
        ) : (
          <span className="text-neutral-600 italic text-xs">Select...</span>
        )}
      </button>
      {open && (
        <div className="absolute z-50 mt-1 bg-neutral-900 border border-neutral-700 rounded-lg shadow-xl py-1 max-h-[200px] overflow-y-auto min-w-[160px]">
          <button onClick={() => select(null)} className="w-full text-left px-3 py-1.5 text-xs text-neutral-500 hover:bg-neutral-800">
            (none)
          </button>
          {options.map(opt => (
            <button
              key={opt}
              onClick={() => select(opt)}
              className={`w-full text-left px-3 py-1.5 text-xs hover:bg-neutral-800 ${opt === value ? 'text-white bg-neutral-800/50' : 'text-neutral-300'}`}
            >
              {opt}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function EditableMultiSelect({ values, field, objectId, options, onSaved, variant }: {
  values: string[]; field: string; objectId: string; options: readonly string[]; onSaved: (v: string[]) => void; variant?: string;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  useEffect(() => { if (open) inputRef.current?.focus(); }, [open]);

  const toggle = async (opt: string) => {
    const next = values.includes(opt) ? values.filter(v => v !== opt) : [...values, opt];
    const res = await fetch(`/api/objects/${objectId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [field]: next }),
    });
    if (res.ok) onSaved(next);
  };

  const addCustom = async () => {
    const trimmed = search.trim();
    if (!trimmed || values.includes(trimmed)) { setSearch(''); return; }
    const next = [...values, trimmed];
    setSearch('');
    const res = await fetch(`/api/objects/${objectId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [field]: next }),
    });
    if (res.ok) onSaved(next);
  };

  const remove = async (opt: string) => {
    const next = values.filter(v => v !== opt);
    const res = await fetch(`/api/objects/${objectId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [field]: next }),
    });
    if (res.ok) onSaved(next);
  };

  const filtered = options.filter(o => o.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="relative" ref={ref}>
      <div onClick={() => setOpen(true)} className="cursor-pointer hover:bg-neutral-800/30 px-1 -mx-1 rounded transition-colors min-h-[24px]">
        {values.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {values.map(v => (
              <Badge key={v} variant={(variant as any) || 'default'} colorKey={v} className="group">
                {v}
                <button
                  onClick={(e) => { e.stopPropagation(); remove(v); }}
                  className="ml-1 opacity-0 group-hover:opacity-100 hover:text-red-400 transition-opacity"
                >
                  x
                </button>
              </Badge>
            ))}
          </div>
        ) : (
          <span className="text-neutral-600 italic text-xs">Add tags...</span>
        )}
      </div>
      {open && (
        <div className="absolute z-50 mt-1 bg-neutral-900 border border-neutral-700 rounded-lg shadow-xl py-1 min-w-[200px] max-w-[300px]">
          <div className="px-2 pb-1">
            <input
              ref={inputRef}
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') addCustom(); if (e.key === 'Escape') setOpen(false); }}
              className="w-full bg-neutral-800 border border-neutral-700 rounded px-2 py-1 text-xs text-neutral-200 outline-none focus:border-blue-500"
              placeholder="Search or type to add..."
            />
          </div>
          <div className="max-h-[200px] overflow-y-auto">
            {filtered.map(opt => (
              <button
                key={opt}
                onClick={() => toggle(opt)}
                className="w-full text-left px-3 py-1.5 text-xs hover:bg-neutral-800 flex items-center gap-2"
              >
                <span className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 ${values.includes(opt) ? 'bg-blue-500 border-blue-500' : 'border-neutral-600'}`}>
                  {values.includes(opt) && <span className="text-white text-[8px]">&#10003;</span>}
                </span>
                <span className={values.includes(opt) ? 'text-white' : 'text-neutral-400'}>{opt}</span>
              </button>
            ))}
            {search && !filtered.some(o => o.toLowerCase() === search.toLowerCase()) && (
              <button onClick={addCustom} className="w-full text-left px-3 py-1.5 text-xs text-blue-400 hover:bg-neutral-800">
                + Add "{search}"
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function EditableBoolean({ value, field, objectId, label, onSaved }: {
  value: boolean; field: string; objectId: string; label: string; onSaved: (v: boolean) => void;
}) {
  const toggle = async () => {
    const next = !value;
    const res = await fetch(`/api/objects/${objectId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [field]: next }),
    });
    if (res.ok) onSaved(next);
  };

  return (
    <button onClick={toggle} className="flex items-center gap-2 hover:bg-neutral-800/50 px-1 -mx-1 rounded transition-colors">
      <span className={`w-4 h-4 rounded border flex items-center justify-center ${value ? 'bg-blue-500 border-blue-500' : 'border-neutral-600'}`}>
        {value && <span className="text-white text-[10px]">&#10003;</span>}
      </span>
      <span className="text-sm text-neutral-300">{label}</span>
    </button>
  );
}

function EditableRating({ value, objectId, onSaved }: {
  value: number; objectId: string; onSaved: (v: number) => void;
}) {
  const setRating = async (n: number) => {
    const next = n === value ? 0 : n;
    const res = await fetch(`/api/objects/${objectId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ personal_rating: next }),
    });
    if (res.ok) onSaved(next);
  };

  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map(n => (
        <button key={n} onClick={() => setRating(n)} className="text-lg hover:scale-110 transition-transform">
          <span className={n <= value ? 'text-yellow-400' : 'text-neutral-700'}>{n <= value ? '\u2605' : '\u2606'}</span>
        </button>
      ))}
    </div>
  );
}

/* ─── Main Modal ──────────────────────────────────────────────────────── */

export function ObjectDetailModal({ objectId, onClose, onDeleted }: ObjectDetailModalProps) {
  const [data, setData] = useState<DetailData | null>(null);
  const [imageIndex, setImageIndex] = useState(0);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    setImageIndex(0);
    setData(null);
    fetch(`/api/objects/${objectId}`)
      .then(r => r.json())
      .then(setData)
      .catch(() => {});
  }, [objectId]);

  const [editingImages, setEditingImages] = useState(false);
  const [addImageUrl, setAddImageUrl] = useState('');

  const updateField = useCallback((field: string, value: unknown) => {
    setData(prev => prev ? { ...prev, object: { ...prev.object, [field]: value } } : prev);
  }, []);

  const updateImages = useCallback(async (newImages: string[]) => {
    const res = await fetch(`/api/objects/${objectId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image_urls: newImages }),
    });
    if (res.ok) {
      updateField('image_urls', newImages);
      // Adjust index if current image was removed
      if (imageIndex >= newImages.length) setImageIndex(Math.max(0, newImages.length - 1));
    }
  }, [objectId, updateField, imageIndex]);

  const handleDeleteImage = useCallback((idx: number) => {
    if (!data) return;
    const imgs = [...(data.object.image_urls || [])];
    imgs.splice(idx, 1);
    updateImages(imgs);
  }, [data, updateImages]);

  const handleMoveImage = useCallback((idx: number, dir: -1 | 1) => {
    if (!data) return;
    const imgs = [...(data.object.image_urls || [])];
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= imgs.length) return;
    [imgs[idx], imgs[newIdx]] = [imgs[newIdx], imgs[idx]];
    updateImages(imgs);
    setImageIndex(newIdx);
  }, [data, updateImages]);

  const handleAddImage = useCallback(() => {
    if (!addImageUrl.trim() || !data) return;
    const imgs = [...(data.object.image_urls || []), addImageUrl.trim()];
    updateImages(imgs);
    setAddImageUrl('');
  }, [addImageUrl, data, updateImages]);

  const handleDelete = useCallback(async () => {
    if (!confirm('Delete this object permanently? This cannot be undone.')) return;
    setDeleting(true);
    const res = await fetch(`/api/objects/${objectId}`, { method: 'DELETE' });
    if (res.ok) {
      onDeleted?.();
      onClose();
    } else {
      setDeleting(false);
      alert('Failed to delete');
    }
  }, [objectId, onDeleted, onClose]);

  if (!data) {
    return (
      <Modal open onClose={onClose}>
        <div className="p-12 flex items-center justify-center">
          <div className="w-5 h-5 border-2 border-neutral-600 border-t-white rounded-full animate-spin" />
        </div>
      </Modal>
    );
  }

  const { object: obj, colorways, materials, priceHistory } = data;
  const images = obj.image_urls || [];
  const sections = obj.sections || {};
  const sectionKeys = Object.keys(sections).filter(k => sections[k]?.trim());
  const isAcronym = obj.brand === 'acronym';

  return (
    <Modal open onClose={onClose}>
      <div className="flex flex-col md:flex-row">
        {/* Images */}
        <div className="md:w-1/2 bg-neutral-950 p-4">
          {images.length > 0 ? (
            <>
              <div className="aspect-square relative rounded-lg overflow-hidden bg-neutral-900">
                {isVideoUrl(images[imageIndex]) ? (
                  <video
                    key={images[imageIndex]}
                    src={resolveImageUrl(images[imageIndex])}
                    className="absolute inset-0 w-full h-full object-contain"
                    controls
                    autoPlay
                    playsInline
                    preload="auto"
                  />
                ) : (
                  <SafeImage
                    src={resolveImageUrl(images[imageIndex])}
                    alt={obj.name}
                    fill
                    className="object-contain"
                    sizes="(max-width: 768px) 100vw, 50vw"
                  />
                )}
              </div>
              <div className="flex items-center gap-2 mt-3">
                <div className="flex gap-2 flex-1 overflow-x-auto pb-1">
                  {images.map((img, i) => (
                    <div key={i} className="relative shrink-0 group">
                      <button
                        onClick={() => setImageIndex(i)}
                        className={`w-14 h-14 rounded overflow-hidden relative border-2 transition-colors ${
                          i === imageIndex ? 'border-white' : 'border-transparent hover:border-neutral-600'
                        }`}
                      >
                        {isVideoUrl(img) ? (
                          <div className="absolute inset-0 bg-neutral-800 flex items-center justify-center">
                            <svg width="16" height="16" viewBox="0 0 10 10" fill="white">
                              <path d="M2 1l7 4-7 4V1z" />
                            </svg>
                          </div>
                        ) : (
                          <SafeImage
                            src={resolveImageUrl(img)}
                            alt=""
                            fill
                            className="object-cover"
                            sizes="56px"
                          />
                        )}
                      </button>
                      {editingImages && (
                        <div className="absolute -top-1 -right-1 flex gap-0.5">
                          <button
                            onClick={() => handleDeleteImage(i)}
                            className="w-4 h-4 rounded-full bg-red-600 text-white text-[8px] flex items-center justify-center hover:bg-red-500"
                            title="Delete image"
                          >
                            ✕
                          </button>
                        </div>
                      )}
                      {editingImages && (
                        <div className="flex justify-center gap-0.5 mt-0.5">
                          {i > 0 && (
                            <button onClick={() => handleMoveImage(i, -1)} className="text-[9px] text-neutral-500 hover:text-white px-1">◀</button>
                          )}
                          {i < images.length - 1 && (
                            <button onClick={() => handleMoveImage(i, 1)} className="text-[9px] text-neutral-500 hover:text-white px-1">▶</button>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                <button
                  onClick={() => setEditingImages(!editingImages)}
                  className={`shrink-0 px-2 py-1 text-xs rounded border transition-colors ${
                    editingImages
                      ? 'bg-blue-600 border-blue-500 text-white'
                      : 'border-neutral-700 text-neutral-500 hover:text-white hover:border-neutral-600'
                  }`}
                >
                  {editingImages ? 'Done' : 'Edit'}
                </button>
              </div>
              {editingImages && (
                <div className="flex gap-2 mt-2">
                  <input
                    type="text"
                    value={addImageUrl}
                    onChange={e => setAddImageUrl(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') handleAddImage(); }}
                    placeholder="Paste image URL..."
                    className="flex-1 bg-neutral-900 border border-neutral-700 rounded px-2 py-1 text-xs text-neutral-200 outline-none focus:border-blue-500"
                  />
                  <button
                    onClick={handleAddImage}
                    disabled={!addImageUrl.trim()}
                    className="px-3 py-1 text-xs bg-neutral-800 border border-neutral-700 rounded text-neutral-300 hover:text-white hover:border-neutral-600 disabled:opacity-30 disabled:pointer-events-none"
                  >
                    Add
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className="aspect-square flex flex-col items-center justify-center text-neutral-500 bg-black rounded-lg gap-3">
              <span className="font-mono text-sm">{obj.name}</span>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={addImageUrl}
                  onChange={e => setAddImageUrl(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleAddImage(); }}
                  placeholder="Paste image URL..."
                  className="bg-neutral-800 border border-neutral-700 rounded px-2 py-1 text-xs text-neutral-200 outline-none focus:border-blue-500 w-48"
                />
                <button
                  onClick={handleAddImage}
                  disabled={!addImageUrl.trim()}
                  className="px-3 py-1 text-xs bg-neutral-800 border border-neutral-700 rounded text-neutral-300 hover:text-white disabled:opacity-30"
                >
                  Add
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Details */}
        <div className="md:w-1/2 p-6 space-y-5 overflow-y-auto max-h-[80vh]">
          {/* Header */}
          <div>
            <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-neutral-500 font-medium">
              <span>{brandDisplay(obj.brand)}</span>
              <EditableSelect value={obj.season || null} field="season" objectId={obj.id} options={SEASON_OPTIONS} onSaved={v => updateField('season', v)} />
            </div>
            <h2 className="text-xl font-semibold mt-1">{obj.name}</h2>
            {obj.model_code && (
              <p className="text-sm text-neutral-500 mt-0.5 font-mono">{obj.model_code}</p>
            )}
          </div>

          {/* Rarity & Status Row */}
          <div className="flex flex-wrap gap-3 items-center">
            {obj.retail_price && (
              <span className="text-lg font-medium">
                {formatPrice(obj.retail_price, obj.retail_currency)}
              </span>
            )}
            <EditableSelect
              value={obj.notion_rarity}
              field="notion_rarity"
              objectId={obj.id}
              options={RARITY_LEVELS}
              variant="rarity"
              onSaved={v => updateField('notion_rarity', v)}
            />
            <EditableBoolean value={!!obj.notion_copped} field="notion_copped" objectId={obj.id} label="Copped" onSaved={v => updateField('notion_copped', v)} />
            {obj.in_stock ? <Badge variant="success">In Stock</Badge> : <Badge variant="danger">Out of Stock</Badge>}
            {obj.limited_edition && <Badge variant="warning">Limited</Badge>}
            {obj.discontinued && <Badge variant="danger">Discontinued</Badge>}
          </div>

          {/* Classification Section */}
          <div className="space-y-3">
            <p className="text-xs text-neutral-500 uppercase tracking-wider">Classification</p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <div>
                <p className="text-neutral-500 text-xs">1st Category</p>
                <EditableSelect value={obj.category_1} field="category_1" objectId={obj.id} options={CATEGORY_1_OPTIONS} variant="cat1" onSaved={v => updateField('category_1', v)} />
              </div>
              <div>
                <p className="text-neutral-500 text-xs">2nd Category</p>
                <EditableText value={obj.category_2 || ''} field="category_2" objectId={obj.id} placeholder="Add..." onSaved={v => updateField('category_2', v)} />
              </div>
              <div>
                <p className="text-neutral-500 text-xs">3rd Category</p>
                <EditableText value={obj.category_3 || ''} field="category_3" objectId={obj.id} placeholder="Add..." onSaved={v => updateField('category_3', v)} />
              </div>
              {obj.designer && <Field label="Designer" value={obj.designer} />}
              <div>
                <p className="text-neutral-500 text-xs">Collab</p>
                <EditableText value={obj.collab || ''} field="collab" objectId={obj.id} placeholder="Add collab..." onSaved={v => updateField('collab', v)} />
              </div>
              {obj.silhouette && <Field label="Silhouette" value={obj.silhouette} />}
              {obj.country_of_origin && <Field label="Origin" value={obj.country_of_origin} />}
            </div>

            {isAcronym && (
              <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                <div>
                  <p className="text-neutral-500 text-xs">Acronym Type</p>
                  <EditableSelect value={obj.acronym_category || null} field="acronym_category" objectId={obj.id} options={ACRONYM_CATEGORIES} onSaved={v => updateField('acronym_category', v)} />
                </div>
                <div>
                  <p className="text-neutral-500 text-xs">Acronym Style</p>
                  <EditableSelect value={obj.acronym_style || null} field="acronym_style" objectId={obj.id} options={ACRONYM_STYLES} onSaved={v => updateField('acronym_style', v)} />
                </div>
              </div>
            )}
          </div>

          {/* Genre — Multi-Select */}
          <div>
            <p className="text-xs text-neutral-500 uppercase tracking-wider mb-1.5">Genre</p>
            <EditableMultiSelect
              values={obj.genre || []}
              field="genre"
              objectId={obj.id}
              options={GENRE_OPTIONS}
              variant="genre"
              onSaved={v => updateField('genre', v)}
            />
          </div>

          {/* Features — Multi-Select */}
          <div>
            <p className="text-xs text-neutral-500 uppercase tracking-wider mb-1.5">Features</p>
            <EditableMultiSelect
              values={obj.features || []}
              field="features"
              objectId={obj.id}
              options={['GORE-TEX', 'Windstopper', 'Dryskin', 'Schoeller', 'PrimaLoft', 'Polartec', 'Packable', 'Waterproof', 'Windproof', 'Insulated', 'TEC SYS', 'Modular', 'ECONYL']}
              onSaved={v => updateField('features', v)}
            />
          </div>

          {/* Sizes */}
          {obj.sizes_available?.length > 0 && (
            <div>
              <p className="text-xs text-neutral-500 uppercase tracking-wider mb-1.5">Sizes</p>
              <div className="flex flex-wrap gap-1.5">
                {obj.sizes_available.map(s => (
                  <span key={s} className="px-2 py-0.5 text-xs bg-neutral-800 rounded border border-neutral-700">{s}</span>
                ))}
              </div>
            </div>
          )}

          {/* Shopping Section */}
          <div className="space-y-2">
            <p className="text-xs text-neutral-500 uppercase tracking-wider">Shopping</p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <div>
                <p className="text-neutral-500 text-xs">Availability</p>
                <EditableSelect value={obj.notion_availability || null} field="notion_availability" objectId={obj.id} options={AVAILABILITY_OPTIONS} variant="availability" onSaved={v => updateField('notion_availability', v)} />
              </div>
              <div>
                <p className="text-neutral-500 text-xs">Shipping</p>
                <EditableSelect value={obj.notion_shipping || null} field="notion_shipping" objectId={obj.id} options={SHIPPING_OPTIONS} variant="shipping" onSaved={v => updateField('notion_shipping', v)} />
              </div>
            </div>
          </div>

          {/* Materials */}
          {materials.length > 0 && (
            <div>
              <p className="text-xs text-neutral-500 uppercase tracking-wider mb-1.5">Materials</p>
              <div className="space-y-1">
                {materials.map(m => (
                  <div key={m.id} className="flex items-center gap-2 text-sm">
                    <span className="text-white">{m.fabric}</span>
                    {m.percentage && <span className="text-neutral-500">{m.percentage}%</span>}
                    {m.notes && <span className="text-neutral-600">{m.notes}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Sections (accordions) */}
          {sectionKeys.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs text-neutral-500 uppercase tracking-wider">Details</p>
              {sectionKeys.map(key => (
                <details key={key} className="group">
                  <summary className="cursor-pointer text-sm text-neutral-300 hover:text-white py-1 flex items-center gap-2">
                    <svg width="8" height="8" viewBox="0 0 8 8" className="group-open:rotate-90 transition-transform">
                      <path d="M2 1l4 3-4 3" fill="currentColor" />
                    </svg>
                    {key}
                  </summary>
                  <p className="text-sm text-neutral-400 pl-5 pb-2 whitespace-pre-wrap">{sections[key]}</p>
                </details>
              ))}
            </div>
          )}

          {/* Description / Full Text */}
          {obj.full_text && (
            <div>
              <p className="text-xs text-neutral-500 uppercase tracking-wider mb-1.5">Description</p>
              <div className="text-sm text-neutral-400 whitespace-pre-wrap leading-relaxed max-h-[300px] overflow-y-auto">
                {obj.full_text}
              </div>
            </div>
          )}

          {/* Colorways */}
          {colorways.length > 0 && (
            <div>
              <p className="text-xs text-neutral-500 uppercase tracking-wider mb-1.5">Colorways</p>
              <div className="flex flex-wrap gap-2">
                {colorways.map(cw => (
                  <div key={cw.id} className="flex items-center gap-2 px-2 py-1 bg-neutral-800 rounded text-xs">
                    {cw.color_hex && (
                      <span className="w-3 h-3 rounded-full border border-neutral-600" style={{ backgroundColor: cw.color_hex }} />
                    )}
                    <span>{cw.color_name}</span>
                    {!cw.in_stock && <span className="text-red-400">OOS</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Price history */}
          {priceHistory.length > 0 && (
            <div>
              <p className="text-xs text-neutral-500 uppercase tracking-wider mb-1.5">Price History</p>
              <div className="space-y-1">
                {priceHistory.slice(0, 10).map(pp => (
                  <div key={pp.id} className="flex justify-between text-sm">
                    <span className="text-neutral-400">{formatPrice(pp.price, pp.currency)}</span>
                    <span className="text-neutral-600">{pp.source} &middot; {relativeTime(pp.recorded_at)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Personal Section — Always shown, editable */}
          <div className="pt-3 border-t border-neutral-800 space-y-3">
            <p className="text-xs text-neutral-500 uppercase tracking-wider">Personal</p>

            <EditableRating value={obj.personal_rating || 0} objectId={obj.id} onSaved={v => updateField('personal_rating', v)} />

            <div>
              <p className="text-neutral-500 text-xs mb-1">Notes</p>
              <EditableText
                value={obj.personal_notes || ''}
                field="personal_notes"
                objectId={obj.id}
                placeholder="Add personal notes..."
                multiline
                onSaved={v => updateField('personal_notes', v)}
              />
            </div>

            {obj.personal_wear_count > 0 && (
              <div className="text-sm text-neutral-400">
                Worn {obj.personal_wear_count}x
              </div>
            )}

            {obj.personal_images?.length > 0 && (
              <div>
                <p className="text-xs text-neutral-500 mb-1.5">My Photos</p>
                <div className="flex gap-2 overflow-x-auto pb-2">
                  {obj.personal_images.map((img: string, i: number) => (
                    <div key={i} className="w-20 h-20 rounded overflow-hidden shrink-0 relative bg-neutral-900">
                      <SafeImage src={resolveImageUrl(img)} alt="" fill className="object-cover" sizes="80px" />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Source link + timestamps */}
          <div className="pt-3 border-t border-neutral-800 space-y-2">
            <a
              href={obj.source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-blue-400 hover:text-blue-300 hover:underline break-all"
            >
              {obj.source_url}
            </a>
            <p className="text-xs text-neutral-600">
              First seen {relativeTime(obj.first_seen_at)} &middot; Updated {relativeTime(obj.updated_at)}
            </p>
          </div>

          {/* Delete */}
          <div className="pt-3 border-t border-neutral-800">
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="text-xs text-red-500/60 hover:text-red-400 transition-colors disabled:opacity-30"
            >
              {deleting ? 'Deleting...' : 'Delete this object'}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-neutral-500 text-xs">{label}</p>
      <p className="text-neutral-200">{value}</p>
    </div>
  );
}

