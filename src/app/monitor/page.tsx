'use client';

import { useMonitorRealtime } from '@/hooks/useMonitorRealtime';
import { MonitorCard } from '@/components/monitor/MonitorCard';
import { MONITOR_SITES } from '@/lib/constants';
import { cn } from '@/lib/utils';

export default function MonitorPage() {
  const { products, health, connectionStatus } = useMonitorRealtime();

  return (
    <div className="p-4 md:p-6 max-w-[1400px]">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-lg font-semibold">Monitors</h1>
        <div className="flex items-center gap-2">
          <span className={cn(
            'w-2 h-2 rounded-full',
            connectionStatus === 'connected' && 'bg-emerald-400',
            connectionStatus === 'connecting' && 'bg-amber-400 animate-pulse',
            connectionStatus === 'disconnected' && 'bg-red-400',
          )} />
          <span className="text-xs text-neutral-500 capitalize">{connectionStatus}</span>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <SummaryCard label="Total Products" value={Array.from(products.values()).reduce((sum, arr) => sum + arr.length, 0)} />
        <SummaryCard label="Active Monitors" value={products.size} />
        <SummaryCard label="In Stock" value={Array.from(products.values()).reduce((sum, arr) => sum + arr.filter(p => p.in_stock).length, 0)} />
        <SummaryCard
          label="Recent Errors"
          value={Array.from(health.values()).reduce((sum, arr) => sum + arr.slice(0, 5).filter(h => !h.success).length, 0)}
          danger
        />
      </div>

      {/* Monitor grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {MONITOR_SITES.map(({ key, label, domain }) => (
          <MonitorCard
            key={key}
            site={key}
            label={label}
            domain={domain}
            products={products.get(key) || []}
            healthChecks={health.get(key) || []}
          />
        ))}
      </div>
    </div>
  );
}

function SummaryCard({ label, value, danger }: { label: string; value: number; danger?: boolean }) {
  return (
    <div className="bg-[#141414] border border-neutral-800 rounded-lg p-3">
      <p className={cn('text-2xl font-semibold', danger && value > 0 ? 'text-red-400' : 'text-white')}>
        {value.toLocaleString()}
      </p>
      <p className="text-[11px] text-neutral-500 uppercase tracking-wider mt-0.5">{label}</p>
    </div>
  );
}
