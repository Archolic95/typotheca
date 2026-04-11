import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, ObjectRow } from './types';
import type { FilterState } from '../filters';

// Minimal columns for gallery card view (fast load)
const CARD_COLUMNS = `
  id, brand, name, model_code, season,
  category_1, category_2, genre, retail_price, retail_currency,
  notion_rarity, notion_copped, in_stock,
  image_urls, updated_at
` as const;

// Full columns for list/database views (skip full_text, sections, structured_data)
const LIST_COLUMNS = `
  id, brand, name, model_code, season, designer, collab,
  category_1, category_2, category_3, genre, features,
  retail_price, retail_currency, sizes_available,
  notion_rarity, notion_priority, notion_copped, notion_availability,
  in_stock, limited_edition, discontinued,
  acronym_category, acronym_style, model_index, personal_rating,
  source_url, source_site, image_urls,
  first_seen_at, last_seen_at, updated_at
` as const;

export function buildObjectsQuery(
  supabase: SupabaseClient<Database>,
  filters: FilterState,
  limit = 60,
  offset = 0,
) {
  let query = supabase.from('objects').select(LIST_COLUMNS, { count: 'exact' });

  if (filters.brand?.length) {
    query = query.in('brand', filters.brand);
  }
  if (filters.cat1) {
    query = query.eq('category_1', filters.cat1);
  }
  if (filters.cat2) {
    query = query.eq('category_2', filters.cat2);
  }
  if (filters.cat3) {
    query = query.eq('category_3', filters.cat3);
  }
  if (filters.season?.length) {
    query = query.in('season', filters.season);
  }
  if (filters.genre?.length) {
    query = query.contains('genre', filters.genre);
  }
  if (filters.rarity?.length) {
    query = query.in('notion_rarity', filters.rarity);
  }
  if (filters.price_min != null) {
    query = query.gte('retail_price', filters.price_min);
  }
  if (filters.price_max != null) {
    query = query.lte('retail_price', filters.price_max);
  }
  if (filters.in_stock != null) {
    query = query.eq('in_stock', filters.in_stock);
  }
  if (filters.copped != null) {
    query = query.eq('notion_copped', filters.copped);
  }
  if (filters.q) {
    query = query.textSearch('name', filters.q, { type: 'websearch' });
  }
  if (filters.source_site) {
    query = query.eq('source_site', filters.source_site);
  }
  if (filters.acronym_category) {
    query = query.eq('acronym_category', filters.acronym_category);
  }
  if (filters.acronym_style) {
    query = query.eq('acronym_style', filters.acronym_style);
  }

  const sortCol = filters.sort || 'updated_at';
  const ascending = filters.order === 'asc';
  query = query.order(sortCol, { ascending }).range(offset, offset + limit - 1);

  return query;
}

/**
 * Gallery-optimized query: fewer columns = smaller payload = faster load.
 * Uses CARD_COLUMNS (~10 fields) instead of LIST_COLUMNS (~26 fields).
 */
export function buildGalleryQuery(
  supabase: SupabaseClient<Database>,
  filters: FilterState,
  limit = 60,
  offset = 0,
) {
  let query = supabase.from('objects').select(CARD_COLUMNS, { count: 'exact' });

  if (filters.brand?.length) query = query.in('brand', filters.brand);
  if (filters.cat1) query = query.eq('category_1', filters.cat1);
  if (filters.cat2) query = query.eq('category_2', filters.cat2);
  if (filters.season?.length) query = query.in('season', filters.season);
  if (filters.genre?.length) query = query.contains('genre', filters.genre);
  if (filters.rarity?.length) query = query.in('notion_rarity', filters.rarity);
  if (filters.price_min != null) query = query.gte('retail_price', filters.price_min);
  if (filters.price_max != null) query = query.lte('retail_price', filters.price_max);
  if (filters.in_stock != null) query = query.eq('in_stock', filters.in_stock);
  if (filters.copped != null) query = query.eq('notion_copped', filters.copped);
  if (filters.q) query = query.textSearch('name', filters.q, { type: 'websearch' });
  if (filters.source_site) query = query.eq('source_site', filters.source_site);
  if (filters.acronym_category) query = query.eq('acronym_category', filters.acronym_category);
  if (filters.acronym_style) query = query.eq('acronym_style', filters.acronym_style);

  // When grouping, order by group column first to keep groups contiguous
  if (filters.group) {
    query = query.order(filters.group, { ascending: true, nullsFirst: false });
  }
  const sortCol = filters.sort || 'updated_at';
  const ascending = filters.order === 'asc';
  query = query.order(sortCol, { ascending }).range(offset, offset + limit - 1);

  return query;
}

export type GalleryCardRow = {
  id: string;
  brand: string;
  name: string;
  model_code: string | null;
  season: string | null;
  category_1: string | null;
  category_2: string | null;
  genre: string[] | null;
  retail_price: number | null;
  retail_currency: string | null;
  notion_rarity: string | null;
  notion_copped: boolean;
  in_stock: boolean;
  image_urls: string[] | null;
  updated_at: string;
};

export type ObjectListRow = Pick<ObjectRow,
  'id' | 'brand' | 'name' | 'model_code' | 'season' | 'designer' | 'collab' |
  'category_1' | 'category_2' | 'category_3' | 'genre' | 'features' |
  'retail_price' | 'retail_currency' | 'sizes_available' |
  'notion_rarity' | 'notion_priority' | 'notion_copped' | 'notion_availability' |
  'in_stock' | 'limited_edition' | 'discontinued' |
  'acronym_category' | 'acronym_style' | 'model_index' | 'personal_rating' |
  'source_url' | 'source_site' | 'image_urls' |
  'first_seen_at' | 'last_seen_at' | 'updated_at'
>;
