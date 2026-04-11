'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import {
  loadViews, saveView, loadActiveViewId, saveActiveViewId,
  DEFAULT_VIEWS,
} from '@/lib/views';
import type { ViewConfig } from '@/lib/views';

type SortDir = 'asc' | 'desc';

const DEFAULT_VIEW_FOR_ROUTE: Record<string, string> = {
  gallery: 'gallery-default',
  database: 'main',
};

export function useViewConfig(route: 'gallery' | 'database') {
  // Load views and active view id once on mount
  const [views, setViews] = useState<ViewConfig[]>(() => loadViews());
  const [activeViewId, setActiveViewId] = useState<string>(() => {
    return loadActiveViewId(route) || DEFAULT_VIEW_FOR_ROUTE[route] || 'main';
  });

  const activeView = views.find(v => v.id === activeViewId)
    || views.find(v => v.id === DEFAULT_VIEW_FOR_ROUTE[route])
    || DEFAULT_VIEWS[0];

  // Debounced save ref
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingView = useRef<ViewConfig | null>(null);

  const flushSave = useCallback(() => {
    if (pendingView.current) {
      saveView(pendingView.current);
      pendingView.current = null;
    }
  }, []);

  const debouncedSave = useCallback((view: ViewConfig) => {
    pendingView.current = view;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(flushSave, 300);
  }, [flushSave]);

  // Flush on unmount
  useEffect(() => () => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    flushSave();
  }, [flushSave]);

  const updateView = useCallback((updates: Partial<ViewConfig>) => {
    setViews(prev => {
      const next = prev.map(v => v.id === activeViewId ? { ...v, ...updates } : v);
      const updated = next.find(v => v.id === activeViewId);
      if (updated) debouncedSave(updated);
      return next;
    });
  }, [activeViewId, debouncedSave]);

  const setSort = useCallback((col: string, dir?: SortDir) => {
    updateView({ sort: { col, dir: dir || 'desc' } });
  }, [updateView]);

  const setGroup = useCallback((group: string | undefined) => {
    updateView({ group });
  }, [updateView]);

  const setColumns = useCallback((columns: string[]) => {
    updateView({ columns });
  }, [updateView]);

  const setFilters = useCallback((filters: { column: string; values: string[] }[]) => {
    updateView({ filters });
  }, [updateView]);

  const switchView = useCallback((id: string) => {
    setActiveViewId(id);
    saveActiveViewId(route, id);
  }, [route]);

  const createView = useCallback((name: string, type: 'gallery' | 'table') => {
    const id = `custom-${Date.now()}`;
    const newView: ViewConfig = {
      id,
      name,
      type,
      columns: activeView.columns,
      sort: activeView.sort,
      group: activeView.group,
      filters: activeView.filters,
    };
    setViews(prev => [...prev, newView]);
    saveView(newView);
    switchView(id);
    return id;
  }, [activeView, switchView]);

  const renameView = useCallback((id: string, name: string) => {
    setViews(prev => {
      const next = prev.map(v => v.id === id ? { ...v, name } : v);
      const updated = next.find(v => v.id === id);
      if (updated) saveView(updated);
      return next;
    });
  }, []);

  return {
    views,
    activeView,
    activeViewId,
    setSort,
    setGroup,
    setColumns,
    setFilters,
    switchView,
    createView,
    renameView,
    updateView,
  };
}
