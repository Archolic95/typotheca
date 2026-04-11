'use client';

import { cn } from '@/lib/utils';
import {
  RARITY_COLORS, GENRE_COLORS, CATEGORY_1_COLORS, CATEGORY_2_COLORS,
  AVAILABILITY_COLORS, SHIPPING_COLORS,
} from '@/lib/constants';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'default' | 'rarity' | 'genre' | 'cat1' | 'cat2' | 'availability' | 'shipping' | 'success' | 'warning' | 'danger';
  colorKey?: string;
  className?: string;
  // Legacy support
  rarity?: string;
}

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
  if (rarity && RARITY_COLORS[rarity]) {
    return <span className={cn(base, RARITY_COLORS[rarity], className)}>{children}</span>;
  }

  // Color map variants
  const key = colorKey || (typeof children === 'string' ? children : '');
  const map = COLOR_MAPS[variant];
  if (map && key && map[key]) {
    return <span className={cn(base, map[key], className)}>{children}</span>;
  }

  const variants: Record<string, string> = {
    default: 'bg-neutral-800 text-neutral-300 border-neutral-700',
    success: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
    warning: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
    danger: 'bg-red-500/20 text-red-300 border-red-500/30',
  };

  return <span className={cn(base, variants[variant] || variants.default, className)}>{children}</span>;
}
