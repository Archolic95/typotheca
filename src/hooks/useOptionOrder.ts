'use client';

import { useState, useCallback, useMemo } from 'react';
import {
  loadOptionOrdering, saveOptionOrdering, getFieldOrder,
  setFieldOrder, optionSortKey, mergeNewValues,
} from '@/lib/optionOrder';

/**
 * React hook for managing option ordering.
 * Provides reactive state so components re-render when order changes.
 */
export function useOptionOrder() {
  const [version, setVersion] = useState(0);

  // Force re-read from cache on version bump
  const ordering = useMemo(() => loadOptionOrdering(), [version]); // eslint-disable-line react-hooks/exhaustive-deps

  const getOrder = useCallback((field: string): string[] => {
    return ordering[field] || getFieldOrder(field);
  }, [ordering]);

  const setOrder = useCallback((field: string, order: string[]) => {
    setFieldOrder(field, order);
    setVersion(v => v + 1); // trigger re-render
  }, []);

  const sortKey = useCallback((field: string, value: string | null): number => {
    return optionSortKey(field, value);
  }, [ordering]); // eslint-disable-line react-hooks/exhaustive-deps

  const merge = useCallback((field: string, newValues: string[]): string[] => {
    const result = mergeNewValues(field, newValues);
    setVersion(v => v + 1);
    return result;
  }, []);

  const resetField = useCallback((field: string) => {
    // Remove custom order — will fall back to defaults
    const o = loadOptionOrdering();
    delete o[field];
    saveOptionOrdering(o);
    setVersion(v => v + 1);
  }, []);

  return { getOrder, setOrder, sortKey, merge, resetField };
}
