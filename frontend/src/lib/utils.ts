import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs));

/** Indian number formatting: ₹1,25,000 */
export const formatINR = (n: number, fractionDigits = 0) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: fractionDigits }).format(n);

export const formatNumberIN = (n: number) => new Intl.NumberFormat('en-IN').format(n);

export const formatMl = (ml: number) => (ml >= 1000 ? `${(ml / 1000).toFixed(ml % 1000 === 0 ? 0 : 2).replace(/0$/, '')} L` : `${ml} ml`);

export const pct = (v: number, total: number) => (total > 0 ? Math.min(100, Math.round((v / total) * 100)) : 0);
