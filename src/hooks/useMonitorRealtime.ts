'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { getSupabaseBrowser } from '@/lib/supabase/client';
import type { MonitorStateRow, ScraperHealthRow } from '@/lib/supabase/types';
import type { RealtimeChannel } from '@supabase/supabase-js';

interface MonitorData {
  products: Map<string, MonitorStateRow[]>; // site -> products
  health: Map<string, ScraperHealthRow[]>;  // source_slug -> health checks
  connectionStatus: 'connecting' | 'connected' | 'disconnected';
}

export function useMonitorRealtime(): MonitorData {
  const [products, setProducts] = useState<Map<string, MonitorStateRow[]>>(new Map());
  const [health, setHealth] = useState<Map<string, ScraperHealthRow[]>>(new Map());
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');
  const channelRef = useRef<RealtimeChannel | null>(null);

  // Initial fetch
  useEffect(() => {
    const supabase = getSupabaseBrowser();

    async function load() {
      const [monitorRes, healthRes] = await Promise.all([
        supabase.from('monitor_state').select('*'),
        supabase.from('scraper_health').select('*').order('run_at', { ascending: false }).limit(500),
      ]);

      if (monitorRes.data) {
        const map = new Map<string, MonitorStateRow[]>();
        for (const row of monitorRes.data as MonitorStateRow[]) {
          const existing = map.get(row.site) || [];
          existing.push(row);
          map.set(row.site, existing);
        }
        setProducts(map);
      }

      if (healthRes.data) {
        const map = new Map<string, ScraperHealthRow[]>();
        for (const row of healthRes.data as ScraperHealthRow[]) {
          const existing = map.get(row.source_slug) || [];
          existing.push(row);
          map.set(row.source_slug, existing);
        }
        setHealth(map);
      }
    }

    load();
  }, []);

  // Realtime subscription
  useEffect(() => {
    const supabase = getSupabaseBrowser();

    const channel = supabase.channel('monitor-dashboard')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'monitor_state',
      }, (payload) => {
        const row = payload.new as MonitorStateRow;
        if (!row.site) return;
        setProducts(prev => {
          const next = new Map(prev);
          const existing = [...(next.get(row.site) || [])];
          const idx = existing.findIndex(p => p.product_id === row.product_id);
          if (payload.eventType === 'DELETE') {
            if (idx >= 0) existing.splice(idx, 1);
          } else {
            if (idx >= 0) existing[idx] = row;
            else existing.push(row);
          }
          next.set(row.site, existing);
          return next;
        });
      })
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'scraper_health',
      }, (payload) => {
        const row = payload.new as ScraperHealthRow;
        setHealth(prev => {
          const next = new Map(prev);
          const existing = [row, ...(next.get(row.source_slug) || [])].slice(0, 50);
          next.set(row.source_slug, existing);
          return next;
        });
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') setConnectionStatus('connected');
        else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') setConnectionStatus('disconnected');
      });

    channelRef.current = channel;

    return () => {
      channel.unsubscribe();
    };
  }, []);

  return { products, health, connectionStatus };
}
