// Note: Implementation assisted by AI (Claude Code) following Horum Labs' methodology.
// Types for the web JSON files described in docs/DATA_CONTRACT.md ("Web JSON files").

export interface DeptMeta {
  code: string;
  name: string;
  file: string;
  bytes: number;
}

export interface Manifest {
  notice: string;
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
  /** National active cells per day (same index as status). */
  cells?: number[];
}

/** Columnar blocks: one array per column, all of equal length. */
export interface DailyBlock {
  m: number[];
  d: number[];
  c: number[];
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
