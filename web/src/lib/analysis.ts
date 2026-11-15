// Note: Implementation assisted by AI (Claude Code) following Horum Labs' methodology.
// Turns the columnar JSON files into the series the web app draws. Nothing here changes the
// team's method (docs/METHOD.md): anomaly levels and percentiles come precomputed from the
// data pipeline. This module only adds municipalities together for multi-municipality areas
// and recomputes the "same month in other years" comparison for those sums, with the same
// rule the pipeline uses for single units (checked by scripts/verify-analysis.ts).

import type { AlertBlock, Area, DeptFile, Harmonization, HarmonizationStatus, NationalFile, StatusFile } from './types.ts';
import {
  LEVEL_EXTREME, LEVEL_INSUFFICIENT, LEVEL_NONE, LEVEL_UNUSUAL, levelRank,
} from './colors.ts';
import { dayParts, isoToDay, monthFirstDay, monthIndexOfDay, monthIndexToYM, ymdToDay } from './dates.ts';

// ---------------------------------------------------------------- indexing

/** Row indices of a columnar block grouped by unit `m`, each group sorted by `key`. */
export function groupRows(m: number[], key: number[], count: number): Int32Array[] {
  const sizes = new Int32Array(count);
  for (const v of m) sizes[v]++;
  const groups = Array.from({ length: count }, (_, i) => new Int32Array(sizes[i]));
  const fill = new Int32Array(count);
  for (let i = 0; i < m.length; i++) groups[m[i]][fill[m[i]]++] = i;
  for (const g of groups) {
    let sorted = true;
    for (let i = 1; i < g.length; i++) if (key[g[i]] < key[g[i - 1]]) { sorted = false; break; }
    if (!sorted) g.sort((a, b) => key[a] - key[b]);
  }
  return groups;
}

/** Binary search for the row whose key equals `target` inside one group. */
export function findRow(rows: Int32Array, key: number[], target: number): number {
  let lo = 0;
  let hi = rows.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const v = key[rows[mid]];
    if (v === target) return rows[mid];
    if (v < target) lo = mid + 1;
    else hi = mid - 1;
  }
  return -1;
}

export interface IndexedDept {
  file: DeptFile;
  mpioIndex: Map<string, number>;
  dailyRows: Int32Array[];
  alertRows: Int32Array[];
  otherRows: Int32Array[];
}

export function indexDept(file: DeptFile): IndexedDept {
  const n = file.municipalities.length;
  return {
    file,
    mpioIndex: new Map(file.municipalities.map((u, i) => [u.code, i])),
    dailyRows: groupRows(file.daily.m, file.daily.d, n),
    alertRows: groupRows(file.alerts.m, file.alerts.d, n),
    otherRows: groupRows(file.other_sensors.m, file.other_sensors.d, n),
  };
}

export interface IndexedNational {
  file: NationalFile;
  deptIndex: Map<string, number>;
  alertRows: Int32Array[];
  monthlyRows: Int32Array[];
  /** Rows of alerts_modis_era per department, or null when the file has none. */
  eraRows: Int32Array[] | null;
}

export function indexNational(file: NationalFile): IndexedNational {
  const n = file.departments.length;
  return {
    file,
    deptIndex: new Map(file.departments.map((u, i) => [u.code, i])),
    alertRows: groupRows(file.alerts.m, file.alerts.d, n),
    monthlyRows: groupRows(file.monthly.m, file.monthly.mo, n),
    eraRows: file.alerts_modis_era ? groupRows(file.alerts_modis_era.m, file.alerts_modis_era.d, n) : null,
  };
}

export interface RefContext {
  refStart: number;
  refEnd: number;
  /** Status code per reference day: 0 S-NPP, 1 NOAA-20 fill, 2 no data. */
  status: Int8Array;
  /** National hot spots per reference day (sum of all municipalities), or null with an older status.json. */
  nationalCells: Int32Array | null;
  /** The accepted harmonization rule, or null when the test failed or the data has none. */
  harm: Harmonization | null;
  /** 1 on the days of the MODIS era without MODIS data, indexed by day since 2003-01-01. */
  eraNoData: Uint8Array;
  /** National MODIS rescaled to VIIRS units (estimated), indexed by day since 2003-01-01, before refStart. */
  nationalEra: Float64Array | null;
}

/** MODIS value of one day converted to VIIRS-equivalent units with the factor of its calendar month,
 *  times the department level when given (1 = national factor). */
export function rescale(harm: Harmonization, day: number, raw: number, level = 1): number {
  return raw * harm.factors[dayParts(day).m] * level;
}

export function makeRefContext(range: [string, string], statusFile: StatusFile, harmonization?: Harmonization): RefContext {
  const refStart = isoToDay(range[0]);
  const refEnd = isoToDay(range[1]);
  const status = new Int8Array(refEnd - refStart + 1).fill(-1);
  const nationalCells = statusFile.c ? new Int32Array(refEnd - refStart + 1) : null;
  const off = isoToDay(statusFile.start) - refStart;
  statusFile.status.forEach((s, i) => {
    const k = i + off;
    if (k >= 0 && k < status.length) {
      status[k] = s;
      if (nationalCells && statusFile.c) nationalCells[k] = statusFile.c[i];
    }
  });
  const harm = harmonization && harmonization.accepted ? harmonization : null;
  const eraNoData = new Uint8Array(Math.max(0, refStart));
  let nationalEra: Float64Array | null = null;
  if (harm) {
    for (const iso of harm.modis_no_data_days) {
      const d = isoToDay(iso);
      if (d >= 0 && d < refStart) eraNoData[d] = 1;
    }
    if (statusFile.modis_era) {
      const values = new Float64Array(refStart);
      const start = isoToDay(statusFile.modis_era.start);
      statusFile.modis_era.c.forEach((v, i) => {
        const d = start + i;
        if (d >= 0 && d < refStart) values[d] = rescale(harm, d, v);
      });
      nationalEra = values;
    }
  }
  return { refStart, refEnd, status, nationalCells, harm, eraNoData, nationalEra };
}

export const STATUS_SNPP = 0;
export const STATUS_N20 = 1;
export const STATUS_NODATA = 2;

// ---------------------------------------------------------------- area series

export interface AlertSnapshot {
  c: number;
  p75: number | null;
  p90: number | null;
  p975: number | null;
  act: number | null;
  l: number;
}

function snapshot(a: AlertBlock, r: number): AlertSnapshot {
  return { c: a.c[r], p75: a.p75[r], p90: a.p90[r], p975: a.p975[r], act: a.act[r], l: a.l[r] };
}

export interface MonthStat {
  mo: number;
  y: number;
  m: number;
  cd: number;
  ad: number;
  nd: number;
  days: number;
  ok: boolean;
  /** Day-of-month range covered (and compared): 1..days in month for complete months. */
  d1: number;
  d2: number;
  med: number | null;
  ratio: number | null;
  pct: number | null;
  histYears: number;
}

/** How tested the MODIS era of the area is. Since November 15, 2026 every area shows it (team decision,
 *  docs/HARMONIZATION.md Part 5); this says which warning goes with it. 'rule_not_accepted' = not shown. */
export type EraReason = 'shown' | 'department_failed' | 'insufficient' | 'scale_not_tested' | 'rule_not_accepted';

/** MODIS rescaled to VIIRS units for the days before the VIIRS reference starts. Estimates, not observations. */
export interface EraSeries {
  /** Estimated hot spots per day, indexed by day since 2003-01-01 (length refStart). */
  est: Float64Array;
  /** 7-day total of `est`. */
  est7: Float64Array;
  /** Internal anomaly level of the MODIS era (against 2003-2011 only), -1 when none (only departments have it). */
  level: Int8Array;
  /** Test status of the department, or 'not_tested' for municipalities and drawn areas. */
  status: HarmonizationStatus | 'not_tested';
  /** Median test error of this department per calendar month, percent (null when not evaluable or not tested). */
  errorPct: (number | null)[];
  /** Department level multiplied into the monthly factor (1 = national factor), null when the area spans
   *  several departments with different levels. */
  factorLevel: number | null;
  /** True when the area has internal MODIS-era anomaly levels (departments only). */
  hasLevels: boolean;
}

export interface AreaSeries {
  /** MODIS era in VIIRS-equivalent units, for every area (warning by eraReason); null only if the rule was not accepted. */
  era: EraSeries | null;
  eraReason: EraReason;
  refStart: number;
  refEnd: number;
  /** Reference series in hot spots (VIIRS S-NPP, NOAA-20 fill), indexed by day - refStart. */
  cells: Int32Array;
  cells7: Int32Array;
  level: Int8Array;
  /** 1 when the level shown comes from the department fallback (insufficient history). */
  fallback: Uint8Array;
  /** Member index that sets the area level that day (-1 when none). */
  driver: Int16Array;
  memberCells: Int32Array[];
  /** Active 1 km cells of the reference series (secondary figure), same index as `cells`. */
  activeCells: Int32Array;
  /** Informational NOAA-21 series, same index as `cells`. */
  n21: Int32Array;
  /** MODIS Collection 6.1 series, indexed by day since 2003-01-01. */
  modis: Int32Array;
  monthly: MonthStat[];
  /** Precomputed baseline per day, only when the area is a single municipality or department. */
  baselineAt: ((day: number) => AlertSnapshot | null) | null;
  insufficientMembers: number[];
}

export function computeAreaSeries(
  area: Area,
  depts: Map<string, IndexedDept>,
  national: IndexedNational,
  ctx: RefContext,
): AreaSeries {
  const { refStart, refEnd } = ctx;
  const len = refEnd - refStart + 1;
  const cells = new Int32Array(len);
  const activeCells = new Int32Array(len);
  const n21 = new Int32Array(len);
  const modis = new Int32Array(refEnd + 1);
  const level = new Int8Array(len).fill(LEVEL_NONE);
  const fallback = new Uint8Array(len);
  const driver = new Int16Array(len).fill(-1);
  const memberCells = area.members.map(() => new Int32Array(len));
  const insufficientCount = new Int32Array(area.members.length);
  // MODIS era: sum over members of raw MODIS x the level of the member's department (the monthly factor is
  // applied per day below, since it is the same for every member).
  const eraWeighted = new Float64Array(Math.max(0, refStart));
  const levelsUsed = new Set<number>();

  area.members.forEach((mem, k) => {
    const memLevel = ctx.harm?.departments[mem.dpto]?.level ?? 1;
    levelsUsed.add(memLevel);
    const dep = depts.get(mem.dpto);
    const m = dep?.mpioIndex.get(mem.mpio);
    if (!dep || m === undefined) return;
    const { daily, other_sensors: other } = dep.file;
    for (const r of dep.dailyRows[m]) {
      const i = daily.d[r] - refStart;
      if (i >= 0 && i < len) {
        memberCells[k][i] += daily.c[r];
        cells[i] += daily.c[r];
        if (daily.k) activeCells[i] += daily.k[r];
      }
    }
    for (const r of dep.otherRows[m]) {
      const sensor = other.legend[other.s[r]];
      const d = other.d[r];
      if (sensor === 'VIIRS_N21') {
        const i = d - refStart;
        if (i >= 0 && i < len) n21[i] += other.c[r];
      } else if (sensor === 'MODIS_C61' && d >= 0 && d <= refEnd) {
        modis[d] += other.c[r];
        if (d < refStart) eraWeighted[d] += other.c[r] * memLevel;
      }
    }
  });

  const na = national.file.alerts;
  const isDepartment = area.kind === 'department';

  if (isDepartment) {
    const di = national.deptIndex.get(area.dptoCodes[0]);
    if (di !== undefined) {
      for (const r of national.alertRows[di]) {
        const i = na.d[r] - refStart;
        if (i >= 0 && i < len) level[i] = na.l[r];
      }
    }
  } else {
    // Per municipality level; "insufficient" falls back to its department (DATA_CONTRACT.md).
    // For several municipalities the area shows the highest level among them.
    area.members.forEach((mem, k) => {
      const dep = depts.get(mem.dpto);
      const m = dep?.mpioIndex.get(mem.mpio);
      if (!dep || m === undefined) return;
      const a = dep.file.alerts;
      const di = national.deptIndex.get(mem.dpto);
      for (const r of dep.alertRows[m]) {
        const i = a.d[r] - refStart;
        if (i < 0 || i >= len) continue;
        let lv = a.l[r];
        let fb = 0;
        if (lv === LEVEL_INSUFFICIENT) {
          insufficientCount[k]++;
          if (di !== undefined) {
            const nr = findRow(national.alertRows[di], na.d, a.d[r]);
            if (nr >= 0 && na.l[nr] !== LEVEL_INSUFFICIENT) {
              lv = na.l[nr];
              fb = 1;
            }
          }
        }
        if (levelRank(lv) > levelRank(level[i])) {
          level[i] = lv;
          fallback[i] = fb;
          driver[i] = k;
        }
      }
    });
  }

  const cells7 = new Int32Array(len);
  let acc = 0;
  for (let i = 0; i < len; i++) {
    acc += cells[i];
    if (i >= 7) acc -= cells[i - 7];
    cells7[i] = acc;
  }

  // MODIS era inside the single calendar, for every area (team decision of November 15, 2026,
  // docs/HARMONIZATION.md Part 5). Each department uses its own factor; municipalities and drawn areas use
  // the factor of their department. eraReason says how tested the estimate is, for the warning shown with it.
  let era: EraSeries | null = null;
  let eraReason: EraReason = 'rule_not_accepted';
  if (ctx.harm) {
    const code = area.dptoCodes[0];
    const info = isDepartment ? ctx.harm.departments[code] : undefined;
    if (!isDepartment) eraReason = 'scale_not_tested';
    else if (!info || info.status === 'insufficient') eraReason = 'insufficient';
    else if (info.status === 'viirs_only') eraReason = 'department_failed';
    else eraReason = 'shown';
    const est = new Float64Array(refStart);
    const est7 = new Float64Array(refStart);
    const eraLevel = new Int8Array(refStart).fill(LEVEL_NONE);
    let sum = 0;
    for (let d = 0; d < refStart; d++) {
      est[d] = rescale(ctx.harm, d, eraWeighted[d]);
      sum += est[d];
      if (d >= 7) sum -= est[d - 7];
      // A running sum of decimals drifts: an empty week can come out as -1e-15, shown as "-0". Snap it to zero.
      if (sum < 1e-9) sum = 0;
      est7[d] = sum;
    }
    let hasLevels = false;
    const ea = national.file.alerts_modis_era;
    const di = isDepartment ? national.deptIndex.get(code) : undefined;
    if (ea && national.eraRows && di !== undefined) {
      for (const r of national.eraRows[di]) {
        const d = ea.d[r];
        if (d >= 0 && d < refStart) { eraLevel[d] = ea.l[r]; hasLevels = true; }
      }
    }
    era = {
      est, est7, level: eraLevel, hasLevels,
      status: isDepartment ? (info?.status ?? 'insufficient') : 'not_tested',
      errorPct: isDepartment && info ? info.error_pct : new Array(12).fill(null),
      factorLevel: levelsUsed.size === 1 ? [...levelsUsed][0] : null,
    };
  }

  let baselineAt: AreaSeries['baselineAt'] = null;
  if (isDepartment) {
    const di = national.deptIndex.get(area.dptoCodes[0]);
    if (di !== undefined) {
      baselineAt = (day) => {
        const r = findRow(national.alertRows[di], na.d, day);
        return r < 0 ? null : snapshot(na, r);
      };
    }
  } else if (area.members.length === 1) {
    const mem = area.members[0];
    const dep = depts.get(mem.dpto);
    const m = dep?.mpioIndex.get(mem.mpio);
    if (dep && m !== undefined) {
      baselineAt = (day) => {
        const r = findRow(dep.alertRows[m], dep.file.alerts.d, day);
        return r < 0 ? null : snapshot(dep.file.alerts, r);
      };
    }
  }

  return {
    era,
    eraReason,
    refStart,
    refEnd,
    cells,
    cells7,
    level,
    fallback,
    driver,
    memberCells,
    activeCells,
    n21,
    modis,
    monthly: computeMonthly(cells, ctx, era?.est),
    baselineAt,
    insufficientMembers: [...insufficientCount.keys()].filter((k) => insufficientCount[k] > 0),
  };
}

// ---------------------------------------------------------------- monthly

function median(values: number[]): number | null {
  if (!values.length) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = s.length >> 1;
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/**
 * Monthly totals and the comparison with the same calendar month in the other years, as in
 * `monthly_municipio` (DATA_CONTRACT.md): complete months against complete months, and a partial
 * month (the current one) against the same days of that month in the other years.
 */
export function computeMonthly(cells: Int32Array, ctx: RefContext, era?: ArrayLike<number> | null): MonthStat[] {
  const { refStart, refEnd, status } = ctx;
  const firstMo = monthIndexOfDay(refStart);
  const lastMo = monthIndexOfDay(refEnd);
  const rows: MonthStat[] = [];
  for (let mo = firstMo; mo <= lastMo; mo++) {
    const a = monthFirstDay(mo);
    const b = monthFirstDay(mo + 1) - 1;
    let cd = 0;
    let ad = 0;
    let nd = 0;
    for (let day = Math.max(a, refStart); day <= Math.min(b, refEnd); day++) {
      const i = day - refStart;
      cd += cells[i];
      if (cells[i] > 0) ad++;
      if (status[i] === STATUS_NODATA) nd++;
    }
    const { y, m } = monthIndexToYM(mo);
    rows.push({
      mo, y, m, cd, ad, nd,
      days: Math.min(b, refEnd) - Math.max(a, refStart) + 1,
      ok: a >= refStart && b <= refEnd,
      d1: Math.max(a, refStart) - a + 1,
      d2: Math.min(b, refEnd) - a + 1,
      med: null, ratio: null, pct: null, histYears: 0,
    });
  }
  return addHistory(rows, { cells, refStart, refEnd }, era);
}

/**
 * The same month (or the same days of it) in the MODIS-era years, from the estimated series `era`
 * (indexed by day since 2003-01-01, covering the days before the VIIRS reference). Only windows that
 * lie entirely before the reference starts are used, so no window mixes MODIS and VIIRS.
 */
function eraHistory(row: MonthStat, era: ArrayLike<number>): number[] {
  const out: number[] = [];
  const lastYear = dayParts(era.length - 1).y;
  for (let y = 2003; y <= lastYear; y++) {
    if (y === row.y) continue;
    const a = ymdToDay(y, row.m, 1);
    const dim = ymdToDay(y, row.m + 1, 1) - a;
    const start = row.ok ? a : a + row.d1 - 1;
    const end = row.ok ? a + dim - 1 : a + Math.min(row.d2, dim) - 1;
    if (start < 0 || end >= era.length) continue;
    let s = 0;
    for (let day = start; day <= end; day++) s += era[day];
    out.push(s);
  }
  return out;
}

/** A daily series indexed by day - refStart, used to compare partial months day for day. */
export interface DailySeries {
  cells: ArrayLike<number>;
  refStart: number;
  refEnd: number;
}

/** Sums of the same days of the month (row.d1..row.d2) in every other year fully inside the series. */
function sameDaysHistory(row: MonthStat, rows: MonthStat[], daily: DailySeries): number[] {
  const out: number[] = [];
  for (const o of rows) {
    if (o.m !== row.m || o.y === row.y) continue;
    const a = monthFirstDay(o.mo);
    const daysInMonth = monthFirstDay(o.mo + 1) - a;
    const start = a + row.d1 - 1;
    const end = a + Math.min(row.d2, daysInMonth) - 1;
    if (start < daily.refStart || end > daily.refEnd) continue;
    let s = 0;
    for (let day = start; day <= end; day++) s += daily.cells[day - daily.refStart];
    out.push(s);
  }
  return out;
}

export function addHistory(rows: MonthStat[], daily?: DailySeries, era?: ArrayLike<number> | null): MonthStat[] {
  for (const row of rows) {
    // A partial month is never compared with whole months. Without a daily series it gets no comparison.
    // With the MODIS era, the history also has the same month of 2003-2011 (estimated).
    const hist = row.ok
      ? rows.filter((o) => o.m === row.m && o.y !== row.y && o.ok).map((o) => o.cd)
      : daily ? sameDaysHistory(row, rows, daily) : [];
    if (era && (row.ok || daily)) hist.push(...eraHistory(row, era));
    row.histYears = hist.length;
    row.med = median(hist);
    // Kept unrounded; the pipeline rounds to 1 and 2 decimals (Python half-to-even) for storage.
    row.pct = hist.length ? (100 * hist.filter((v) => v <= row.cd).length) / hist.length : null;
    row.ratio = row.med && row.med > 0 ? row.cd / row.med : null;
  }
  return rows;
}

// ---------------------------------------------------------------- range summaries

export interface RangeSummary {
  days: number;
  cellDays: number;
  activeDays: number;
  noDataDays: number;
  filledDays: number;
  peakDay: number;
  peakCells: number;
  levelDays: number[];
  lastLevel: number;
  lastLevelDay: number;
  /** Days in the range that come from MODIS rescaled to VIIRS units (estimates). */
  estimatedDays: number;
}

export function summarizeRange(series: AreaSeries, ctx: RefContext, from: number, to: number): RangeSummary {
  const a = Math.max(from, series.refStart);
  const b = Math.min(to, series.refEnd);
  const out: RangeSummary = {
    days: Math.max(0, b - a + 1), cellDays: 0, activeDays: 0, noDataDays: 0, filledDays: 0,
    peakDay: -1, peakCells: 0, levelDays: [0, 0, 0, 0, 0], lastLevel: LEVEL_NONE, lastLevelDay: b,
    estimatedDays: 0,
  };
  // Days of the MODIS era (estimates), when the area shows them in the single calendar.
  if (series.era && from < series.refStart) {
    for (let day = Math.max(0, from); day <= Math.min(to, series.refStart - 1); day++) {
      const c = Math.round(series.era.est[day]);
      out.days++;
      out.estimatedDays++;
      out.cellDays += c;
      if (c > 0) out.activeDays++;
      if (c > out.peakCells) { out.peakCells = c; out.peakDay = day; }
      if (ctx.eraNoData[day]) out.noDataDays++;
    }
  }
  for (let day = a; day <= b; day++) {
    const i = day - series.refStart;
    const c = series.cells[i];
    out.cellDays += c;
    if (c > 0) out.activeDays++;
    if (c > out.peakCells) { out.peakCells = c; out.peakDay = day; }
    if (ctx.status[i] === STATUS_NODATA) out.noDataDays++;
    if (ctx.status[i] === STATUS_N20) out.filledDays++;
    const l = series.level[i];
    if (l >= 0) out.levelDays[l]++;
  }
  if (b >= a) out.lastLevel = series.level[b - series.refStart];
  return out;
}

export interface Episode {
  start: number;
  end: number;
  peakDay: number;
  peakLevel: number;
  peakCells7: number;
}

/** Runs of consecutive days at "unusual" or "extreme" level inside the range. */
export function findEpisodes(series: AreaSeries, from: number, to: number): Episode[] {
  const a = Math.max(from, series.refStart);
  const b = Math.min(to, series.refEnd);
  const out: Episode[] = [];
  let cur: Episode | null = null;
  for (let day = a; day <= b; day++) {
    const i = day - series.refStart;
    const l = series.level[i];
    const hot = l === LEVEL_UNUSUAL || l === LEVEL_EXTREME;
    if (hot) {
      if (!cur) cur = { start: day, end: day, peakDay: day, peakLevel: l, peakCells7: series.cells7[i] };
      cur.end = day;
      if (l > cur.peakLevel || (l === cur.peakLevel && series.cells7[i] > cur.peakCells7)) {
        cur.peakLevel = l;
        cur.peakDay = day;
        cur.peakCells7 = series.cells7[i];
      }
    } else if (cur) {
      out.push(cur);
      cur = null;
    }
  }
  if (cur) out.push(cur);
  return out.reverse();
}

export interface YearTotal {
  y: number;
  cd: number;
  complete: boolean;
  /** True when the whole year is MODIS rescaled to VIIRS units (an estimate). */
  est?: boolean;
}

/**
 * Year totals of the single calendar: the MODIS era (estimated) followed by the VIIRS reference.
 * `eraDaily` is indexed by day since 2003-01-01 and covers the days before refStart. The year in
 * which the reference starts adds its few MODIS-era days to the VIIRS total.
 */
export function harmonizedYearTotals(eraDaily: ArrayLike<number> | null, refStart: number, ref: YearTotal[]): YearTotal[] {
  if (!eraDaily) return ref;
  const firstRefYear = dayParts(refStart).y;
  const era = new Map<number, number>();
  for (let d = 0; d < refStart; d++) {
    const { y } = dayParts(d);
    era.set(y, (era.get(y) ?? 0) + eraDaily[d]);
  }
  const out: YearTotal[] = [];
  for (const [y, cd] of era) if (y < firstRefYear) out.push({ y, cd: Math.round(cd), complete: true, est: true });
  for (const t of ref) {
    out.push(t.y === firstRefYear ? { ...t, cd: t.cd + Math.round(era.get(firstRefYear) ?? 0), complete: true } : t);
  }
  return out;
}

/** One complete month of the MODIS era in VIIRS-equivalent units (an estimate). */
export interface EraMonth {
  y: number;
  /** Calendar month, 0 = January. */
  m: number;
  cd: number;
}

/**
 * Monthly totals of the MODIS era (MODIS rescaled to VIIRS units), for the months that lie entirely
 * before the VIIRS reference starts, so no month mixes the two sensors (the same rule as the monthly history).
 */
export function eraMonthTotals(eraDaily: ArrayLike<number> | null, refStart: number): EraMonth[] {
  if (!eraDaily) return [];
  const out: EraMonth[] = [];
  for (let y = 2003; ; y++) {
    let stop = false;
    for (let m = 0; m < 12; m++) {
      const a = ymdToDay(y, m, 1);
      const b = ymdToDay(y, m + 1, 1);
      if (b > refStart || b > eraDaily.length) { stop = true; break; }
      let s = 0;
      for (let d = a; d < b; d++) s += eraDaily[d];
      out.push({ y, m, cd: s });
    }
    if (stop) break;
  }
  return out;
}

export function yearTotals(monthly: MonthStat[]): YearTotal[] {
  const map = new Map<number, YearTotal>();
  for (const r of monthly) {
    const t = map.get(r.y) ?? { y: r.y, cd: 0, complete: true };
    t.cd += r.cd;
    if (!r.ok) t.complete = false;
    map.set(r.y, t);
  }
  return [...map.values()];
}

export function modisYearTotals(modis: Int32Array, firstYear = 2003): YearTotal[] {
  const out = new Map<number, YearTotal>();
  for (let d = 0; d < modis.length; d++) {
    const { y } = dayParts(d);
    if (y < firstYear) continue;
    const t = out.get(y) ?? { y, cd: 0, complete: true };
    t.cd += modis[d];
    out.set(y, t);
  }
  const last = dayParts(modis.length - 1);
  const lastT = out.get(last.y);
  if (lastT && !(last.m === 11 && last.d === 31)) lastT.complete = false;
  return [...out.values()];
}

// ---------------------------------------------------------------- national overview

export interface DeptStatus {
  code: string;
  name: string;
  level: number;
  cells7: number;
  p90: number | null;
  p975: number | null;
}

export function nationalAt(national: IndexedNational, day: number): DeptStatus[] {
  const { alerts } = national.file;
  return national.file.departments.map((u, di) => {
    const r = findRow(national.alertRows[di], alerts.d, day);
    return {
      code: u.code,
      name: u.name,
      level: r < 0 ? LEVEL_NONE : alerts.l[r],
      cells7: r < 0 ? 0 : alerts.c[r],
      p90: r < 0 ? null : alerts.p90[r],
      p975: r < 0 ? null : alerts.p975[r],
    };
  });
}

/** National monthly cell-days: the sum of the 33 departments, with the same history rule. */
export function nationalMonthly(national: IndexedNational, ctx: RefContext): MonthStat[] {
  const { monthly } = national.file;
  const firstMo = monthIndexOfDay(ctx.refStart);
  const lastMo = monthIndexOfDay(ctx.refEnd);
  const cd = new Float64Array(lastMo - firstMo + 1);
  for (let r = 0; r < monthly.mo.length; r++) {
    const k = monthly.mo[r] - firstMo;
    if (k >= 0 && k < cd.length) cd[k] += monthly.cd[r];
  }
  const rows: MonthStat[] = [];
  for (let mo = firstMo; mo <= lastMo; mo++) {
    const a = monthFirstDay(mo);
    const b = monthFirstDay(mo + 1) - 1;
    const { y, m } = monthIndexToYM(mo);
    rows.push({
      mo, y, m, cd: cd[mo - firstMo], ad: 0, nd: 0,
      days: Math.min(b, ctx.refEnd) - Math.max(a, ctx.refStart) + 1,
      ok: a >= ctx.refStart && b <= ctx.refEnd,
      d1: Math.max(a, ctx.refStart) - a + 1,
      d2: Math.min(b, ctx.refEnd) - a + 1,
      med: null, ratio: null, pct: null, histYears: 0,
    });
  }
  const daily = ctx.nationalCells ? { cells: ctx.nationalCells, refStart: ctx.refStart, refEnd: ctx.refEnd } : undefined;
  return addHistory(rows, daily, ctx.nationalEra);
}

/** Per-municipality level and 7-day cells on one day, for the map. */
export function municipalLevelsAt(
  depts: Map<string, IndexedDept>,
  day: number,
): Map<string, { level: number; cells7: number; name: string }> {
  const out = new Map<string, { level: number; cells7: number; name: string }>();
  for (const dep of depts.values()) {
    const a = dep.file.alerts;
    dep.file.municipalities.forEach((u, m) => {
      const r = findRow(dep.alertRows[m], a.d, day);
      out.set(u.code, { level: r < 0 ? LEVEL_NONE : a.l[r], cells7: r < 0 ? 0 : a.c[r], name: u.name });
    });
  }
  return out;
}
