// Note: Implementation assisted by AI (Claude Code) following Horum Labs' methodology.
// Types for the web JSON files described in docs/DATA_CONTRACT.md ("Web JSON files").

export interface DeptMeta {
  code: string;
  name: string;
  file: string;
  bytes: number;
}

export type HarmonizationStatus = 'ok' | 'low_confidence' | 'viirs_only' | 'insufficient';

/** Result of the team's MODIS -> VIIRS rule and its leave-one-year-out test (docs/HARMONIZATION.md). */
export interface Harmonization {
  /** True when the national test passed. When false the sensors stay separate. */
  accepted: boolean;
  quantity: string;
  overlap_years: [number, number];
  /** First and last day shown as MODIS rescaled to VIIRS units. */
  modis_era: [string, string];
  /** One factor per calendar month (January first). */
  factors: number[];
  /** Median absolute test error per calendar month, national scale, in percent. */
  national_error_pct: number[];
  national_error_all_months_pct: number;
  modis_no_data_days: string[];
  /** 1 = factor per month only; 2 = factor per month times the department level (docs/HARMONIZATION.md, Part 3). */
  department_version?: number;
  /** "all_areas" since November 15, 2026: every area shows the MODIS era, with warnings (HARMONIZATION.md Part 5). */
  era_scope?: string;
  /** level: the department factor is factors[m] * level (1 in version 1 or with little data). */
  departments: Record<string, { status: HarmonizationStatus; level?: number; error_pct: (number | null)[] }>;
  notice: string;
}

export interface PointsInfo {
  /** Template relative to the web data folder, with {dpto} and {year}. */
  path: string;
  columns: string[];
  first_year: number;
  last_year: number;
  rows: number;
}

export interface Manifest {
  notice: string;
  /** Harmonized quantity: "detections" (hot spots) or "active_cells". */
  quantity?: string;
  quantity_label?: string;
  harmonization?: Harmonization;
  /** Individual accepted detections: one gzipped CSV per department and year. */
  points?: PointsInfo | null;
  day_base: string;
  month_base: string;
  reference_range: [string, string];
  levels: string[];
  status_legend: string[];
  other_sensors: string[];
  windows: { cells_window_days: number; season_half_width_days: number };
  alert_floor_cells: number;
  min_baseline_active_days: number;
  departments: DeptMeta[];
  files: Record<string, string>;
}

export interface StatusFile {
  start: string;
  end: string;
  legend: string[];
  status: number[];
  /** National hot spots per day (same index as status). */
  c?: number[];
  /** National MODIS hot spots per day of the MODIS era, raw (before the monthly factor). */
  modis_era?: { start: string; c: number[] };
}

/** Columnar blocks: one array per column, all of equal length. */
export interface DailyBlock {
  m: number[];
  d: number[];
  /** Hot spots (accepted detections): the harmonized quantity. */
  c: number[];
  /** Active 1 km cells, secondary figure. */
  k?: number[];
}

export interface AlertBlock {
  m: number[];
  d: number[];
  c: number[];
  p75: (number | null)[];
  p90: (number | null)[];
  p975: (number | null)[];
  act: (number | null)[];
  l: number[];
}

export interface MonthlyBlock {
  m: number[];
  mo: number[];
  cd: number[];
  ad: number[];
  nd: number[];
  ok: number[];
  med: (number | null)[];
  ratio: (number | null)[];
  pct: (number | null)[];
}

export interface OtherSensorsBlock {
  legend: string[];
  s: number[];
  m: number[];
  d: number[];
  c: number[];
  k?: number[];
}

export interface Unit {
  code: string;
  name: string;
}

export interface DeptFile {
  code: string;
  name: string;
  municipalities: Unit[];
  daily: DailyBlock;
  other_sensors: OtherSensorsBlock;
  alerts: AlertBlock;
  monthly: MonthlyBlock;
}

export interface NationalFile {
  departments: Unit[];
  alerts: AlertBlock;
  monthly: MonthlyBlock;
  /** Internal anomalies of the MODIS era, for every department with MODIS data. */
  alerts_modis_era?: AlertBlock | null;
}

export type AreaKind = 'department' | 'municipality' | 'polygon' | 'point' | 'bbox';

export interface AreaMember {
  mpio: string;
  dpto: string;
  name: string;
  dptoName: string;
  /** Share of the municipality area inside the drawn shape (1 for whole-unit selections). */
  coverage: number;
}

export interface Area {
  kind: AreaKind;
  /** Stable key used in the URL, e.g. "m:52001", "d:50" or "p:-73.1,4.2;...". */
  key: string;
  label: string;
  sublabel: string;
  members: AreaMember[];
  /** Municipalities touched by a drawn shape but below the 25% coverage rule. */
  excluded?: AreaMember[];
  dptoCodes: string[];
  geometry?: GeoJSON.Polygon;
}

export type Sensor = 'ref' | 'n21' | 'modis';
export type ColorMode = 'cells' | 'level';
export type MapTool = 'select' | 'polygon' | 'rectangle';
