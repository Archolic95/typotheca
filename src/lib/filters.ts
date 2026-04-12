// Default gallery brands — curated core brands, excludes garbage/bulk scrape data
export const DEFAULT_GALLERY_BRANDS = [
  'acronym', 'arcteryx', 'arcteryx-veilance', 'stone-island', 'stone-island-shadow-project',
];

/** A single sort condition: column + direction */
export interface SortCondition {
  col: string;
  dir: 'asc' | 'desc';
}

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
  /** Multiple sort conditions: first is primary, second is tiebreaker, etc. */
  sorts?: SortCondition[];
  view?: 'grid' | 'list';
  /** Multiple group levels with sort direction (e.g. group by season desc, then by category asc) */
  groups?: SortCondition[];

  // Legacy single sort/group — kept for backward compat during transition
  sort?: string;
  order?: 'asc' | 'desc';
  group?: string;
  groupOrder?: 'asc' | 'desc';
}

/** Parse "col:dir,col:dir" into SortCondition[] */
function parseSorts(s: string): SortCondition[] {
  return s.split(',').filter(Boolean).map(part => {
    const [col, dir] = part.split(':');
    return { col, dir: dir === 'asc' ? 'asc' : 'desc' };
  });
}

function serializeSorts(sorts: SortCondition[]): string {
  return sorts.map(s => `${s.col}:${s.dir}`).join(',');
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

  // Parse multi-sort and multi-group
  const sortsRaw = str('sorts');
  const groupsRaw = list('groups');

  // Legacy fallback
  const sort = str('sort');
  const order = str('order') as 'asc' | 'desc' | undefined;
  const group = str('group');
  const groupOrder = str('groupOrder') as 'asc' | 'desc' | undefined;

  // Build sorts array: prefer new `sorts` param, fall back to legacy `sort`+`order`
  let sorts: SortCondition[] | undefined;
  if (sortsRaw) {
    sorts = parseSorts(sortsRaw);
  } else if (sort) {
    sorts = [{ col: sort, dir: order || 'desc' }];
  }

  // Build groups array: prefer new `groups` param (col:dir format), fall back to legacy `group`
  const groupsRawStr = str('groups');
  let groups: SortCondition[] | undefined;
  if (groupsRawStr) {
    groups = parseSorts(groupsRawStr); // same col:dir format as sorts
  } else if (group) {
    groups = [{ col: group, dir: groupOrder || 'desc' }];
  }

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
    sorts,
    view: str('view') as 'grid' | 'list' | undefined,
    groups,
    // Keep legacy fields populated for backward compat
    sort: sorts?.[0]?.col,
    order: sorts?.[0]?.dir,
    group: groups?.[0]?.col,
    groupOrder: groups?.[0]?.dir,
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

  // Multi-sort
  if (filters.sorts?.length) {
    const nonDefault = filters.sorts.filter(s => !(s.col === 'updated_at' && s.dir === 'desc'));
    if (nonDefault.length > 0 || filters.sorts.length > 1) {
      params.set('sorts', serializeSorts(filters.sorts));
    }
  }

  if (filters.view && filters.view !== 'grid') params.set('view', filters.view);

  // Multi-group (same col:dir format as sorts)
  if (filters.groups?.length) params.set('groups', serializeSorts(filters.groups));

  return params;
}
