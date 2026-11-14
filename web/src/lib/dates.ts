// Note: Implementation assisted by AI (Claude Code) following Horum Labs' methodology.
// Day and month indices follow docs/DATA_CONTRACT.md: day index = days since 2003-01-01,
// month index = months since 2012-01. All dates are local Colombian dates, handled as UTC
// calendar dates here so no browser time zone can shift them.

const MS_DAY = 86_400_000;
export const DAY_BASE_UTC = Date.UTC(2003, 0, 1);
export const MONTH_BASE_YEAR = 2012;

export const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const MONTHS_LONG = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
export const WEEKDAYS_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export function ymdToDay(y: number, m: number, d: number): number {
  return Math.round((Date.UTC(y, m, d) - DAY_BASE_UTC) / MS_DAY);
}

export function isoToDay(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number);
  return ymdToDay(y, m - 1, d);
}

export function isValidIso(iso: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(iso) && !Number.isNaN(Date.parse(iso));
}

function dayToDate(day: number): Date {
  return new Date(DAY_BASE_UTC + day * MS_DAY);
}

export function dayToISO(day: number): string {
  return dayToDate(day).toISOString().slice(0, 10);
}

/** y, month (0-11), date, weekday (0 = Monday). */
export function dayParts(day: number) {
  const dt = dayToDate(day);
  return { y: dt.getUTCFullYear(), m: dt.getUTCMonth(), d: dt.getUTCDate(), wd: (dt.getUTCDay() + 6) % 7 };
}

export function monthIndexOfDay(day: number): number {
  const { y, m } = dayParts(day);
  return (y - MONTH_BASE_YEAR) * 12 + m;
}

export function monthIndexToYM(mo: number) {
  return { y: MONTH_BASE_YEAR + Math.floor(mo / 12), m: ((mo % 12) + 12) % 12 };
}

export function monthFirstDay(mo: number): number {
  const { y, m } = monthIndexToYM(mo);
  return ymdToDay(y, m, 1);
}

export function daysInMonth(mo: number): number {
  return monthFirstDay(mo + 1) - monthFirstDay(mo);
}

export function formatDay(day: number, withWeekday = true): string {
  const { y, m, d, wd } = dayParts(day);
  return `${withWeekday ? WEEKDAYS_SHORT[wd] + ', ' : ''}${d} ${MONTHS_SHORT[m]} ${y}`;
}

export function formatMonth(mo: number, long = false): string {
  const { y, m } = monthIndexToYM(mo);
  return `${(long ? MONTHS_LONG : MONTHS_SHORT)[m]} ${y}`;
}

export function formatRange(from: number, to: number): string {
  return `${formatDay(from, false)} – ${formatDay(to, false)}`;
}
