import { Badge } from '@/components/ui/Badge';
import { formatPrice, brandDisplay } from '@/lib/utils';
import {
  ACRONYM_CATEGORIES, ACRONYM_STYLES,
  BRANDS, BRAND_DISPLAY, CATEGORY_1_OPTIONS, RARITY_LEVELS, GENRE_OPTIONS,
  AVAILABILITY_OPTIONS, SHIPPING_OPTIONS,
} from '@/lib/constants';

export interface ColumnDef {
  key: string;
  label: string;
  width: number;
  editable?: boolean;
  type?: 'text' | 'select' | 'multi-select' | 'boolean' | 'number';
  options?: string[];
  filterable?: boolean;
  groupable?: boolean;
  sortable?: boolean;
  icon?: string; // type icon for sort dropdown: Aa, #, ☑, ≡, ◉
  render?: (row: any) => React.ReactNode;
}

export const ALL_COLUMNS: Record<string, ColumnDef> = {
  brand: { key: 'brand', label: 'Brand', width: 120, filterable: true, groupable: true, sortable: true, icon: '≡', render: (r) => <Badge variant="default">{brandDisplay(r.brand)}</Badge> },
  name: { key: 'name', label: 'Name', width: 260, editable: true, type: 'text', sortable: true, icon: 'Aa' },
  model_code: { key: 'model_code', label: 'Model', width: 100, editable: true, type: 'text', filterable: true, sortable: true, icon: 'Aa' },
  season: { key: 'season', label: 'Season', width: 80, editable: true, type: 'text', filterable: true, groupable: true, sortable: true, icon: 'Aa' },
  category_1: { key: 'category_1', label: '1st Category', width: 100, editable: true, type: 'select', options: [...CATEGORY_1_OPTIONS, 'Equipment', 'Footwear', 'Optics'], filterable: true, groupable: true, sortable: true, icon: '◉', render: (r) => r.category_1 ? <Badge variant="cat1" colorKey={r.category_1}>{r.category_1}</Badge> : <span className="text-neutral-600">-</span> },
  category_2: { key: 'category_2', label: '2nd Category', width: 160, editable: true, type: 'text', filterable: true, groupable: true, sortable: true, icon: 'Aa', render: (r) => r.category_2 ? <Badge variant="cat2" colorKey={r.category_2}>{r.category_2}</Badge> : <span className="text-neutral-600">-</span> },
  category_3: { key: 'category_3', label: '3rd Category', width: 140, editable: true, type: 'text', sortable: true, icon: 'Aa' },
  genre: { key: 'genre', label: 'Genre', width: 200, editable: true, type: 'multi-select', options: [...GENRE_OPTIONS], filterable: true, groupable: true, sortable: true, icon: '≡', render: (r) => r.genre?.length ? r.genre.map((g: string) => <Badge key={g} variant="genre" colorKey={g} className="mr-0.5 mb-0.5">{g}</Badge>) : <span className="text-neutral-600">-</span> },
  retail_price: { key: 'retail_price', label: 'Price', width: 80, editable: true, type: 'number', sortable: true, icon: '#', render: (r) => <span className="text-neutral-300">{formatPrice(r.retail_price, r.retail_currency)}</span> },
  notion_rarity: { key: 'notion_rarity', label: 'Rarity', width: 90, editable: true, type: 'select', options: [...RARITY_LEVELS], filterable: true, groupable: true, sortable: true, icon: '◉', render: (r) => r.notion_rarity ? <Badge rarity={r.notion_rarity}>{r.notion_rarity}</Badge> : <span className="text-neutral-600">-</span> },
  notion_priority: { key: 'notion_priority', label: 'Order', width: 60, editable: true, type: 'number', sortable: true, icon: '#' },
  notion_copped: { key: 'notion_copped', label: 'Copped?', width: 65, editable: true, type: 'boolean', filterable: true, sortable: true, icon: '☑' },
  notion_availability: { key: 'notion_availability', label: 'Availability', width: 160, editable: true, type: 'select', options: [...AVAILABILITY_OPTIONS], filterable: true, groupable: true, sortable: true, icon: '◉', render: (r) => r.notion_availability ? <Badge variant="availability" colorKey={r.notion_availability}>{r.notion_availability}</Badge> : <span className="text-neutral-600">-</span> },
  notion_shipping: { key: 'notion_shipping', label: 'Shipping', width: 140, editable: true, type: 'select', options: [...SHIPPING_OPTIONS], filterable: true, sortable: true, icon: '◉', render: (r) => r.notion_shipping ? <Badge variant="shipping" colorKey={r.notion_shipping}>{r.notion_shipping}</Badge> : <span className="text-neutral-600">-</span> },
  notion_price_cny: { key: 'notion_price_cny', label: 'Price CNY', width: 90, editable: true, type: 'number', sortable: true, icon: '#', render: (r) => r.notion_price_cny ? <span className="text-neutral-300">{'\u00A5'}{r.notion_price_cny}</span> : <span className="text-neutral-600">-</span> },
  in_stock: { key: 'in_stock', label: 'Stock', width: 55, filterable: true, sortable: true, icon: '☑', render: (r) => r.in_stock ? <span className="text-emerald-400 text-xs">Yes</span> : <span className="text-red-400 text-xs">No</span> },
  source_site: { key: 'source_site', label: 'Source', width: 120, filterable: true, groupable: true, sortable: true, icon: 'Aa', render: (r) => <span className="text-xs text-neutral-500">{r.source_site}</span> },
  acronym_category: { key: 'acronym_category', label: 'Acrn Type', width: 100, editable: true, type: 'select', options: [...ACRONYM_CATEGORIES], filterable: true, groupable: true, sortable: true, icon: '◉' },
  acronym_style: { key: 'acronym_style', label: 'Acrn Style', width: 100, editable: true, type: 'select', options: [...ACRONYM_STYLES], filterable: true, groupable: true, sortable: true, icon: '◉' },
  personal_rating: { key: 'personal_rating', label: 'Rating', width: 70, editable: true, type: 'number', sortable: true, icon: '#', render: (r) => r.personal_rating ? <span className="text-yellow-400">{'★'.repeat(r.personal_rating)}{'☆'.repeat(5 - r.personal_rating)}</span> : <span className="text-neutral-600">-</span> },
  personal_notes: { key: 'personal_notes', label: 'Notes', width: 200, editable: true, type: 'text', icon: 'Aa' },
  designer: { key: 'designer', label: 'Designer', width: 120, editable: true, type: 'text', sortable: true, icon: 'Aa' },
  collab: { key: 'collab', label: 'Collab', width: 100, editable: true, type: 'text', sortable: true, icon: 'Aa' },
  // Virtual columns (derived client-side, not real DB columns)
  brand_family: { key: 'brand_family', label: 'Brand Family', width: 140, groupable: true, sortable: true, filterable: true, type: 'text', icon: '≡' },
  // Timestamp columns (sortable only, not editable)
  updated_at: { key: 'updated_at', label: 'Updated', width: 100, sortable: true, icon: '#' },
  first_seen_at: { key: 'first_seen_at', label: 'First Seen', width: 100, sortable: true, icon: '#' },
  model_index: { key: 'model_index', label: 'Model Index', width: 80, sortable: true, icon: '#' },
};

export const DEFAULT_TABLE_COLUMNS = ['name', 'brand', 'model_code', 'season', 'category_1', 'category_2', 'genre', 'retail_price', 'notion_rarity', 'notion_copped', 'personal_rating'];

export function getSortableColumns(): ColumnDef[] {
  return Object.values(ALL_COLUMNS).filter(c => c.sortable);
}

export function getFilterableColumns(): ColumnDef[] {
  return Object.values(ALL_COLUMNS).filter(c => c.filterable);
}

export function getGroupableColumns(): ColumnDef[] {
  return Object.values(ALL_COLUMNS).filter(c => c.groupable);
}

/** Get filter options for a column from predefined lists */
export function getColumnFilterOptions(col: ColumnDef): { value: string; label: string }[] | null {
  if (col.options) return col.options.map(o => ({ value: o, label: o }));
  if (col.key === 'brand') return BRANDS.map(b => ({ value: b, label: BRAND_DISPLAY[b] || b }));
  if (col.type === 'boolean') return [{ value: 'true', label: 'Yes' }, { value: 'false', label: 'No' }];
  return null; // caller should derive from loaded data
}
