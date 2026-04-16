import { getSupabaseServer } from '@/lib/supabase/server';
import { seasonSortKey } from '@/lib/utils';
import Image from 'next/image';
import { isOptimizableUrl, hasVideo, getFirstVideoUrl } from '@/lib/r2';

export const revalidate = 120;

interface AcronymItem {
  id: string;
  name: string;
  model_code: string | null;
  season: string | null;
  image_urls: string[];
  acronym_category: string | null;
  acronym_style: string | null;
  retail_price: number | null;
  retail_currency: string | null;
  structured_data: Record<string, unknown> | null;
}

/** Get the best displayable image URL (skip relative paths, vimeo) */
function getBestImageUrl(imageUrls: string[]): string | null {
  const candidates = imageUrls.filter(
    u => u.startsWith('http') && !u.includes('player.vimeo.com') && !u.includes('/videos/')
  );
  // Prefer R2 URLs, then any other
  const r2 = candidates.find(u => u.includes('r2.dev'));
  return r2 || candidates[0] || null;
}

/** Season display: "FW24" → "FW24", null → "Unsorted" */
function seasonLabel(s: string | null): string {
  if (!s || s === 'NA') return 'Archive';
  return s;
}

/** Group items by season, ordered newest → oldest */
function groupBySeason(items: AcronymItem[]): { season: string; label: string; items: AcronymItem[] }[] {
  const map = new Map<string, AcronymItem[]>();
  for (const item of items) {
    const key = item.season || 'NA';
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(item);
  }

  return [...map.entries()]
    .sort(([a], [b]) => seasonSortKey(b) - seasonSortKey(a))
    .map(([season, items]) => ({
      season,
      label: seasonLabel(season),
      items,
    }));
}

function ItemCard({ item }: { item: AcronymItem }) {
  const imageUrl = getBestImageUrl(item.image_urls);
  const canOptimize = imageUrl ? isOptimizableUrl(imageUrl) : false;
  const itemHasVideo = hasVideo(item.image_urls);
  const videoUrl = !imageUrl && itemHasVideo ? getFirstVideoUrl(item.image_urls) : null;
  const sd = (item.structured_data || {}) as Record<string, unknown>;
  const subtitle = sd.subtitle as string | undefined;
  // No badges in public preview — clean presentation

  return (
    <article className="group">
      <div className="relative aspect-[3/4] bg-neutral-900 rounded overflow-hidden mb-3">
        {imageUrl && canOptimize ? (
          <Image
            src={imageUrl}
            alt={item.name}
            fill
            className="object-cover object-top transition-transform duration-700 group-hover:scale-[1.03]"
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            loading="lazy"
            quality={75}
          />
        ) : imageUrl ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={imageUrl}
            alt={item.name}
            className="absolute inset-0 w-full h-full object-cover object-top transition-transform duration-700 group-hover:scale-[1.03]"
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
          <div className="absolute inset-0 flex items-center justify-center px-4">
            <span className="text-xs text-neutral-600 font-mono text-center leading-tight">{item.name}</span>
          </div>
        )}
        {/* Video indicator */}
        {itemHasVideo && (
          <div className="absolute bottom-2 right-2">
            <div className="w-6 h-6 flex items-center justify-center rounded-full bg-black/50 backdrop-blur-sm border border-white/10">
              <svg width="8" height="8" viewBox="0 0 10 10" fill="white" className="ml-0.5">
                <path d="M2 1l7 4-7 4V1z" />
              </svg>
            </div>
          </div>
        )}
      </div>
      <div className="px-0.5">
        <h3 className="text-sm font-medium text-white leading-tight">{item.name}</h3>
        {subtitle && (
          <p className="text-xs text-neutral-500 mt-0.5 line-clamp-1">{subtitle}</p>
        )}
        <div className="flex items-center gap-2 mt-1">
          {item.acronym_style && item.acronym_style !== 'NA' && (
            <span className="text-[10px] text-neutral-600">{item.acronym_style}</span>
          )}
          {item.retail_price && (
            <span className="text-[10px] text-neutral-600">
              {item.retail_currency === 'EUR' ? '€' : '$'}{item.retail_price}
            </span>
          )}
        </div>
      </div>
    </article>
  );
}

export default async function PreviewPage() {
  const supabase = await getSupabaseServer();

  // Fetch all ACRONYM items with images
  const { data } = await supabase
    .from('objects')
    .select('id, name, model_code, season, image_urls, acronym_category, acronym_style, retail_price, retail_currency, structured_data')
    .eq('brand', 'acronym')
    .not('image_urls', 'eq', '{}')
    .order('name', { ascending: true })
    .limit(2000);

  const raw = (data || []) as AcronymItem[];

  // Filter to items with at least one displayable image
  // Skip: relative paths, vimeo embeds, empty arrays
  const allItems = raw.filter(item => {
    const imgs = (item.image_urls || []).filter(
      u => u.startsWith('http') && !u.includes('player.vimeo.com') && !u.includes('/videos/')
    );
    return imgs.length > 0;
  });

  const groups = groupBySeason(allItems);

  // Stats
  const totalItems = allItems.length;
  const totalSeasons = groups.filter(g => g.season !== 'NA').length;

  return (
    <div className="max-w-[1400px] mx-auto px-4 py-10 md:py-16">
      {/* Hero */}
      <div className="mb-16 md:mb-24">
        <h1 className="text-4xl md:text-6xl font-light tracking-[0.15em] text-white mb-4">ACRONYM</h1>
        <p className="text-sm md:text-base text-neutral-500 max-w-xl leading-relaxed">
          {totalItems} objects across {totalSeasons} seasons — from the current collection back through the archive.
        </p>
      </div>

      {/* Season groups */}
      <div className="space-y-16 md:space-y-24">
        {groups.map(group => (
          <section key={group.season} id={`season-${group.season}`}>
            {/* Season header */}
            <div className="flex items-baseline gap-4 mb-6 md:mb-8 border-b border-neutral-800/50 pb-3">
              <h2 className="text-2xl md:text-3xl font-light tracking-[0.1em] text-white">
                {group.label}
              </h2>
              <span className="text-xs text-neutral-600">{group.items.length} pieces</span>
            </div>

            {/* Items grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 md:gap-6">
              {group.items.map(item => (
                <ItemCard key={item.id} item={item} />
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
    </div>
  );
}
