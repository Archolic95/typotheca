export function formatPrice(price: number | null, currency = 'USD'): string {
  if (price == null) return '';
  const symbols: Record<string, string> = { USD: '$', EUR: '\u20AC', GBP: '\u00A3', CAD: 'CA$', CNY: '\u00A5' };
  const symbol = symbols[currency] || `${currency} `;
  return `${symbol}${price.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

export function relativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = now - then;
  const seconds = Math.floor(diff / 1000);
  if (seconds < 5) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

export function truncate(str: string, len: number): string {
  if (str.length <= len) return str;
  return str.slice(0, len - 1) + '\u2026';
}

export function cn(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(' ');
}

import { BRAND_DISPLAY } from '@/lib/constants';

/** Parse season string into a sortable numeric key. SS < FW within same year. */
export function seasonSortKey(season: string | null): number {
  if (!season) return 0;
  const m = season.match(/(SS|FW|AW)(\d{2,4})/);
  if (!m) return 0;
  const year = m[2].length === 2 ? 2000 + parseInt(m[2]) : parseInt(m[2]);
  return year * 10 + (m[1] === 'SS' ? 0 : 5); // SS=0, FW/AW=5
}

export function brandDisplay(brand: string): string {
  return BRAND_DISPLAY[brand] || brand.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}
