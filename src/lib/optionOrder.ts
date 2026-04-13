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
  if (!value || value === '(none)') return 999999;
  const order = getFieldOrder(field);
  const idx = order.indexOf(value);
  return idx >= 0 ? idx : 999998; // unknown values sort just before (none)
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
