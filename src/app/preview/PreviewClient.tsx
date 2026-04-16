'use client';

import { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { isOptimizableUrl } from '@/lib/r2';

export interface PreviewItem {
  id: string;
  name: string;
  season: string | null;
  image_urls: string[];
  structured_data: Record<string, unknown> | null;
}

/** Media item type discriminator */
type Media = { kind: 'image' | 'video'; url: string };

/** Detect video URL by extension */
function isVideo(url: string): boolean {
  return /\.(mp4|mov|webm|m4v)(\?|$)/i.test(url);
}

/** Resolve relative URLs (like /videos/...) against acrnm.com */
function resolveUrl(url: string): string {
  if (url.startsWith('http')) return url;
  if (url.startsWith('/')) return `https://acrnm.com${url}`;
  return url;
}

/** Get all displayable media (images + videos, resolving relative paths) */
function getDisplayableMedia(imageUrls: string[]): Media[] {
  const out: Media[] = [];
  for (const raw of imageUrls || []) {
    if (!raw) continue;
    // Skip vimeo embed pages (they don't play inline via <video>)
    if (raw.includes('player.vimeo.com')) continue;
    const url = resolveUrl(raw);
    if (!url.startsWith('http')) continue; // unresolvable
    out.push({ kind: isVideo(url) ? 'video' : 'image', url });
  }
  return out;
}

/** Get the best primary thumbnail image (non-video, prefer R2) */
function getBestImage(imageUrls: string[]): string | null {
  const candidates = getDisplayableMedia(imageUrls).filter(m => m.kind === 'image').map(m => m.url);
  const r2 = candidates.find(u => u.includes('r2.dev'));
  return r2 || candidates[0] || null;
}

/** Item card in grid */
function ItemCard({ item, onClick }: { item: PreviewItem; onClick: () => void }) {
  const imageUrl = getBestImage(item.image_urls);
  const canOptimize = imageUrl ? isOptimizableUrl(imageUrl) : false;
  // Check all media (including relative /videos/ paths) for the video indicator
  const media = getDisplayableMedia(item.image_urls);
  const firstVideo = media.find(m => m.kind === 'video');
  const itemHasVideo = !!firstVideo;
  const videoUrl = !imageUrl && firstVideo ? firstVideo.url : null;

  return (
    <button
      onClick={onClick}
      className="group text-left relative block"
    >
      <div className="relative aspect-[3/4] bg-neutral-900 overflow-hidden">
        {imageUrl && canOptimize ? (
          <Image
            src={imageUrl}
            alt={item.name}
            fill
            className="object-cover object-top transition-transform duration-500 group-hover:scale-[1.03]"
            sizes="(max-width: 640px) 33vw, (max-width: 1024px) 20vw, 12vw"
            loading="lazy"
            quality={75}
          />
        ) : imageUrl ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={imageUrl}
            alt={item.name}
            className="absolute inset-0 w-full h-full object-cover object-top transition-transform duration-500 group-hover:scale-[1.03]"
            loading="lazy"
            draggable={false}
          />
        ) : videoUrl ? (
          <video
            src={videoUrl}
            className="absolute inset-0 w-full h-full object-cover"
            preload="metadata"
            muted
            playsInline
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center px-2">
            <span className="text-[10px] text-neutral-600 font-mono text-center">{item.name}</span>
          </div>
        )}
        {itemHasVideo && (
          <div className="absolute bottom-1.5 right-1.5">
            <div className="w-5 h-5 flex items-center justify-center rounded-full bg-black/60 backdrop-blur-sm border border-white/10">
              <svg width="7" height="7" viewBox="0 0 10 10" fill="white" className="ml-0.5">
                <path d="M2 1l7 4-7 4V1z" />
              </svg>
            </div>
          </div>
        )}
      </div>
      <div className="mt-1.5">
        <p className="text-[11px] text-neutral-400 group-hover:text-white transition-colors tracking-wide truncate">
          {item.name}
        </p>
      </div>
    </button>
  );
}

/** Render a collapsible section with details */
function DetailSection({ label, children, defaultOpen = false }: { label: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-neutral-800/50">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between py-3 text-left hover:text-white transition-colors"
      >
        <span className="text-[11px] text-neutral-400 tracking-[0.2em] uppercase">{label}</span>
        <span className={`text-neutral-500 text-xs transition-transform ${open ? 'rotate-90' : ''}`}>▸</span>
      </button>
      {open && <div className="pb-4 text-[13px] text-neutral-300 leading-relaxed">{children}</div>}
    </div>
  );
}

/** Render a structured_data value — handles strings, arrays, and objects */
function renderSdValue(value: unknown): React.ReactNode {
  if (value == null) return null;
  if (typeof value === 'string') {
    // Convert newlines to paragraph breaks
    return value.split(/\n\n+/).map((p, i) => (
      <p key={i} className="whitespace-pre-line mb-2 last:mb-0">{p.trim()}</p>
    ));
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return null;
    if (value.every(v => typeof v === 'string' || typeof v === 'number')) {
      return (
        <ul className="space-y-1 list-disc list-inside marker:text-neutral-600">
          {value.map((v, i) => <li key={i}>{String(v)}</li>)}
        </ul>
      );
    }
    // Array of objects — render as stacked items
    return (
      <div className="space-y-2">
        {value.map((v, i) => <div key={i} className="text-neutral-400">{renderSdValue(v)}</div>)}
      </div>
    );
  }
  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>).filter(([, v]) => v != null && v !== '');
    if (entries.length === 0) return null;
    return (
      <dl className="space-y-1">
        {entries.map(([k, v]) => (
          <div key={k} className="flex gap-2 text-[12px]">
            <dt className="text-neutral-500 min-w-[90px] shrink-0 capitalize">{k.replace(/_/g, ' ')}:</dt>
            <dd className="text-neutral-300">{typeof v === 'string' ? v : JSON.stringify(v)}</dd>
          </div>
        ))}
      </dl>
    );
  }
  return String(value);
}

/** Detail modal with image+video carousel + full product details */
function PreviewModal({ item, onClose }: { item: PreviewItem; onClose: () => void }) {
  const media = getDisplayableMedia(item.image_urls);
  const [index, setIndex] = useState(0);
  const sd = (item.structured_data || {}) as Record<string, unknown>;

  const subtitle = (sd.subtitle as string | undefined) || '';
  const generation = (sd.generation as string | undefined) || '';

  const description = sd.description as string | undefined;
  const fabricTechnology = sd.fabric_technology;
  const sizing = sd.sizing;
  const subsystems = sd.subsystems;
  const systems = sd.systems;
  const includes = sd.includes;
  const interfaceWith = sd.interface_with;

  const prev = useCallback(() => setIndex(i => (i - 1 + media.length) % media.length), [media.length]);
  const next = useCallback(() => setIndex(i => (i + 1) % media.length), [media.length]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowLeft') prev();
      else if (e.key === 'ArrowRight') next();
    };
    window.addEventListener('keydown', handler);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', handler);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose, prev, next]);

  const current = media[index];
  const canOptimize = current && current.kind === 'image' ? isOptimizableUrl(current.url) : false;

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-sm flex flex-col"
      onClick={onClose}
    >
      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 z-20 w-10 h-10 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/10 text-white/80 hover:text-white transition-colors"
        aria-label="Close"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M2 2l12 12M14 2L2 14" />
        </svg>
      </button>

      <div
        className="flex-1 flex flex-col lg:flex-row items-start justify-center gap-6 lg:gap-12 p-4 lg:p-12 overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Media display */}
        <div className="relative w-full lg:flex-1 lg:max-w-[70vw] flex flex-col items-center lg:sticky lg:top-12">
          {media.length > 0 && current ? (
            <div className="relative w-full aspect-square lg:aspect-auto lg:h-[80vh] bg-neutral-950">
              {current.kind === 'video' ? (
                <video
                  key={current.url}
                  src={current.url}
                  className="absolute inset-0 w-full h-full object-contain"
                  controls
                  autoPlay
                  loop
                  muted
                  playsInline
                />
              ) : canOptimize ? (
                <Image
                  src={current.url}
                  alt={item.name}
                  fill
                  className="object-contain"
                  sizes="(max-width: 1024px) 100vw, 70vw"
                  quality={85}
                  priority
                />
              ) : (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={current.url}
                  alt={item.name}
                  className="absolute inset-0 w-full h-full object-contain"
                  draggable={false}
                />
              )}

              {/* Navigation arrows */}
              {media.length > 1 && (
                <>
                  <button
                    onClick={prev}
                    className="absolute left-2 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center rounded-full bg-black/40 hover:bg-black/70 text-white/70 hover:text-white transition-colors z-10"
                    aria-label="Previous"
                  >
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d="M9 2L4 7l5 5" />
                    </svg>
                  </button>
                  <button
                    onClick={next}
                    className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center rounded-full bg-black/40 hover:bg-black/70 text-white/70 hover:text-white transition-colors z-10"
                    aria-label="Next"
                  >
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d="M5 2l5 5-5 5" />
                    </svg>
                  </button>
                </>
              )}

              {/* Counter */}
              {media.length > 1 && (
                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-black/50 backdrop-blur-sm text-[10px] text-white/80 tracking-wider z-10">
                  {index + 1} / {media.length}
                </div>
              )}
            </div>
          ) : (
            <div className="text-neutral-600 text-sm">No media available</div>
          )}

          {/* Horizontal thumbnail strip — directly under carousel */}
          {media.length > 1 && (
            <div className="w-full mt-3">
              <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
                {media.map((m, i) => (
                  <button
                    key={i}
                    onClick={() => setIndex(i)}
                    className={`relative shrink-0 w-14 h-14 overflow-hidden rounded-sm border transition-all ${
                      i === index ? 'border-white' : 'border-transparent hover:border-neutral-600 opacity-60 hover:opacity-100'
                    }`}
                    aria-label={`Go to media ${i + 1}`}
                  >
                    {m.kind === 'video' ? (
                      <div className="absolute inset-0 bg-neutral-800 flex items-center justify-center">
                        <svg width="14" height="14" viewBox="0 0 10 10" fill="white" className="ml-0.5">
                          <path d="M2 1l7 4-7 4V1z" />
                        </svg>
                      </div>
                    ) : isOptimizableUrl(m.url) ? (
                      <Image src={m.url} alt="" fill className="object-cover" sizes="56px" quality={50} />
                    ) : (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img src={m.url} alt="" className="absolute inset-0 w-full h-full object-cover" draggable={false} />
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Info panel */}
        <div className="w-full lg:w-[380px] shrink-0 text-white">
          <p className="text-[10px] text-neutral-500 tracking-[0.25em] uppercase mb-2">
            ACRONYM{item.season ? ` · ${item.season}` : ''}
          </p>
          <h2 className="text-2xl lg:text-3xl font-light tracking-wide mb-1">
            {item.name}
            {generation && <span className="ml-2 text-sm text-neutral-500 font-mono">Gen. {generation}</span>}
          </h2>
          {subtitle && (
            <p className="text-sm text-neutral-400 leading-relaxed mb-6">{subtitle}</p>
          )}

          {/* Collapsible product details */}
          <div className="border-t border-neutral-800/50">
            {description && (
              <DetailSection label="Description" defaultOpen>
                {renderSdValue(description)}
              </DetailSection>
            )}
            {fabricTechnology != null && (
              <DetailSection label="Fabric Technology">
                {renderSdValue(fabricTechnology)}
              </DetailSection>
            )}
            {sizing != null && (
              <DetailSection label="Sizing">
                {renderSdValue(sizing)}
              </DetailSection>
            )}
            {(subsystems != null || systems != null) && (
              <DetailSection label="Subsystems">
                {renderSdValue(subsystems ?? systems)}
              </DetailSection>
            )}
            {includes != null && (
              <DetailSection label="Includes">
                {renderSdValue(includes)}
              </DetailSection>
            )}
            {interfaceWith != null && (
              <DetailSection label="Interface With">
                {renderSdValue(interfaceWith)}
              </DetailSection>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}

interface PreviewClientProps {
  groups: { season: string; label: string; items: PreviewItem[] }[];
  totalItems: number;
  totalSeasons: number;
}

export function PreviewClient({ groups, totalItems, totalSeasons }: PreviewClientProps) {
  const [selected, setSelected] = useState<PreviewItem | null>(null);

  return (
    <div className="max-w-[1600px] mx-auto px-4 py-10 md:py-16">
      {/* Hero */}
      <div className="mb-16 md:mb-24">
        <h1 className="text-4xl md:text-6xl font-light tracking-[0.15em] text-white mb-4">ACRONYM</h1>
        <p className="text-sm md:text-base text-neutral-500 max-w-xl leading-relaxed">
          {totalItems} objects across {totalSeasons} seasons — from the current collection back through the archive.
        </p>
      </div>

      {/* Season groups */}
      <div className="space-y-14 md:space-y-20">
        {groups.map(group => (
          <section key={group.season} id={`season-${group.season}`}>
            <div className="flex items-baseline gap-4 mb-5 md:mb-7 border-b border-neutral-800/50 pb-3">
              <h2 className="text-xl md:text-2xl font-light tracking-[0.15em] text-white">
                {group.label}
              </h2>
              <span className="text-[10px] text-neutral-600 tracking-wider">{group.items.length}</span>
            </div>

            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-7 xl:grid-cols-8 gap-3 md:gap-4">
              {group.items.map(item => (
                <ItemCard key={item.id} item={item} onClick={() => setSelected(item)} />
              ))}
            </div>
          </section>
        ))}
      </div>

      {/* Footer */}
      <footer className="mt-24 md:mt-32 pt-8 border-t border-neutral-900 text-center">
        <p className="text-[10px] tracking-[0.3em] text-neutral-700 uppercase">
          Typotheca — {new Date().getFullYear()}
        </p>
      </footer>

      {/* Modal */}
      {selected && <PreviewModal item={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
