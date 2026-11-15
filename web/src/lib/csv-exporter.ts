// Note: Implementation assisted by AI (Claude Code) following Horum Labs' methodology.
// CSV export of what the user queried: the area, the dates, and each day of the series.

import type { AreaSeries, RefContext } from './analysis.ts';
import type { Area, PointsInfo } from './types.ts';
import { booleanPointInPolygon } from '@turf/boolean-point-in-polygon';
import { dataUrl } from './data.ts';
import { levelInfo } from './colors.ts';
import { dayParts, dayToISO, formatMonth, isoToDay, monthIndexOfDay } from './dates.ts';

const STATUS = ['snpp', 'n20_fill', 'no_data'];
const SENSOR = ['VIIRS_SNPP', 'VIIRS_N20', ''];

function esc(v: string | number | null | undefined): string {
  if (v === null || v === undefined) return '';
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function toCsv(header: string[], rows: (string | number | null)[][]): string {
  return [header, ...rows].map((r) => r.map(esc).join(',')).join('\r\n') + '\r\n';
}

function slug(area: Area): string {
  return area.label.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_|_$/g, '').toLowerCase();
}

export function download(filename: string, text: string) {
  const blob = new Blob(['﻿' + text], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Text of one gzipped points file, or null when that department has no file for that year. */
async function fetchPoints(url: string): Promise<string | null> {
  const r = await fetch(url);
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(`Could not load the points file (HTTP ${r.status})`);
  const bytes = new Uint8Array(await r.arrayBuffer());
  let text: string;
  // Some hosts decompress .gz files themselves: only gunzip when the gzip magic bytes are still there.
  if (bytes[0] === 0x1f && bytes[1] === 0x8b) {
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
    text = await new Response(stream).text();
  } else {
    text = new TextDecoder().decode(bytes);
  }
  // A development server answers a missing file with the app's HTML page.
  return text.startsWith('date,') ? text : null;
}

/**
 * The individual hot spots of the search: every accepted detection of the municipalities of the
 * area between the two dates, for all sensors. These are the same detections the calendar counts.
 * For a drawn shape the column `inside_drawn_shape` says whether the point is inside it, because
 * the calendar counts whole municipalities. Returns the number of points written.
 */
export async function pointsCsv(area: Area, from: number, to: number, info: PointsInfo): Promise<number> {
  const a = Math.max(from, isoToDay(`${info.first_year}-01-01`));
  const [isoA, isoB] = [dayToISO(a), dayToISO(to)];
  const codes = new Set(area.members.map((m) => m.mpio));
  const shape = (area.kind === 'polygon' || area.kind === 'bbox') && area.geometry ? area.geometry : null;
  const jobs: Promise<string | null>[] = [];
  for (const dpto of area.dptoCodes) {
    for (let y = dayParts(a).y; y <= dayParts(to).y; y++) {
      jobs.push(fetchPoints(dataUrl(`web/${info.path.replace('{dpto}', dpto).replace('{year}', String(y))}`)));
    }
  }
  const lines: string[] = [];
  for (const text of await Promise.all(jobs)) {
    if (!text) continue;
    const rows = text.split('\n');
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row) continue;
      const date = row.slice(0, 10);
      if (date < isoA || date > isoB) continue;
      if (!codes.has(row.slice(row.lastIndexOf(',') + 1))) continue;
      if (shape) {
        const f = row.split(',');
        lines.push(`${row},${booleanPointInPolygon([Number(f[3]), Number(f[2])], shape) ? 'true' : 'false'}`);
      } else {
        lines.push(row);
      }
    }
  }
  lines.sort();
  const header = [...info.columns, ...(shape ? ['inside_drawn_shape'] : [])].join(',');
  download(`burn_calendar_${slug(area)}_${isoA}_${isoB}_hot_spot_points.csv`, [header, ...lines].join('\r\n') + '\r\n');
  return lines.length;
}

/** One row per day for the whole area. Days of the MODIS era (estimates) come first when the area shows them. */
export function dailyCsv(area: Area, s: AreaSeries, ctx: RefContext, from: number, to: number) {
  const a = Math.max(from, s.refStart);
  const b = Math.min(to, s.refEnd);
  const codes = area.members.map((m) => m.mpio).join(' ');
  const rows: (string | number | null)[][] = [];
  const first = s.era ? Math.max(0, Math.min(from, a)) : a;
  if (s.era) {
    for (let day = first; day <= Math.min(to, s.refStart - 1); day++) {
      const lv = s.era.level[day];
      const gap = ctx.eraNoData[day] === 1;
      rows.push([
        dayToISO(day), area.label, codes,
        gap ? null : Math.round(s.era.est[day] * 10) / 10, Math.round(s.era.est7[day] * 10) / 10, null,
        lv < 0 ? 'none' : levelInfo(lv).key, lv < 0 ? '' : 'modis_era_internal',
        gap ? 'no_data' : 'modis_rescaled_estimated', 'MODIS_C61', 'false',
        null, s.modis[day] ?? 0,
      ]);
    }
  }
  for (let day = a; day <= b; day++) {
    const i = day - s.refStart;
    const st = ctx.status[i];
    const lv = s.level[i];
    rows.push([
      dayToISO(day), area.label, codes,
      st === 2 ? null : s.cells[i], s.cells7[i], st === 2 ? null : s.activeCells[i],
      lv < 0 ? 'none' : levelInfo(lv).key, lv < 0 ? '' : s.fallback[i] ? 'department_fallback' : area.kind === 'department' ? 'department' : 'municipality',
      STATUS[st] ?? '', SENSOR[st] ?? '', st === 1 ? 'true' : 'false',
      s.n21[i], s.modis[day] ?? 0,
    ]);
  }
  const header = [
    'date', 'area', 'mpio_codes', 'hot_spots', 'hot_spots_7d', 'active_cells_1km', 'level', 'level_source',
    'status', 'sensor', 'filled', 'noaa21_hot_spots_info', 'modis_hot_spots_raw',
  ];
  download(`burn_calendar_${slug(area)}_${dayToISO(first)}_${dayToISO(b)}_daily.csv`, toCsv(header, rows));
}

/** One row per municipality and day with activity. */
export function memberCsv(area: Area, s: AreaSeries, from: number, to: number) {
  const a = Math.max(from, s.refStart);
  const b = Math.min(to, s.refEnd);
  const rows: (string | number | null)[][] = [];
  for (let day = a; day <= b; day++) {
    const i = day - s.refStart;
    area.members.forEach((m, k) => {
      const c = s.memberCells[k][i];
      if (c > 0) rows.push([dayToISO(day), m.mpio, m.name, m.dpto, m.dptoName, c, Math.round(m.coverage * 1000) / 10]);
    });
  }
  const header = ['date', 'mpio_code', 'mpio_name', 'dpto_code', 'dpto_name', 'hot_spots', 'pct_area_in_selection'];
  download(`burn_calendar_${slug(area)}_${dayToISO(a)}_${dayToISO(b)}_by_municipality.csv`, toCsv(header, rows));
}

export function monthlyCsv(area: Area, s: AreaSeries, from: number, to: number) {
  const [moFrom, moTo] = [monthIndexOfDay(from), monthIndexOfDay(to)];
  const rows = s.monthly
    .filter((r) => r.mo >= moFrom && r.mo <= moTo)
    .map((r) => [
      `${r.y}-${String(r.m + 1).padStart(2, '0')}`, formatMonth(r.mo), r.cd, r.ad, r.nd, r.ok ? 'true' : 'false',
      r.d1, r.d2, r.histYears,
      r.med, r.ratio === null ? null : Math.round(r.ratio * 100) / 100, r.pct === null ? null : Math.round(r.pct * 10) / 10,
    ]);
  const header = ['month', 'label', 'hot_spots', 'active_days', 'no_data_days', 'month_complete',
    'compare_first_day', 'compare_last_day', 'history_years',
    'hist_median_hot_spots', 'ratio_vs_median', 'percentile_vs_history'];
  download(`burn_calendar_${slug(area)}_monthly.csv`, toCsv(header, rows));
}
