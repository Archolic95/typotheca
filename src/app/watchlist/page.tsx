'use client';

import { useState, useEffect, useCallback } from 'react';
import { getSupabaseBrowser } from '@/lib/supabase/client';
import { WatchCard } from '@/components/watchlist/WatchCard';
import { WATCH_RULES } from '@/lib/constants';
import { relativeTime } from '@/lib/utils';
import type { MonitorStateRow } from '@/lib/supabase/types';

function nameMatches(product: MonitorStateRow, rule: typeof WATCH_RULES[number]): boolean {
  const nameLower = product.name.toLowerCase();
  for (const pattern of rule.namePatterns) {
    if (!nameLower.includes(pattern.toLowerCase())) return false;
  }
  if (rule.mensOnly) {
    if (/women'?s?\b/i.test(product.name)) return false;
    if (product.url.includes('/womens/') || product.url.includes('/women/')) return false;
  }
  return true;
}

export default function WatchlistPage() {
  const [allProducts, setAllProducts] = useState<MonitorStateRow[]>([]);
  const [lastRefresh, setLastRefresh] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    const supabase = getSupabaseBrowser();
    const { data } = await supabase.from('monitor_state').select('*');
    if (data) {
      setAllProducts(data as MonitorStateRow[]);
      setLastRefresh(new Date().toISOString());
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  // Build matches per watch rule
  const ruleMatches = WATCH_RULES.map(rule => {
    const matchesBySite = new Map<string, MonitorStateRow[]>();
    for (const product of allProducts) {
      if (nameMatches(product, rule)) {
        const existing = matchesBySite.get(product.site) || [];
        existing.push(product);
        matchesBySite.set(product.site, existing);
      }
    }
    return { rule, matches: matchesBySite };
  });

  return (
    <div className="p-4 md:p-6 max-w-[1200px]">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-lg font-semibold">Watchlist</h1>
        <div className="flex items-center gap-3">
          {lastRefresh && (
            <span className="text-xs text-neutral-500">Updated {relativeTime(lastRefresh)}</span>
          )}
          <button
            onClick={fetchData}
            className="text-xs text-neutral-400 hover:text-white border border-neutral-800 rounded-lg px-3 py-1.5 hover:bg-neutral-800 transition-colors"
          >
            Refresh
          </button>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-neutral-800/30 border border-neutral-800 rounded-lg h-40 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {ruleMatches.map(({ rule, matches }) => (
            <WatchCard key={rule.label} rule={rule} matches={matches} />
          ))}
        </div>
      )}
    </div>
  );
}
