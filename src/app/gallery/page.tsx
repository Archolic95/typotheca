import { getSupabaseServer } from '@/lib/supabase/server';
import { buildGalleryQuery, type GalleryCardRow } from '@/lib/supabase/queries';
import { searchParamsToFilters, DEFAULT_GALLERY_BRANDS } from '@/lib/filters';
import { ObjectGrid } from '@/components/gallery/ObjectGrid';

export const revalidate = 60;

export default async function GalleryPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const flat: Record<string, string> = {};
  for (const [k, v] of Object.entries(params)) {
    if (typeof v === 'string') flat[k] = v;
    else if (Array.isArray(v) && v[0]) flat[k] = v[0];
  }
  const filters = searchParamsToFilters(flat);
  // Apply default brand filter when no brand is explicitly selected
  if (!filters.brand?.length && !filters.q) {
    filters.brand = DEFAULT_GALLERY_BRANDS;
  }
  const supabase = await getSupabaseServer();
  const isGrouped = !!(filters.groups?.length || filters.group);
  const pageSize = isGrouped ? 500 : 60;
  const { data, count } = await buildGalleryQuery(supabase, filters, pageSize, 0);

  return (
    <div className="px-3 py-4 md:px-6 md:py-6 max-w-[2200px] mx-auto">
      <ObjectGrid
        initialData={(data || []) as GalleryCardRow[]}
        initialCount={count || 0}
      />
    </div>
  );
}
