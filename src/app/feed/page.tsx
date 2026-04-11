import { getSupabaseServer } from '@/lib/supabase/server';
import { FeedItem } from '@/components/feed/FeedItem';
import type { ObjectListRow } from '@/lib/supabase/queries';
import Link from 'next/link';

export const revalidate = 60;

const PAGE_SIZE = 50;

const LIST_COLUMNS = `
  id, brand, name, model_code, season, designer, collab,
  category_1, category_2, category_3, genre, features,
  retail_price, retail_currency, sizes_available,
  notion_rarity, notion_priority, notion_copped, notion_availability,
  in_stock, limited_edition, discontinued,
  source_url, source_site, image_urls,
  first_seen_at, last_seen_at, updated_at
`;

export default async function FeedPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const cursor = typeof params.cursor === 'string' ? params.cursor : undefined;

  const supabase = await getSupabaseServer();

  let query = supabase
    .from('objects')
    .select(LIST_COLUMNS)
    .order('first_seen_at', { ascending: false })
    .limit(PAGE_SIZE);

  if (cursor) {
    query = query.lt('first_seen_at', cursor);
  }

  const { data } = await query;
  const objects = (data || []) as ObjectListRow[];

  // Determine event type
  const getEventType = (obj: ObjectListRow): 'drop' | 'restock' | 'update' => {
    const firstSeen = new Date(obj.first_seen_at).getTime();
    const lastSeen = new Date(obj.last_seen_at).getTime();
    const created = new Date(obj.updated_at).getTime();

    // If first_seen and last_seen are close together, it's a new drop
    if (Math.abs(lastSeen - firstSeen) < 24 * 60 * 60 * 1000) return 'drop';
    // If last_seen is much later than first_seen, it's likely a restock/update
    if (lastSeen - firstSeen > 7 * 24 * 60 * 60 * 1000) return 'restock';
    return 'update';
  };

  const nextCursor = objects.length === PAGE_SIZE
    ? objects[objects.length - 1].first_seen_at
    : null;

  return (
    <div className="p-4 md:p-6 max-w-[800px]">
      <h1 className="text-lg font-semibold mb-4">Drop Feed</h1>

      {objects.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-neutral-500">No drops yet</p>
        </div>
      ) : (
        <div className="border border-neutral-800 rounded-lg overflow-hidden">
          {objects.map(obj => (
            <FeedItem
              key={obj.id}
              object={obj}
              eventType={getEventType(obj)}
            />
          ))}
        </div>
      )}

      {/* Pagination */}
      <div className="flex justify-center mt-6 gap-3">
        {cursor && (
          <Link
            href="/feed"
            className="text-sm text-neutral-400 hover:text-white border border-neutral-800 rounded-lg px-4 py-2 hover:bg-neutral-800 transition-colors"
          >
            Latest
          </Link>
        )}
        {nextCursor && (
          <Link
            href={`/feed?cursor=${encodeURIComponent(nextCursor)}`}
            className="text-sm text-neutral-400 hover:text-white border border-neutral-800 rounded-lg px-4 py-2 hover:bg-neutral-800 transition-colors"
          >
            Older &rarr;
          </Link>
        )}
      </div>
    </div>
  );
}
