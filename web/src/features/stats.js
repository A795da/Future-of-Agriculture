// Small numeric and calendar helpers shared by the feature and scoring modules.

export const MONTH_DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
export const MONTH_START = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334]; // days before month
export const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Month index 0-11 for a day of year 1-365 (leap days folded into a 365-day year). */
export function monthOfDoy(doy) {
  let m = 11;
  while (m > 0 && MONTH_START[m] >= doy) m--;
  return m;
}

/** Dekad (10-day period) index 0-35 for a day of year: days 1-10, 11-20, 21-end of each month. */
export function dekadOfDoy(doy) {
  const m = monthOfDoy(doy);
  const day = doy - MONTH_START[m];
  return m * 3 + (day <= 10 ? 0 : day <= 20 ? 1 : 2);
}

export function quantile(values, q) {
  const a = values.filter(Number.isFinite).sort((x, y) => x - y);
  if (a.length === 0) return null;
  const pos = (a.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return a[lo] + (a[hi] - a[lo]) * (pos - lo);
}

export const median = (values) => quantile(values, 0.5);

export function mean(values) {
  const a = values.filter(Number.isFinite);
  return a.length ? a.reduce((s, v) => s + v, 0) / a.length : null;
}

export const clamp = (v, lo = 0, hi = 100) => Math.min(hi, Math.max(lo, v));
export const round = (v, d = 0) => (v == null ? null : +v.toFixed(d));
export const sum = (a) => a.reduce((s, v) => s + v, 0);
