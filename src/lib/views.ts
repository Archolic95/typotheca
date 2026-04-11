import { DEFAULT_TABLE_COLUMNS } from './columns';

export interface ViewConfig {
  id: string;
  name: string;
  type: 'gallery' | 'table';
  columns: string[];
  sort: { col: string; dir: 'asc' | 'desc' };
  group?: string;
  filters: { column: string; values: string[] }[];
  builtIn?: boolean; // true for default views that can't be deleted
}

const STORAGE_KEY = 'typotheca:views';
const ACTIVE_VIEW_PREFIX = 'typotheca:activeView:';

// ── Default Views ──────────────────────────────────────────────────────

export const DEFAULT_VIEWS: ViewConfig[] = [
  {
    id: 'gallery-default',
    name: 'Gallery',
    type: 'gallery',
    columns: ['name', 'brand', 'season', 'category_2', 'retail_price', 'notion_rarity'],
    sort: { col: 'updated_at', dir: 'desc' },
    filters: [],
    builtIn: true,
  },
  {
    id: 'typology',
    name: 'Typology',
    type: 'table',
    columns: ['name', 'category_1', 'category_2', 'category_3', 'season', 'brand', 'notion_rarity'],
    sort: { col: 'name', dir: 'asc' },
    group: 'genre',
    filters: [],
    builtIn: true,
  },
  {
    id: 'ranking',
    name: 'Ranking',
    type: 'table',
    columns: ['name', 'notion_rarity', 'brand', 'notion_copped', 'notion_availability'],
    sort: { col: 'notion_priority', dir: 'asc' },
    group: 'notion_rarity',
    filters: [],
    builtIn: true,
  },
  {
    id: 'brand',
    name: 'Brand',
    type: 'table',
    columns: ['name', 'brand', 'category_1', 'category_2', 'season', 'genre', 'notion_rarity'],
    sort: { col: 'name', dir: 'asc' },
    group: 'brand',
    filters: [],
    builtIn: true,
  },
  {
    id: 'main',
    name: 'Main List',
    type: 'table',
    columns: DEFAULT_TABLE_COLUMNS,
    sort: { col: 'updated_at', dir: 'desc' },
    filters: [],
    builtIn: true,
  },
  {
    id: 'shop-tracker',
    name: 'Shop Tracker',
    type: 'table',
    columns: ['name', 'brand', 'notion_rarity', 'notion_copped', 'notion_availability', 'notion_shipping', 'notion_price_cny', 'retail_price'],
    sort: { col: 'notion_priority', dir: 'asc' },
    filters: [],
    builtIn: true,
  },
];

// ── localStorage CRUD ──────────────────────────────────────────────────

export function loadViews(): ViewConfig[] {
  if (typeof window === 'undefined') return DEFAULT_VIEWS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_VIEWS;
    const stored = JSON.parse(raw) as ViewConfig[];
    // Merge: stored views override defaults by id, add any missing defaults
    const byId = new Map(stored.map(v => [v.id, v]));
    for (const dv of DEFAULT_VIEWS) {
      if (!byId.has(dv.id)) byId.set(dv.id, dv);
    }
    return [...byId.values()];
  } catch {
    return DEFAULT_VIEWS;
  }
}

export function saveViews(views: ViewConfig[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(views));
  } catch { /* quota exceeded — ignore */ }
}

export function saveView(view: ViewConfig): void {
  const views = loadViews();
  const idx = views.findIndex(v => v.id === view.id);
  if (idx >= 0) views[idx] = view;
  else views.push(view);
  saveViews(views);
}

export function deleteView(id: string): void {
  const views = loadViews().filter(v => v.id !== id || v.builtIn);
  saveViews(views);
}

export function loadActiveViewId(route: string): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return localStorage.getItem(ACTIVE_VIEW_PREFIX + route);
  } catch {
    return null;
  }
}

export function saveActiveViewId(route: string, id: string): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(ACTIVE_VIEW_PREFIX + route, id);
  } catch { /* ignore */ }
}
