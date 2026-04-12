'use client';

import { useState, useMemo, useCallback } from 'react';
import type { BrandFamily } from '@/lib/constants';
import { DEFAULT_BRAND_FAMILIES, DEFAULT_CATEGORY_HIERARCHY } from '@/lib/constants';
import {
  loadBrandFamilies, saveBrandFamilies,
  loadCategoryHierarchy, saveCategoryHierarchy,
  buildBrandToFamily, buildFamilyByKey,
} from '@/lib/hierarchy';

export function useHierarchy() {
  const [brandFamilies, setBrandFamilies] = useState<BrandFamily[]>(() => loadBrandFamilies());
  const [categoryHierarchy, setCategoryHierarchy] = useState<Record<string, string[]>>(() => loadCategoryHierarchy());

  // Derived lookup maps
  const brandToFamily = useMemo(() => buildBrandToFamily(brandFamilies), [brandFamilies]);
  const familyByKey = useMemo(() => buildFamilyByKey(brandFamilies), [brandFamilies]);

  const updateBrandFamilies = useCallback((families: BrandFamily[]) => {
    setBrandFamilies(families);
    saveBrandFamilies(families);
  }, []);

  const updateCategoryHierarchy = useCallback((hierarchy: Record<string, string[]>) => {
    setCategoryHierarchy(hierarchy);
    saveCategoryHierarchy(hierarchy);
  }, []);

  const resetBrandFamilies = useCallback(() => {
    setBrandFamilies(DEFAULT_BRAND_FAMILIES);
    saveBrandFamilies(DEFAULT_BRAND_FAMILIES);
  }, []);

  const resetCategoryHierarchy = useCallback(() => {
    setCategoryHierarchy(DEFAULT_CATEGORY_HIERARCHY);
    saveCategoryHierarchy(DEFAULT_CATEGORY_HIERARCHY);
  }, []);

  return {
    brandFamilies,
    categoryHierarchy,
    brandToFamily,
    familyByKey,
    updateBrandFamilies,
    updateCategoryHierarchy,
    resetBrandFamilies,
    resetCategoryHierarchy,
  };
}
