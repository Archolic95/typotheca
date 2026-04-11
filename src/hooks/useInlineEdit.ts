'use client';

import { useState, useCallback, useRef } from 'react';

export function useInlineEdit() {
  const [pending, setPending] = useState<Set<string>>(new Set());
  const debounceTimers = useRef<Map<string, NodeJS.Timeout>>(new Map());

  const save = useCallback(async (id: string, field: string, value: unknown) => {
    const key = `${id}:${field}`;
    setPending(prev => new Set(prev).add(key));

    // Clear existing debounce for this field
    const existing = debounceTimers.current.get(key);
    if (existing) clearTimeout(existing);

    return new Promise<boolean>((resolve) => {
      debounceTimers.current.set(key, setTimeout(async () => {
        try {
          const res = await fetch(`/api/objects/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ [field]: value }),
          });
          resolve(res.ok);
        } catch {
          resolve(false);
        } finally {
          setPending(prev => {
            const next = new Set(prev);
            next.delete(key);
            return next;
          });
        }
      }, 300));
    });
  }, []);

  const isPending = useCallback((id: string, field: string) => {
    return pending.has(`${id}:${field}`);
  }, [pending]);

  return { save, isPending };
}
