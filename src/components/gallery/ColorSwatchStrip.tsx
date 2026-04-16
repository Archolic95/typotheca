'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import type { ColorwaySibling } from '@/hooks/useColorways';

/** Map common color slugs to actual CSS colors */
function colorSlugToCSS(slug: string): string {
  const map: Record<string, string> = {
    black: '#1a1a1a',
    white: '#f5f5f5',
    red: '#dc2626',
    blue: '#3b82f6',
    green: '#22c55e',
    yellow: '#eab308',
    orange: '#f97316',
    pink: '#ec4899',
    purple: '#a855f7',
    grey: '#6b7280',
    gray: '#6b7280',
    navy: '#1e3a5f',
    brown: '#92400e',
    cream: '#fef3c7',
    beige: '#d4b896',
    tan: '#c4a882',
    olive: '#6b8e23',
    maroon: '#7f1d1d',
    coral: '#f87171',
    teal: '#14b8a6',
    indigo: '#6366f1',
    burgundy: '#722f37',
    charcoal: '#374151',
    slate: '#64748b',
    sand: '#d4b896',
    graphite: '#4b5563',
    carbon: '#333333',
    titanium: '#878681',
    platinum: '#e5e7eb',
    gold: '#d4a843',
    copper: '#b87333',
    bronze: '#cd7f32',
    silver: '#c0c0c0',
    chrome: '#dfe1e2',
    stone: '#9ca3af',
    moss: '#5c7a29',
    sage: '#9caf88',
    mint: '#a7f3d0',
    emerald: '#10b981',
    jade: '#00a86b',
    aqua: '#06b6d4',
    cyan: '#22d3ee',
    cobalt: '#0047ab',
    sapphire: '#0f52ba',
    crimson: '#dc143c',
    ruby: '#e0115f',
    magenta: '#ff00ff',
    violet: '#7c3aed',
    lavender: '#c4b5fd',
    mauve: '#e0b0ff',
    rose: '#fb7185',
    salmon: '#fa8072',
    peach: '#ffb07c',
    ivory: '#fffff0',
    champagne: '#f7e7ce',
    wheat: '#f5deb3',
    khaki: '#bdb76b',
    rust: '#b7410e',
    mahogany: '#c04000',
    espresso: '#4e342e',
    walnut: '#5c4033',
    amber: '#f59e0b',
    lemon: '#fde047',
    lime: '#84cc16',
    forest: '#1a4d2e',
    hunter: '#355e3b',
    pine: '#2d5a27',
    arctic: '#d4f1f4',
    ice: '#d4f1f4',
    midnight: '#191970',
    dusk: '#4a4063',
    dawn: '#f3a683',
    sunset: '#fc5c65',
    sunrise: '#feb47b',
    storm: '#5b6c80',
    cloud: '#d1d5db',
    smoke: '#9ca3af',
    ash: '#b0b0b0',
    pewter: '#96a8a1',
    iron: '#6b7280',
    steel: '#71797e',
    lead: '#434651',
    onyx: '#353839',
    jet: '#343434',
    raven: '#2c2c2c',
    void: '#0d0d0d',
    phantom: '#2d2d2d',
    shadow: '#404040',
    // Arc'teryx specific
    pilot: '#394b61',
    nighthawk: '#2c3e50',
    dynasty: '#a8324a',
    flux: '#e67e22',
    yukon: '#9b8f6a',
    tatsu: '#5c6b63',
    elytron: '#7ea87c',
    labyrinth: '#6b4e71',
    magma: '#e64b2e',
    conifer: '#3a6b35',
    kaktos: '#7cb342',
    iliad: '#3d5c8a',
    rhapsody: '#6b3a8a',
    heron: '#7c9fae',
    pytheas: '#4a7c7e',
    kingfisher: '#006f6a',
    poseidon: '#1b4f72',
    basalt: '#484848',
    ether: '#a0c4e8',
    nereus: '#2d6a4f',
    lucent: '#6b8f71',
  };

  // Try direct match
  const lower = slug.toLowerCase();
  if (map[lower]) return map[lower];

  // Try first word of multi-word slug
  const parts = lower.split(/[-_\s]+/);
  for (const part of parts) {
    if (map[part]) return map[part];
  }

  // Hash-based fallback for unknown colors
  let hash = 0;
  for (let i = 0; i < slug.length; i++) {
    hash = slug.charCodeAt(i) + ((hash << 5) - hash);
  }
  const h = Math.abs(hash) % 360;
  return `hsl(${h}, 45%, 55%)`;
}

interface ColorSwatchStripProps {
  currentId: string;
  modelGroup: string;
  siblings?: ColorwaySibling[];
  onSelect?: (id: string) => void;
  maxShow?: number;
  size?: 'sm' | 'md';
}

export function ColorSwatchStrip({
  currentId,
  modelGroup,
  siblings,
  onSelect,
  maxShow = 8,
  size = 'sm',
}: ColorSwatchStripProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  if (!siblings || siblings.length <= 1) return null;

  const displayed = siblings.slice(0, maxShow);
  const remaining = siblings.length - maxShow;
  const dotSize = size === 'sm' ? 'w-2.5 h-2.5' : 'w-3.5 h-3.5';
  const gap = size === 'sm' ? 'gap-0.5' : 'gap-1';

  return (
    <div className={cn('flex items-center', gap)} onClick={e => e.stopPropagation()}>
      {displayed.map(s => {
        const isCurrent = s.id === currentId;
        const cssColor = colorSlugToCSS(s.color_slug);
        return (
          <div
            key={s.id}
            role="button"
            tabIndex={0}
            title={s.color_name}
            onClick={e => {
              e.stopPropagation();
              if (!isCurrent && onSelect) onSelect(s.id);
            }}
            onKeyDown={e => {
              if (e.key === 'Enter' && !isCurrent && onSelect) { e.stopPropagation(); onSelect(s.id); }
            }}
            onMouseEnter={() => setHoveredId(s.id)}
            onMouseLeave={() => setHoveredId(null)}
            className={cn(
              'rounded-full shrink-0 transition-all duration-150 cursor-pointer',
              dotSize,
              isCurrent
                ? 'ring-1.5 ring-white ring-offset-1 ring-offset-[#141414] scale-110'
                : 'hover:scale-125 opacity-70 hover:opacity-100',
            )}
            style={{ backgroundColor: cssColor }}
          />
        );
      })}
      {remaining > 0 && (
        <span className="text-[8px] text-neutral-500 ml-0.5">+{remaining}</span>
      )}
      {/* Tooltip for hovered swatch */}
      {hoveredId && size === 'md' && (
        <span className="text-[10px] text-neutral-400 ml-1">
          {siblings.find(s => s.id === hoveredId)?.color_name}
        </span>
      )}
    </div>
  );
}
