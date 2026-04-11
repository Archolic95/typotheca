'use client';

import Image from 'next/image';
import { Badge } from '@/components/ui/Badge';
import { getObjectImageUrl, isOptimizableUrl } from '@/lib/r2';
import { formatPrice, brandDisplay, cn } from '@/lib/utils';
import type { GalleryCardRow } from '@/lib/supabase/queries';

interface ObjectCardProps {
  object: GalleryCardRow;
  onClick: () => void;
  priority?: boolean;
}

export function ObjectCard({ object, onClick, priority = false }: ObjectCardProps) {
  const imageUrl = getObjectImageUrl(object.image_urls);
  const canOptimize = imageUrl ? isOptimizableUrl(imageUrl) : false;

  return (
    <button
      onClick={onClick}
      className="group text-left bg-[#141414] rounded-lg border border-neutral-800/50 overflow-hidden hover:border-neutral-700 transition-all hover:shadow-lg hover:shadow-black/20 hover:-translate-y-0.5"
    >
      {/* Image */}
      <div className="aspect-[4/5] bg-neutral-900 relative overflow-hidden">
        {imageUrl && canOptimize ? (
          <Image
            src={imageUrl}
            alt={object.name}
            fill
            className="object-cover group-hover:scale-[1.02] transition-transform duration-300"
            sizes="(max-width: 480px) 50vw, (max-width: 640px) 33vw, (max-width: 768px) 25vw, (max-width: 1024px) 20vw, (max-width: 1280px) 16vw, (max-width: 1536px) 14vw, 12.5vw"
            priority={priority}
            loading={priority ? 'eager' : 'lazy'}
            quality={60}
          />
        ) : imageUrl ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={imageUrl}
            alt={object.name}
            className="absolute inset-0 w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-300"
            loading={priority ? 'eager' : 'lazy'}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-neutral-700">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>
          </div>
        )}
        {/* Badges overlay */}
        <div className="absolute top-1.5 left-1.5 sm:top-2 sm:left-2 flex flex-wrap gap-1">
          {object.notion_rarity && (
            <Badge rarity={object.notion_rarity}>{object.notion_rarity}</Badge>
          )}
          {object.notion_copped && (
            <Badge variant="success">Copped</Badge>
          )}
          {!object.in_stock && (
            <Badge variant="danger">OOS</Badge>
          )}
        </div>
      </div>

      {/* Info */}
      <div className="p-2 sm:p-3 space-y-0.5 sm:space-y-1">
        <p className="text-[9px] sm:text-[10px] uppercase tracking-wider text-neutral-500 font-medium truncate">
          {brandDisplay(object.brand)}
          {object.season && <span className="ml-1.5 sm:ml-2 text-neutral-600">{object.season}</span>}
        </p>
        <p className="text-xs sm:text-sm font-medium text-white leading-tight line-clamp-2">{object.name}</p>
        <div className="flex items-center justify-between">
          <p className="text-xs sm:text-sm text-neutral-400">
            {formatPrice(object.retail_price, object.retail_currency ?? undefined)}
          </p>
          {object.category_2 && (
            <p className="text-[9px] sm:text-[10px] text-neutral-600 truncate ml-1">{object.category_2}</p>
          )}
        </div>
      </div>
    </button>
  );
}

export function ObjectRow({ object, onClick }: Omit<ObjectCardProps, 'priority'>) {
  const imageUrl = getObjectImageUrl(object.image_urls);
  const canOptimize = imageUrl ? isOptimizableUrl(imageUrl) : false;

  return (
    <button
      onClick={onClick}
      className="w-full text-left flex items-center gap-3 sm:gap-4 p-2.5 sm:p-3 border-b border-neutral-800/50 hover:bg-neutral-800/30 transition-colors"
    >
      <div className="w-10 h-10 sm:w-12 sm:h-12 rounded bg-neutral-900 overflow-hidden shrink-0 relative">
        {imageUrl && canOptimize ? (
          <Image src={imageUrl} alt="" fill className="object-cover" sizes="48px" loading="lazy" quality={50} />
        ) : imageUrl ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={imageUrl} alt="" className="absolute inset-0 w-full h-full object-cover" loading="lazy" />
        ) : null}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs sm:text-sm font-medium text-white truncate">{object.name}</p>
        <p className="text-[10px] sm:text-xs text-neutral-500 truncate">
          {brandDisplay(object.brand)}
          {object.season && ` \u00B7 ${object.season}`}
          {object.category_2 && ` \u00B7 ${object.category_2}`}
        </p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {object.notion_rarity && <Badge rarity={object.notion_rarity}>{object.notion_rarity}</Badge>}
        <p className={cn('text-xs sm:text-sm', object.retail_price ? 'text-neutral-300' : 'text-neutral-600')}>
          {formatPrice(object.retail_price, object.retail_currency ?? undefined)}
        </p>
      </div>
    </button>
  );
}
