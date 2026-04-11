import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseService } from '@/lib/supabase/service';

const EDITABLE_FIELDS = new Set([
  'name', 'model_code', 'season', 'designer', 'collab', 'country_of_origin',
  'category_1', 'category_2', 'category_3', 'genre', 'features', 'silhouette',
  'notion_rarity', 'notion_priority', 'notion_copped', 'notion_availability',
  'notion_shipping', 'notion_price_cny',
  'retail_price', 'retail_currency', 'sizes_available',
  'in_stock', 'limited_edition', 'discontinued',
  'personal_notes', 'personal_images', 'personal_rating', 'personal_wear_count',
  'acronym_category', 'acronym_style',
  'image_urls',
]);

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = getSupabaseService();

  const [objRes, colorwaysRes, materialsRes, pricesRes] = await Promise.all([
    supabase.from('objects').select('*').eq('id', id).single(),
    supabase.from('object_colorways').select('*').eq('object_id', id),
    supabase.from('object_materials').select('*').eq('object_id', id),
    supabase.from('price_points').select('*').eq('object_id', id).order('recorded_at', { ascending: false }),
  ]);

  if (objRes.error) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  return NextResponse.json({
    object: objRes.data,
    colorways: colorwaysRes.data || [],
    materials: materialsRes.data || [],
    priceHistory: pricesRes.data || [],
  });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await request.json();

  // Whitelist fields
  const updates: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(body)) {
    if (EDITABLE_FIELDS.has(key)) {
      updates[key] = value;
    }
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No valid fields' }, { status: 400 });
  }

  const supabase = getSupabaseService();
  // @ts-expect-error -- dynamic field updates from whitelist
  const { error } = await supabase.from('objects').update(updates).eq('id', id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
