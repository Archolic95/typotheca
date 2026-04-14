'use client';

import { cn } from '@/lib/utils';
import {
  RARITY_COLORS, GENRE_COLORS, CATEGORY_1_COLORS, CATEGORY_2_COLORS,
  AVAILABILITY_COLORS, SHIPPING_COLORS,
} from '@/lib/constants';
import { resolveOptionClasses } from '@/lib/optionOrder';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'default' | 'rarity' | 'genre' | 'cat1' | 'cat2' | 'availability' | 'shipping' | 'success' | 'warning' | 'danger';
  colorKey?: string;
  className?: string;
  // Legacy support
  rarity?: string;
}

/** Maps variant names to field names for custom color lookups */
const VARIANT_TO_FIELD: Record<string, string> = {
  rarity: 'notion_rarity',
  genre: 'genre',
  cat1: 'category_1',
  cat2: 'category_2',
  availability: 'notion_availability',
  shipping: 'notion_shipping',
};

const COLOR_MAPS: Record<string, Record<string, string>> = {
  rarity: RARITY_COLORS,
  genre: GENRE_COLORS,
  cat1: CATEGORY_1_COLORS,
  cat2: CATEGORY_2_COLORS,
  availability: AVAILABILITY_COLORS,
  shipping: SHIPPING_COLORS,
};

export function Badge({ children, variant = 'default', colorKey, rarity, className }: BadgeProps) {
  const base = 'inline-flex items-center px-2 py-0.5 text-[11px] font-medium rounded border whitespace-nowrap';

  // Legacy rarity prop
  if (rarity) {
    const classes = resolveOptionClasses('notion_rarity', rarity, RARITY_COLORS);
    if (classes) return <span className={cn(base, classes, className)}>{children}</span>;
  }

  // Color map variants — check custom colors first, then fallback to hardcoded
  const key = colorKey || (typeof children === 'string' ? children : '');
  const field = VARIANT_TO_FIELD[variant];
  if (field && key) {
    const classes = resolveOptionClasses(field, key, COLOR_MAPS[variant]);
    if (classes) return <span className={cn(base, classes, className)}>{children}</span>;
  }

  const variants: Record<string, string> = {
    default: 'bg-neutral-800 text-neutral-300 border-neutral-700',
    success: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
    warning: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
    danger: 'bg-red-500/20 text-red-300 border-red-500/30',
  };

  return <span className={cn(base, variants[variant] || variants.default, className)}>{children}</span>;
}
