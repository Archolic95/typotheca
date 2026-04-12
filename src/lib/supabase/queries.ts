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

/** Apply common filter conditions to a query */
function applyCommonFilters<T extends { in: any; eq: any; contains: any; gte: any; lte: any; textSearch: any }>(
  query: T,
  filters: FilterState,
): T {
  let q = query;
  if (filters.brand?.length) q = q.in('brand', filters.brand);
  if (filters.cat1) q = q.eq('category_1', filters.cat1);
  if (filters.cat2) q = q.eq('category_2', filters.cat2);
  if (filters.cat3) q = q.eq('category_3', filters.cat3);
  if (filters.season?.length) q = q.in('season', filters.season);
  if (filters.genre?.length) q = q.contains('genre', filters.genre);
  if (filters.rarity?.length) q = q.in('notion_rarity', filters.rarity);
  if (filters.price_min != null) q = q.gte('retail_price', filters.price_min);
  if (filters.price_max != null) q = q.lte('retail_price', filters.price_max);
  if (filters.in_stock != null) q = q.eq('in_stock', filters.in_stock);
  if (filters.copped != null) q = q.eq('notion_copped', filters.copped);
  if (filters.q) q = q.textSearch('name', filters.q, { type: 'websearch' });
  if (filters.source_site) q = q.eq('source_site', filters.source_site);
  if (filters.acronym_category) q = q.eq('acronym_category', filters.acronym_category);
  if (filters.acronym_style) q = q.eq('acronym_style', filters.acronym_style);
  return q;
}

/** Columns that need client-side sort (server can't sort chronologically) or are virtual */
const CLIENT_SORT_COLUMNS = new Set(['season', 'brand_family']);

/** Apply sort conditions to query, skipping client-side-only columns */
function applySorts(query: any, filters: FilterState): any {
  let q = query;
  const sorts = filters.sorts?.length ? filters.sorts : [{ col: 'updated_at', dir: 'desc' as const }];
  let appliedAny = false;

  for (const s of sorts) {
    if (CLIENT_SORT_COLUMNS.has(s.col)) continue; // handled client-side
    q = q.order(s.col, { ascending: s.dir === 'asc' });
    appliedAny = true;
  }
  // Always have a fallback sort for deterministic pagination
  if (!appliedAny) {
    q = q.order('updated_at', { ascending: false });
  }
  return q;
}

export function buildObjectsQuery(
  supabase: SupabaseClient<Database>,
  filters: FilterState,
  limit = 60,
  offset = 0,
) {
  let query = supabase.from('objects').select(LIST_COLUMNS, { count: 'exact' });
  query = applyCommonFilters(query, filters);
  query = applySorts(query, filters);
  query = query.range(offset, offset + limit - 1);
  return query;
}

/**
 * Gallery-optimized query: fewer columns = smaller payload = faster load.
 */
export function buildGalleryQuery(
  supabase: SupabaseClient<Database>,
  filters: FilterState,
  limit = 60,
  offset = 0,
) {
  let query = supabase.from('objects').select(CARD_COLUMNS, { count: 'exact' });
  query = applyCommonFilters(query, filters);

  // When grouping, order by first group column to keep groups contiguous (except season/virtual)
  const groups = filters.groups || [];
  for (const g of groups) {
    if (!CLIENT_SORT_COLUMNS.has(g.col)) {
      query = query.order(g.col, { ascending: g.dir === 'asc', nullsFirst: false });
    }
  }

  query = applySorts(query, filters);
  query = query.range(offset, offset + limit - 1);
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
