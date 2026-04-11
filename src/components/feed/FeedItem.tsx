'use client';

import Image from 'next/image';
import { Badge } from '@/components/ui/Badge';
import { getObjectImageUrl } from '@/lib/r2';
import { formatPrice, brandDisplay, relativeTime } from '@/lib/utils';
import type { ObjectListRow } from '@/lib/supabase/queries';

interface FeedItemProps {
  object: ObjectListRow;
  eventType: 'drop' | 'restock' | 'update';
}

export function FeedItem({ object, eventType }: FeedItemProps) {
  const imageUrl = getObjectImageUrl(object.image_urls);

  return (
    <div className="flex gap-4 p-4 border-b border-neutral-800/50 hover:bg-neutral-800/20 transition-colors">
      {/* Timeline dot */}
      <div className="flex flex-col items-center pt-1 shrink-0">
        <div className={`w-2.5 h-2.5 rounded-full ${
          eventType === 'drop' ? 'bg-emerald-400' : eventType === 'restock' ? 'bg-blue-400' : 'bg-neutral-500'
        }`} />
        <div className="w-px flex-1 bg-neutral-800 mt-2" />
      </div>

      {/* Image */}
      <div className="w-16 h-16 rounded bg-neutral-900 overflow-hidden shrink-0 relative">
        {imageUrl ? (
          <Image src={imageUrl} alt="" fill className="object-cover" sizes="64px" />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-neutral-700">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/></svg>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant={eventType === 'drop' ? 'success' : eventType === 'restock' ? 'default' : 'default'}>
            {eventType === 'drop' ? 'New Drop' : eventType === 'restock' ? 'Restock' : 'Updated'}
          </Badge>
          <span className="text-[10px] text-neutral-500">{relativeTime(object.first_seen_at)}</span>
        </div>

        <div>
          <p className="text-[10px] uppercase tracking-wider text-neutral-500">{brandDisplay(object.brand)}</p>
          <p className="text-sm font-medium text-white">{object.name}</p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {object.retail_price && (
            <span className="text-sm text-neutral-400">{formatPrice(object.retail_price, object.retail_currency)}</span>
          )}
          {object.notion_rarity && <Badge rarity={object.notion_rarity}>{object.notion_rarity}</Badge>}
          {object.sizes_available?.length > 0 && (
            <span className="text-[10px] text-neutral-500">
              {object.sizes_available.length} sizes
            </span>
          )}
          <a
            href={object.source_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[10px] text-blue-400 hover:text-blue-300"
          >
            View &rarr;
          </a>
        </div>
      </div>
    </div>
  );
}
