'use client';

import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { useMemo, useCallback } from 'react';
import { searchParamsToFilters, filtersToSearchParams, type FilterState } from '@/lib/filters';

export function useFilters() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const filters = useMemo(() => {
    const obj: Record<string, string> = {};
    searchParams.forEach((v, k) => { obj[k] = v; });
    return searchParamsToFilters(obj);
  }, [searchParams]);

  const setFilter = useCallback(
    (key: keyof FilterState, value: FilterState[keyof FilterState]) => {
      const next = { ...filters, [key]: value };
      const params = filtersToSearchParams(next);
      const qs = params.toString();
      router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [filters, router, pathname],
  );

  const setFilters = useCallback(
    (updates: Partial<FilterState>) => {
      const next = { ...filters, ...updates };
      const params = filtersToSearchParams(next);
      const qs = params.toString();
      router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [filters, router, pathname],
  );

  const clearFilters = useCallback(() => {
    router.push(pathname, { scroll: false });
  }, [router, pathname]);

  return { filters, setFilter, setFilters, clearFilters };
}
