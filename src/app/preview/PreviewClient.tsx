'use client';

import { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { isOptimizableUrl, hasVideo, getFirstVideoUrl } from '@/lib/r2';

export interface PreviewItem {
  id: string;
  name: string;
  season: string | null;
  image_urls: string[];
  structured_data: Record<string, unknown> | null;
}

/** Get all displayable image URLs (skip relative paths, vimeo) */
function getDisplayableImages(imageUrls: string[]): string[] {
  return imageUrls.filter(
    u => u.startsWith('http') && !u.includes('player.vimeo.com') && !u.includes('/videos/'),
  );
}

/** Get the best primary image */
function getBestImage(imageUrls: string[]): string | null {
  const candidates = getDisplayableImages(imageUrls);
  const r2 = candidates.find(u => u.includes('r2.dev'));
  return r2 || candidates[0] || null;
}

/** Item card in grid */
function ItemCard({ item, onClick }: { item: PreviewItem; onClick: () => void }) {
  const imageUrl = getBestImage(item.image_urls);
  const canOptimize = imageUrl ? isOptimizableUrl(imageUrl) : false;
  const itemHasVideo = hasVideo(item.image_urls);
  const videoUrl = !imageUrl && itemHasVideo ? getFirstVideoUrl(item.image_urls) : null;

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

/** Detail modal with image carousel */
function PreviewModal({ item, onClose }: { item: PreviewItem; onClose: () => void }) {
  const images = getDisplayableImages(item.image_urls);
  const [index, setIndex] = useState(0);
  const sd = (item.structured_data || {}) as Record<string, unknown>;
  const subtitle = (sd.subtitle as string | undefined) || '';
  const type = (sd.type as string | undefined) || '';
  const generation = (sd.generation as string | undefined) || '';

  const prev = useCallback(() => setIndex(i => (i - 1 + images.length) % images.length), [images.length]);
  const next = useCallback(() => setIndex(i => (i + 1) % images.length), [images.length]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowLeft') prev();
      else if (e.key === 'ArrowRight') next();
    };
    window.addEventListener('keydown', handler);
    // Prevent body scroll while modal open
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', handler);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose, prev, next]);

  const currentImage = images[index];
  const canOptimize = currentImage ? isOptimizableUrl(currentImage) : false;

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-sm flex flex-col"
      onClick={onClose}
    >
      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 z-10 w-10 h-10 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/10 text-white/80 hover:text-white transition-colors"
        aria-label="Close"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M2 2l12 12M14 2L2 14" />
        </svg>
      </button>

      <div
        className="flex-1 flex flex-col lg:flex-row items-center justify-center gap-6 lg:gap-12 p-4 lg:p-12 overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Image display */}
        <div className="relative w-full lg:w-auto lg:h-full lg:max-w-[70vw] flex items-center justify-center">
          {images.length > 0 && currentImage ? (
            <div className="relative w-full aspect-square lg:aspect-auto lg:h-full max-h-[80vh] lg:w-[70vh] lg:max-w-full bg-neutral-950">
              {canOptimize ? (
                <Image
                  src={currentImage}
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
                  src={currentImage}
                  alt={item.name}
                  className="absolute inset-0 w-full h-full object-contain"
                  draggable={false}
                />
              )}

              {/* Navigation arrows */}
              {images.length > 1 && (
                <>
                  <button
                    onClick={prev}
                    className="absolute left-2 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center rounded-full bg-black/40 hover:bg-black/70 text-white/70 hover:text-white transition-colors"
                    aria-label="Previous"
                  >
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d="M9 2L4 7l5 5" />
                    </svg>
                  </button>
                  <button
                    onClick={next}
                    className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center rounded-full bg-black/40 hover:bg-black/70 text-white/70 hover:text-white transition-colors"
                    aria-label="Next"
                  >
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d="M5 2l5 5-5 5" />
                    </svg>
                  </button>
                </>
              )}

              {/* Counter */}
              {images.length > 1 && (
                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-black/50 backdrop-blur-sm text-[10px] text-white/80 tracking-wider">
                  {index + 1} / {images.length}
                </div>
              )}
            </div>
          ) : (
            <div className="text-neutral-600 text-sm">No image available</div>
          )}
        </div>

        {/* Info panel */}
        <div className="w-full lg:w-[340px] shrink-0 text-white">
          <p className="text-[10px] text-neutral-500 tracking-[0.25em] uppercase mb-2">
            ACRONYM{item.season ? ` · ${item.season}` : ''}
          </p>
          <h2 className="text-2xl lg:text-3xl font-light tracking-wide mb-4">{item.name}</h2>

          {subtitle && (
            <p className="text-sm text-neutral-300 leading-relaxed mb-6">
              {subtitle}
            </p>
          )}

          {(type || generation) && (
            <div className="space-y-1.5 pt-4 border-t border-neutral-800/50">
              {type && (
                <div className="flex items-baseline gap-3 text-[11px]">
                  <span className="text-neutral-600 tracking-wider uppercase w-20 shrink-0">Type</span>
                  <span className="text-neutral-300">{type}</span>
                </div>
              )}
              {generation && (
                <div className="flex items-baseline gap-3 text-[11px]">
                  <span className="text-neutral-600 tracking-wider uppercase w-20 shrink-0">Generation</span>
                  <span className="text-neutral-300">{generation}</span>
                </div>
              )}
            </div>
          )}

          {/* Thumbnail strip */}
          {images.length > 1 && (
            <div className="mt-6 pt-4 border-t border-neutral-800/50">
              <div className="flex gap-1.5 flex-wrap">
                {images.map((img, i) => (
                  <button
                    key={i}
                    onClick={() => setIndex(i)}
                    className={`relative w-12 h-12 overflow-hidden rounded-sm border transition-all ${
                      i === index ? 'border-white' : 'border-transparent hover:border-neutral-600 opacity-60 hover:opacity-100'
                    }`}
                  >
                    {isOptimizableUrl(img) ? (
                      <Image src={img} alt="" fill className="object-cover" sizes="48px" quality={50} />
                    ) : (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img src={img} alt="" className="absolute inset-0 w-full h-full object-cover" draggable={false} />
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}
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
