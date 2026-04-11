'use client';

import { cn } from '@/lib/utils';
import type { MonitorStateRow } from '@/lib/supabase/types';

interface WatchRule {
  label: string;
  namePatterns: readonly string[];
  targetSizes?: readonly string[];
  mensOnly: boolean;
}

interface WatchCardProps {
  rule: WatchRule;
  matches: Map<string, MonitorStateRow[]>; // site -> matching products
}

const RETAILER_ORDER = ['arcteryx', 'arcteryx-priority', 'arcteryx-outlet', 'arcteryx-resale', 'rei', 'mec'];
const RETAILER_LABELS: Record<string, string> = {
  arcteryx: "Arc'teryx",
  'arcteryx-priority': 'Priority',
  'arcteryx-outlet': 'Outlet',
  'arcteryx-resale': 'Resale',
  rei: 'REI',
  mec: 'MEC',
};

export function WatchCard({ rule, matches }: WatchCardProps) {
  const retailers = RETAILER_ORDER.filter(r => matches.has(r));
  const anyAvailable = retailers.some(r =>
    (matches.get(r) || []).some(p => p.in_stock)
  );

  return (
    <div className="bg-[#141414] border border-neutral-800 rounded-lg p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white">{rule.label}</h3>
        <span className={cn(
          'w-2.5 h-2.5 rounded-full',
          anyAvailable ? 'bg-emerald-400' : 'bg-neutral-600'
        )} />
      </div>

      {retailers.length === 0 ? (
        <p className="text-xs text-neutral-500">No matches found across monitored retailers</p>
      ) : (
        <div className="space-y-2">
          {retailers.map(site => {
            const products = matches.get(site) || [];
            return (
              <div key={site} className="space-y-1">
                <p className="text-[10px] uppercase tracking-wider text-neutral-500">
                  {RETAILER_LABELS[site] || site}
                </p>
                {products.map(product => (
                  <div key={product.product_id} className="flex items-center justify-between gap-2 py-1">
                    <div className="min-w-0 flex-1">
                      <a
                        href={product.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-neutral-300 hover:text-white truncate block"
                      >
                        {product.name}
                      </a>
                      <p className="text-[10px] text-neutral-600">
                        {product.price && `${product.currency || '$'}${product.price}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {product.in_stock ? (
                        <span className="text-[10px] text-emerald-400">In Stock</span>
                      ) : (
                        <span className="text-[10px] text-red-400">OOS</span>
                      )}
                    </div>
                  </div>
                ))}
                {/* Size availability grid */}
                {rule.targetSizes && products.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {rule.targetSizes.map(size => {
                      const available = products.some(p =>
                        p.sizes.some(s => {
                          const su = s.toUpperCase().trim();
                          const tu = size.toUpperCase().trim();
                          return su === tu || su.includes(tu) || tu.includes(su);
                        })
                      );
                      return (
                        <span
                          key={size}
                          className={cn(
                            'px-1.5 py-0.5 text-[10px] rounded border',
                            available
                              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                              : 'bg-neutral-800 text-neutral-600 border-neutral-700',
                          )}
                        >
                          {size}
                        </span>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
