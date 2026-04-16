import { getSupabaseServer } from '@/lib/supabase/server';
import { seasonSortKey } from '@/lib/utils';
import { PreviewClient, type PreviewItem } from './PreviewClient';

export const revalidate = 120;

/** Season display: "FW24" → "FW24", null → "Archive" */
function seasonLabel(s: string | null): string {
  if (!s || s === 'NA') return 'Archive';
  return s;
}

/** Group items by season, newest → oldest */
function groupBySeason(items: PreviewItem[]): { season: string; label: string; items: PreviewItem[] }[] {
  const map = new Map<string, PreviewItem[]>();
  for (const item of items) {
    const key = item.season || 'NA';
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(item);
  }
  return [...map.entries()]
    .sort(([a], [b]) => seasonSortKey(b) - seasonSortKey(a))
    .map(([season, items]) => ({ season, label: seasonLabel(season), items }));
}

export default async function PreviewPage() {
  const supabase = await getSupabaseServer();

  const { data } = await supabase
    .from('objects')
    .select('id, name, season, image_urls, structured_data')
    .eq('brand', 'acronym')
    .not('image_urls', 'eq', '{}')
    .order('name', { ascending: true })
    .limit(2000);

  const raw = (data || []) as PreviewItem[];

  // Filter to items with at least one displayable image
  const allItems = raw.filter(item => {
    const imgs = (item.image_urls || []).filter(
      u => u.startsWith('http') && !u.includes('player.vimeo.com') && !u.includes('/videos/'),
    );
    return imgs.length > 0;
  });

  const groups = groupBySeason(allItems);
  const totalItems = allItems.length;
  const totalSeasons = groups.filter(g => g.season !== 'NA').length;

  return <PreviewClient groups={groups} totalItems={totalItems} totalSeasons={totalSeasons} />;
}
