// Default gallery brands — curated core brands, excludes garbage/bulk scrape data
export const DEFAULT_GALLERY_BRANDS = [
  'acronym', 'arcteryx', 'arcteryx-veilance', 'stone-island', 'stone-island-shadow-project',
];

export interface FilterState {
  brand?: string[];
  cat1?: string;
  cat2?: string;
  cat3?: string;
  season?: string[];
  genre?: string[];
  rarity?: string[];
  price_min?: number;
  price_max?: number;
  in_stock?: boolean;
  copped?: boolean;
  q?: string;
  source_site?: string;
  acronym_category?: string;
  acronym_style?: string;
  sort?: string;
  order?: 'asc' | 'desc';
  view?: 'grid' | 'list';
  group?: string;
}

export function searchParamsToFilters(params: Record<string, string | string[] | undefined>): FilterState {
  const str = (key: string) => {
    const v = params[key];
    return typeof v === 'string' ? v : undefined;
  };
  const list = (key: string) => {
    const v = str(key);
    return v ? v.split(',').filter(Boolean) : undefined;
  };
  const num = (key: string) => {
    const v = str(key);
    return v ? Number(v) : undefined;
  };
  const bool = (key: string) => {
    const v = str(key);
    if (v === 'true') return true;
    if (v === 'false') return false;
    return undefined;
  };

  return {
    brand: list('brand'),
    cat1: str('cat1'),
    cat2: str('cat2'),
    cat3: str('cat3'),
    season: list('season'),
    genre: list('genre'),
    rarity: list('rarity'),
    price_min: num('price_min'),
    price_max: num('price_max'),
    in_stock: bool('in_stock'),
    copped: bool('copped'),
    q: str('q'),
    source_site: str('source_site'),
    acronym_category: str('acronym_category'),
    acronym_style: str('acronym_style'),
    sort: str('sort'),
    order: str('order') as 'asc' | 'desc' | undefined,
    view: str('view') as 'grid' | 'list' | undefined,
    group: str('group'),
  };
}

export function filtersToSearchParams(filters: FilterState): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.brand?.length) params.set('brand', filters.brand.join(','));
  if (filters.cat1) params.set('cat1', filters.cat1);
  if (filters.cat2) params.set('cat2', filters.cat2);
  if (filters.cat3) params.set('cat3', filters.cat3);
  if (filters.season?.length) params.set('season', filters.season.join(','));
  if (filters.genre?.length) params.set('genre', filters.genre.join(','));
  if (filters.rarity?.length) params.set('rarity', filters.rarity.join(','));
  if (filters.price_min != null) params.set('price_min', String(filters.price_min));
  if (filters.price_max != null) params.set('price_max', String(filters.price_max));
  if (filters.in_stock != null) params.set('in_stock', String(filters.in_stock));
  if (filters.copped != null) params.set('copped', String(filters.copped));
  if (filters.q) params.set('q', filters.q);
  if (filters.source_site) params.set('source_site', filters.source_site);
  if (filters.acronym_category) params.set('acronym_category', filters.acronym_category);
  if (filters.acronym_style) params.set('acronym_style', filters.acronym_style);
  if (filters.sort && filters.sort !== 'updated_at') params.set('sort', filters.sort);
  if (filters.order && filters.order !== 'desc') params.set('order', filters.order);
  if (filters.view && filters.view !== 'grid') params.set('view', filters.view);
  if (filters.group) params.set('group', filters.group);
  return params;
}
