// Note: Implementation assisted by AI (Claude Code) following Horum Labs' methodology.
// CSV export of what the user queried: the area, the dates, and each day of the series.

import type { AreaSeries, RefContext } from './analysis.ts';
import type { Area } from './types.ts';
import { levelInfo } from './colors.ts';
import { dayToISO, formatMonth, monthIndexOfDay } from './dates.ts';

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

/** One row per day for the whole area. */
export function dailyCsv(area: Area, s: AreaSeries, ctx: RefContext, from: number, to: number) {
  const a = Math.max(from, s.refStart);
  const b = Math.min(to, s.refEnd);
  const codes = area.members.map((m) => m.mpio).join(' ');
  const rows: (string | number | null)[][] = [];
  for (let day = a; day <= b; day++) {
    const i = day - s.refStart;
    const st = ctx.status[i];
    const lv = s.level[i];
    rows.push([
      dayToISO(day), area.label, codes,
      st === 2 ? null : s.cells[i], s.cells7[i],
      lv < 0 ? 'none' : levelInfo(lv).key, lv < 0 ? '' : s.fallback[i] ? 'department_fallback' : area.kind === 'department' ? 'department' : 'municipality',
      STATUS[st] ?? '', SENSOR[st] ?? '', st === 1 ? 'true' : 'false',
      s.n21[i], s.modis[day] ?? 0,
    ]);
  }
  const header = [
    'date', 'area', 'mpio_codes', 'active_cells', 'cells_7d', 'level', 'level_source',
    'status', 'ref_sensor', 'filled', 'noaa21_cells_info', 'modis_cells_info',
  ];
  download(`burn_calendar_${slug(area)}_${dayToISO(a)}_${dayToISO(b)}_daily.csv`, toCsv(header, rows));
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
  const header = ['date', 'mpio_code', 'mpio_name', 'dpto_code', 'dpto_name', 'active_cells', 'pct_area_in_selection'];
  download(`burn_calendar_${slug(area)}_${dayToISO(a)}_${dayToISO(b)}_by_municipality.csv`, toCsv(header, rows));
}

export function monthlyCsv(area: Area, s: AreaSeries, from: number, to: number) {
  const [moFrom, moTo] = [monthIndexOfDay(from), monthIndexOfDay(to)];
  const rows = s.monthly
    .filter((r) => r.mo >= moFrom && r.mo <= moTo)
    .map((r) => [
      `${r.y}-${String(r.m + 1).padStart(2, '0')}`, formatMonth(r.mo), r.cd, r.ad, r.nd, r.ok ? 'true' : 'false', r.histYears,
      r.med, r.ratio === null ? null : Math.round(r.ratio * 100) / 100, r.pct === null ? null : Math.round(r.pct * 10) / 10,
    ]);
  const header = ['month', 'label', 'cell_days', 'active_days', 'no_data_days', 'month_complete', 'history_years',
    'hist_median_cell_days', 'ratio_vs_median', 'percentile_vs_history'];
  download(`burn_calendar_${slug(area)}_monthly.csv`, toCsv(header, rows));
}
