'use client';

import { relativeTime, cn } from '@/lib/utils';
import type { MonitorStateRow, ScraperHealthRow } from '@/lib/supabase/types';

interface MonitorCardProps {
  site: string;
  label: string;
  domain: string;
  products: MonitorStateRow[];
  healthChecks: ScraperHealthRow[];
}

export function MonitorCard({ site, label, domain, products, healthChecks }: MonitorCardProps) {
  const productCount = products.length;
  const inStockCount = products.filter(p => p.in_stock).length;

  // Find most recent activity
  const lastPoll = products.reduce<string | null>((latest, p) => {
    if (!latest || p.last_seen_at > latest) return p.last_seen_at;
    return latest;
  }, null);

  // Health status
  const recentHealth = healthChecks.slice(0, 20);
  const lastHealth = recentHealth[0];
  const errorsIn24h = recentHealth.filter(h => !h.success).length;
  const avgDuration = recentHealth.length > 0
    ? Math.round(recentHealth.reduce((sum, h) => sum + (h.duration_ms || 0), 0) / recentHealth.length)
    : 0;

  // Status determination
  let status: 'green' | 'yellow' | 'red' = 'green';
  if (!lastPoll) {
    status = 'red';
  } else {
    const age = Date.now() - new Date(lastPoll).getTime();
    if (age > 10 * 60 * 1000) status = 'red';
    else if (age > 2 * 60 * 1000) status = 'yellow';
  }
  if (lastHealth && !lastHealth.success) status = 'red';

  return (
    <div className="bg-[#141414] border border-neutral-800 rounded-lg p-4 space-y-3">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className={cn(
              'w-2 h-2 rounded-full',
              status === 'green' && 'bg-emerald-400',
              status === 'yellow' && 'bg-amber-400',
              status === 'red' && 'bg-red-400',
            )} />
            <span className="text-sm font-medium text-white">{label}</span>
          </div>
          <p className="text-[11px] text-neutral-500 mt-0.5">{domain}</p>
        </div>
        {lastPoll && (
          <span className="text-[11px] text-neutral-500">{relativeTime(lastPoll)}</span>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2">
        <Stat label="Products" value={productCount} />
        <Stat label="In Stock" value={inStockCount} />
        <Stat label="Errors (24h)" value={errorsIn24h} danger={errorsIn24h > 0} />
      </div>

      {/* Health sparkline */}
      {recentHealth.length > 0 && (
        <div className="flex items-end gap-0.5 h-6">
          {recentHealth.slice(0, 20).reverse().map((h, i) => (
            <div
              key={i}
              className={cn(
                'w-full rounded-sm min-w-[3px]',
                h.success ? 'bg-emerald-500/40' : 'bg-red-500/60',
              )}
              style={{ height: `${Math.max(20, Math.min(100, (h.duration_ms || 0) / 50))}%` }}
              title={`${h.success ? 'OK' : 'FAIL'} - ${h.duration_ms}ms - ${new Date(h.run_at).toLocaleTimeString()}`}
            />
          ))}
        </div>
      )}

      {/* Avg duration */}
      {avgDuration > 0 && (
        <p className="text-[10px] text-neutral-600">Avg poll: {avgDuration}ms</p>
      )}
    </div>
  );
}

function Stat({ label, value, danger }: { label: string; value: number; danger?: boolean }) {
  return (
    <div>
      <p className={cn('text-lg font-medium', danger ? 'text-red-400' : 'text-white')}>{value}</p>
      <p className="text-[10px] text-neutral-500 uppercase tracking-wider">{label}</p>
    </div>
  );
}
