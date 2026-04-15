import { getSupabaseServer } from '@/lib/supabase/server';

export const revalidate = 60;

export default async function CollectionPage() {
  const supabase = await getSupabaseServer();

  // Fetch curated products (marked via structured_data.curated or notion_rarity in top tiers)
  const { data: curated } = await supabase
    .from('objects')
    .select('id, name, brand, season, image_urls, structured_data, notion_rarity, category_1, retail_price, retail_currency')
    .eq('brand', 'acronym')
    .not('notion_rarity', 'is', null)
    .in('notion_rarity', ['Unicorn', 'ASAP', 'P00'])
    .not('image_urls', 'is', null)
    .order('notion_rarity')
    .limit(50);

  const items = (curated || []).filter((d: any) => {
    const imgs = (d.image_urls || []).filter((u: string) => !u.includes('/videos/'));
    return imgs.length > 0;
  });

  return (
    <div className="max-w-6xl mx-auto px-4 py-12">
      <div className="text-center mb-16">
        <h1 className="text-3xl font-light tracking-[0.4em] text-white mb-3">COLLECTION</h1>
        <p className="text-sm text-neutral-500 max-w-lg mx-auto">
          A curated selection of the most sought-after pieces from the ACRONYM archive.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {items.map((item: any) => {
          const imgs = (item.image_urls || []).filter((u: string) => !u.includes('/videos/'));
          const firstImg = imgs[0];
          const sd = (item.structured_data || {}) as Record<string, unknown>;
          const subtitle = sd.subtitle as string | undefined;

          return (
            <article key={item.id} className="group">
              <div className="relative aspect-[4/5] bg-neutral-900 rounded-lg overflow-hidden mb-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={firstImg}
                  alt={item.name}
                  className="w-full h-full object-cover object-center transition-transform duration-700 group-hover:scale-105"
                  loading="lazy"
                  draggable={false}
                />
                {item.notion_rarity && (
                  <div className="absolute top-4 left-4">
                    <span className="px-2.5 py-1 text-[10px] font-medium tracking-wider uppercase bg-black/60 backdrop-blur-sm text-white rounded">
                      {item.notion_rarity}
                    </span>
                  </div>
                )}
              </div>
              <div className="px-1">
                <div className="flex items-baseline justify-between mb-1">
                  <h2 className="text-lg font-medium text-white">{item.name}</h2>
                  <span className="text-xs text-neutral-500">{item.season}</span>
                </div>
                {subtitle && (
                  <p className="text-sm text-neutral-400 mb-1">{subtitle}</p>
                )}
                {item.retail_price && (
                  <p className="text-xs text-neutral-600">
                    {item.retail_currency === 'EUR' ? '€' : '$'}{item.retail_price}
                  </p>
                )}
              </div>
            </article>
          );
        })}
      </div>

      {items.length === 0 && (
        <p className="text-center text-neutral-600 py-20">No curated items yet.</p>
      )}
    </div>
  );
}
