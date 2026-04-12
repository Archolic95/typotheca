import { DEFAULT_BRAND_FAMILIES, DEFAULT_CATEGORY_HIERARCHY } from './constants';
import type { BrandFamily } from './constants';

const BRAND_FAMILIES_KEY = 'typotheca:brandFamilies';
const CATEGORY_HIERARCHY_KEY = 'typotheca:categoryHierarchy';

// ── Brand Families ────────────────────────────────────────────────────

export function loadBrandFamilies(): BrandFamily[] {
  if (typeof window === 'undefined') return DEFAULT_BRAND_FAMILIES;
  try {
    const raw = localStorage.getItem(BRAND_FAMILIES_KEY);
    if (!raw) return DEFAULT_BRAND_FAMILIES;
    const parsed = JSON.parse(raw) as BrandFamily[];
    if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    return DEFAULT_BRAND_FAMILIES;
  } catch {
    return DEFAULT_BRAND_FAMILIES;
  }
}

export function saveBrandFamilies(families: BrandFamily[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(BRAND_FAMILIES_KEY, JSON.stringify(families));
  } catch { /* quota exceeded */ }
}

// ── Category Hierarchy ────────────────────────────────────────────────

export function loadCategoryHierarchy(): Record<string, string[]> {
  if (typeof window === 'undefined') return DEFAULT_CATEGORY_HIERARCHY;
  try {
    const raw = localStorage.getItem(CATEGORY_HIERARCHY_KEY);
    if (!raw) return DEFAULT_CATEGORY_HIERARCHY;
    const parsed = JSON.parse(raw) as Record<string, string[]>;
    if (parsed && typeof parsed === 'object') return parsed;
    return DEFAULT_CATEGORY_HIERARCHY;
  } catch {
    return DEFAULT_CATEGORY_HIERARCHY;
  }
}

export function saveCategoryHierarchy(hierarchy: Record<string, string[]>): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(CATEGORY_HIERARCHY_KEY, JSON.stringify(hierarchy));
  } catch { /* quota exceeded */ }
}

// ── Derived Lookups ───────────────────────────────────────────────────

export function buildBrandToFamily(families: BrandFamily[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const fam of families) {
    for (const b of fam.brands) map.set(b, fam.key);
  }
  return map;
}

export function buildFamilyByKey(families: BrandFamily[]): Map<string, BrandFamily> {
  return new Map(families.map(f => [f.key, f]));
}
