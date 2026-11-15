// Note: Implementation assisted by AI (Claude Code) following Horum Labs' methodology.
// Color scales. The sequential scale is four classes sampled from "inferno" (perceptually uniform).
// It was chosen with scripts/check-accessibility.ts (npm run a11y): every class differs from its
// neighbors by at least 10 CIEDE2000 units for normal vision, protanopia, deuteranopia and
// tritanopia, every class has at least 3:1 contrast against the panel, and lightness grows with
// the value, so the order is readable even in grayscale. Six classes could not meet both
// conditions on the dark background (see docs/ACCESSIBILITY.md). Do not edit without rerunning it.

export const CELL_ZERO = '#1a2232';
export const CELL_RAMP = ['#b73557', '#eb6628', '#fcb418', '#fcffa4'];

export const LEVEL_NONE = -1;
export const LEVEL_NORMAL = 0;
export const LEVEL_ELEVATED = 1;
export const LEVEL_UNUSUAL = 2;
export const LEVEL_EXTREME = 3;
export const LEVEL_INSUFFICIENT = 4;

export interface LevelInfo {
  key: string;
  label: string;
  color: string;
  range: string;
  text: string;
}

export const LEVELS: LevelInfo[] = [
  { key: 'normal', label: 'Normal', color: '#3d5f8f', range: 'up to P75', text: '#dce6f5' },
  { key: 'elevated', label: 'Elevated', color: '#f2c14e', range: 'P75 – P90', text: '#231a03' },
  { key: 'unusual', label: 'Unusual', color: '#f57a28', range: 'P90 – P97.5', text: '#260f02' },
  { key: 'extreme', label: 'Extreme', color: '#e5383b', range: 'above P97.5', text: '#1a0203' },
  { key: 'insufficient', label: 'Insufficient history', color: '#7b8494', range: '< 10 baseline active days', text: '#0d1117' },
];

export const NO_ACTIVITY: LevelInfo = {
  key: 'none',
  label: 'No activity',
  color: CELL_ZERO,
  range: '0 hot spots in 7 days',
  text: '#c9d3e3',
};

export function levelInfo(level: number): LevelInfo {
  return level >= 0 && level < LEVELS.length ? LEVELS[level] : NO_ACTIVITY;
}

/** Severity rank used to pick the highest level: none < insufficient < normal < ... < extreme. */
export function levelRank(level: number): number {
  if (level === LEVEL_NONE) return -2;
  if (level === LEVEL_INSUFFICIENT) return -1;
  return level;
}

const NICE = [1, 2, 3, 4, 5, 6, 8, 10, 12, 15, 20, 25, 30, 40, 50, 60, 75, 100, 120, 150, 200, 250, 300, 400, 500, 600, 750, 1000, 1500, 2000, 3000, 5000];

/**
 * Lower thresholds of each color class for a given top value (a high percentile of the
 * non-zero values in view). Classes grow geometrically because the counts are very skewed.
 */
export function makeBins(top: number, low = 1): number[] {
  const n = CELL_RAMP.length;
  if (top <= n) return Array.from({ length: n }, (_, i) => i + 1);
  const lo = Math.max(1, Math.min(low, top / 8));
  const bins: number[] = [1];
  for (let i = 1; i < n; i++) {
    const raw = lo * Math.pow(top / lo, i / (n - 1));
    const nice = NICE.find((v) => v >= raw) ?? Math.round(raw);
    if (nice > bins[bins.length - 1]) bins.push(nice);
  }
  return bins;
}

export function binIndex(value: number, bins: number[]): number {
  if (value <= 0) return -1;
  let k = 0;
  for (let i = 0; i < bins.length; i++) if (value >= bins[i]) k = i;
  return k;
}

export function cellColor(value: number, bins: number[]): string {
  const k = binIndex(value, bins);
  if (k < 0) return CELL_ZERO;
  // Spread classes over the ramp when there are fewer bins than colors.
  const idx = bins.length === 1 ? CELL_RAMP.length - 1 : Math.round((k * (CELL_RAMP.length - 1)) / (bins.length - 1));
  return CELL_RAMP[idx];
}

export function binLabels(bins: number[]): string[] {
  return bins.map((b, i) => {
    const next = bins[i + 1];
    if (next === undefined) return `${b}+`;
    return next - 1 === b ? `${b}` : `${b}–${next - 1}`;
  });
}

export function percentile(sorted: number[], p: number): number {
  if (!sorted.length) return 0;
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.round((p / 100) * (sorted.length - 1))));
  return sorted[idx];
}
