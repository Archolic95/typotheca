/**
 * Option Ordering Store
 *
 * Persists user-defined ordering for select/multi-select field options.
 * The array position IS the sort key — index 0 sorts first.
 * Falls back to hardcoded default arrays from constants.ts.
 */

import {
  RARITY_LEVELS, GENRE_OPTIONS, CATEGORY_1_OPTIONS, SEASON_OPTIONS,
  ACRONYM_CATEGORIES, ACRONYM_STYLES, AVAILABILITY_OPTIONS, SHIPPING_OPTIONS,
} from './constants';

type OptionOrdering = Record<string, string[]>;

const STORAGE_KEY = 'typotheca:optionOrdering';

/** Default orderings from constants — used when no custom order is saved */
const DEFAULTS: OptionOrdering = {
  notion_rarity: [...RARITY_LEVELS],
  genre: [...GENRE_OPTIONS],
  category_1: [...CATEGORY_1_OPTIONS],
  season: [...SEASON_OPTIONS],
  acronym_category: [...ACRONYM_CATEGORIES],
  acronym_style: [...ACRONYM_STYLES],
  notion_availability: [...AVAILABILITY_OPTIONS],
  notion_shipping: [...SHIPPING_OPTIONS],
};

let _cache: OptionOrdering | undefined;

export function loadOptionOrdering(): OptionOrdering {
  if (_cache) return _cache;
  if (typeof window === 'undefined') return { ...DEFAULTS };
  let result: OptionOrdering;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    result = raw ? { ...DEFAULTS, ...JSON.parse(raw) } : { ...DEFAULTS };
  } catch {
    result = { ...DEFAULTS };
  }
  _cache = result;
  return result;
}

export function saveOptionOrdering(ordering: OptionOrdering): void {
  _cache = ordering;
  if (typeof window === 'undefined') return;
  // Only save fields that differ from defaults
  const diff: OptionOrdering = {};
  for (const [field, order] of Object.entries(ordering)) {
    const def = DEFAULTS[field];
    if (!def || JSON.stringify(order) !== JSON.stringify(def)) {
      diff[field] = order;
    }
  }
  try {
    if (Object.keys(diff).length > 0) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(diff));
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  } catch { /* quota exceeded, ignore */ }
}

/** Get the ordered options for a field */
export function getFieldOrder(field: string): string[] {
  const ordering = loadOptionOrdering();
  return ordering[field] || [];
}

/** Set the ordered options for a field and persist */
export function setFieldOrder(field: string, order: string[]): void {
  const ordering = loadOptionOrdering();
  ordering[field] = order;
  saveOptionOrdering(ordering);
}

/**
 * Get the sort key for a value in a field's option order.
 * Returns the index in the ordered array. Unknown values get a high index (sorted to end).
 */
export function optionSortKey(field: string, value: string | null): number {
  const order = getFieldOrder(field);
  if (!value || value === '(none)') {
    // Check if the field has a "None" option — use its position
    const noneIdx = order.indexOf('None');
    if (noneIdx >= 0) return noneIdx;
    return 999999;
  }
  const idx = order.indexOf(value);
  return idx >= 0 ? idx : 999998;
}

/** Merge new values into an existing field order (append at end, don't reorder existing) */
export function mergeNewValues(field: string, newValues: string[]): string[] {
  const existing = getFieldOrder(field);
  const existingSet = new Set(existing);
  const toAdd = newValues.filter(v => !existingSet.has(v));
  if (toAdd.length === 0) return existing;
  const merged = [...existing, ...toAdd];
  setFieldOrder(field, merged);
  return merged;
}

// ── Custom Option Colors ─────────────────────────────────────────────

/** Color palette available for options — Tailwind classes */
export const COLOR_PALETTE = [
  { key: 'neutral', bg: 'bg-neutral-500/20', text: 'text-neutral-300', border: 'border-neutral-500/30', label: 'Gray' },
  { key: 'red', bg: 'bg-red-500/20', text: 'text-red-300', border: 'border-red-500/30', label: 'Red' },
  { key: 'orange', bg: 'bg-orange-500/20', text: 'text-orange-300', border: 'border-orange-500/30', label: 'Orange' },
  { key: 'amber', bg: 'bg-amber-700/20', text: 'text-amber-300', border: 'border-amber-700/30', label: 'Brown' },
  { key: 'yellow', bg: 'bg-yellow-500/20', text: 'text-yellow-300', border: 'border-yellow-500/30', label: 'Yellow' },
  { key: 'emerald', bg: 'bg-emerald-500/20', text: 'text-emerald-300', border: 'border-emerald-500/30', label: 'Green' },
  { key: 'blue', bg: 'bg-blue-500/20', text: 'text-blue-300', border: 'border-blue-500/30', label: 'Blue' },
  { key: 'purple', bg: 'bg-purple-500/20', text: 'text-purple-300', border: 'border-purple-500/30', label: 'Purple' },
  { key: 'pink', bg: 'bg-pink-500/20', text: 'text-pink-300', border: 'border-pink-500/30', label: 'Pink' },
  { key: 'none', bg: '', text: '', border: '', label: 'No color' },
] as const;

export type ColorKey = typeof COLOR_PALETTE[number]['key'];

type OptionColors = Record<string, Record<string, ColorKey>>; // field → value → colorKey

const COLORS_STORAGE_KEY = 'typotheca:optionColors';
let _colorsCache: OptionColors | undefined;

export function loadOptionColors(): OptionColors {
  if (_colorsCache) return _colorsCache;
  if (typeof window === 'undefined') return {};
  let result: OptionColors;
  try {
    const raw = localStorage.getItem(COLORS_STORAGE_KEY);
    result = raw ? JSON.parse(raw) : {};
  } catch {
    result = {};
  }
  _colorsCache = result;
  return result;
}

export function saveOptionColors(colors: OptionColors): void {
  _colorsCache = colors;
  if (typeof window === 'undefined') return;
  try {
    const nonEmpty = Object.fromEntries(
      Object.entries(colors).filter(([, v]) => Object.keys(v).length > 0)
    );
    if (Object.keys(nonEmpty).length > 0) {
      localStorage.setItem(COLORS_STORAGE_KEY, JSON.stringify(nonEmpty));
    } else {
      localStorage.removeItem(COLORS_STORAGE_KEY);
    }
  } catch { /* */ }
}

/** Get the custom color key for a specific option value in a field, or undefined for default */
export function getOptionColorKey(field: string, value: string): ColorKey | undefined {
  const colors = loadOptionColors();
  return colors[field]?.[value];
}

/** Set the color key for a specific option value */
export function setOptionColorKey(field: string, value: string, colorKey: ColorKey): void {
  const colors = loadOptionColors();
  if (!colors[field]) colors[field] = {};
  if (colorKey === 'none') {
    delete colors[field][value];
  } else {
    colors[field][value] = colorKey;
  }
  saveOptionColors(colors);
}

/**
 * Resolve the Tailwind class string for an option.
 * Priority: custom color (localStorage) > hardcoded color (constants) > null (no color)
 */
export function resolveOptionClasses(field: string, value: string, fallbackMap?: Record<string, string>): string | null {
  const customKey = getOptionColorKey(field, value);
  if (customKey) {
    const palette = COLOR_PALETTE.find(c => c.key === customKey);
    if (palette && palette.key !== 'none') return `${palette.bg} ${palette.text} ${palette.border}`;
  }
  // Fallback to hardcoded color map
  if (fallbackMap && fallbackMap[value]) return fallbackMap[value];
  return null;
}
