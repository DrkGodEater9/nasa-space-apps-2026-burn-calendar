// Note: Implementation assisted by AI (Claude Code) following Horum Labs' methodology.
// Landing view before an area is chosen: how Colombia looks on the selected day.

import { memo, useMemo, useState } from 'react';
import type { DeptStatus, MonthStat, YearTotal } from '../lib/analysis.ts';
import type { Harmonization } from '../lib/types.ts';
import { levelInfo, levelRank } from '../lib/colors.ts';
import { formatDay } from '../lib/dates.ts';
import { fmtInt, fmtRatio, titleCase } from '../lib/format.ts';
import type { GeoIndex } from '../lib/geo.ts';
import { AreaPicker } from './AreaPicker.tsx';
import { MonthlyChart, YearBars } from './Charts.tsx';
import { Icon } from './Icon.tsx';
import { Card, PngButton, Segmented } from './Panels.tsx';

interface Props {
  geo: GeoIndex;
  day: number;
  /** Last day of the data snapshot. */
  dataEnd: number;
  depts: DeptStatus[];
  monthly: MonthStat[];
  /** National hot spots per year of the single calendar (MODIS era estimated, then VIIRS). */
  years: YearTotal[];
  harm: Harmonization | null;
  onDepartment: (code: string) => void;
  onMunicipality: (code: string) => void;
  onPoint: (lon: number, lat: number) => string | null;
  onBox: (w: number, s: number, e: number, n: number) => string | null;
  onDrawTool: () => void;
}

const SUGGESTIONS = [
  { kind: 'd', code: '99', label: 'Vichada', why: 'Llanos savanna burning' },
  { kind: 'd', code: '18', label: 'Caquetá', why: 'Amazon deforestation front' },
  { kind: 'm', code: '50711', label: 'Vistahermosa', why: 'Sierra de La Macarena' },
  { kind: 'd', code: '52', label: 'Nariño', why: 'Andes, volcano masked' },
];

export const NationalOverview = memo(function NationalOverview(p: Props) {
  const [showAll, setShowAll] = useState(false);
  const ranked = useMemo(
    () => [...p.depts].sort((a, b) => levelRank(b.level) - levelRank(a.level) || b.cells7 - a.cells7),
    [p.depts],
  );
  const total = p.depts.reduce((s, d) => s + d.cells7, 0);
  const max = Math.max(1, ...p.depts.map((d) => d.cells7));
  const lastComplete = useMemo(() => [...p.monthly].reverse().find((r) => r.ok), [p.monthly]);
  // Memoized so the (memoized) chart does not redraw when only the selected day changes.
  const last36 = useMemo(() => p.monthly.slice(-36), [p.monthly]);
  const list = showAll ? ranked : ranked.slice(0, 10);
  // The two national trends share one card: the last 36 months, or every year since 2003.
  const [trend, setTrend] = useState<'months' | 'years'>('months');
  const hasYears = !!p.harm && p.years.some((t) => t.est);
  const showMonths = trend === 'months' || !hasYears;

  return (
    <div className="overview">
      <div className="hero">
        <div className="eyebrow"><Icon name="flame" size={14} /> Harmonized MODIS + VIIRS hot spots · Colombia 2003 – {formatDay(p.dataEnd, false)}</div>
        <h1>When and where does Colombia burn?</h1>
        <p>
          A daily calendar of satellite fire activity since 2003 for any municipality, department or area you draw,
          built on NASA FIRMS data. It tells an ordinary dry season from an unusual one.
        </p>
        <AreaPicker geo={p.geo} onDepartment={p.onDepartment} onMunicipality={p.onMunicipality} onPoint={p.onPoint} onBox={p.onBox} />
        <p className="hero-hint">
          Search a place, click the map or <button className="link-btn" onClick={p.onDrawTool}>draw an area</button>.
          Then read its calendar, compare it with its history and download the data.
        </p>
        <div className="suggest">
          <span className="muted small">Try</span>
          {SUGGESTIONS.map((s) => (
            <button key={s.code} className="suggest-btn" onClick={() => (s.kind === 'd' ? p.onDepartment(s.code) : p.onMunicipality(s.code))}>
              <b>{s.label}</b><small>{s.why}</small>
            </button>
          ))}
        </div>
      </div>

      <Card
        title={<>Colombia on {formatDay(p.day, false)}</>}
        icon="globe"
        sub="Departments by activity level in the last 7 days. Click one to explore it."
        info="Each department's 7-day total is compared with the same season in every other year since 2012 (VIIRS). The level says how unusual it is for that place and season, not how many hot spots there are."
      >
        <div className="nat-total">
          <div><b>{fmtInt(total)}</b><span>hot spots in the last 7 days</span></div>
          {lastComplete && lastComplete.ratio !== null && (
            <div><b>{fmtRatio(lastComplete.ratio)}</b><span>national activity in {formatMonthName(lastComplete)} vs. its median</span></div>
          )}
        </div>
        <ul className="dept-rank">
          {list.map((d) => {
            const li = levelInfo(d.level);
            return (
              <li key={d.code}>
                <button onClick={() => p.onDepartment(d.code)}>
                  <span className="dr-name">{titleCase(d.name)}</span>
                  <span className="dr-bar"><i style={{ width: `${(100 * d.cells7) / max}%`, background: d.level >= 1 && d.level <= 3 ? li.color : undefined }} /></span>
                  <span className="dr-val">{fmtInt(d.cells7)}</span>
                  <span className="level-pill sm" style={{ background: li.color, color: li.text }}>{li.label}</span>
                </button>
              </li>
            );
          })}
        </ul>
        <button className="link-btn" onClick={() => setShowAll(!showAll)}>{showAll ? 'Show top 10' : 'Show all 33 departments'}</button>
      </Card>

      <Card title="National activity" icon="chart"
        actions={
          <div className="card-buttons">
            {hasYears && (
              <Segmented<'months' | 'years'>
                label="National activity period"
                value={trend}
                onChange={setTrend}
                options={[{ value: 'months', label: 'Last 36 months' }, { value: 'years', label: 'Per year since 2003' }]}
              />
            )}
            {showMonths && (
              <PngButton
                filename="burn_calendar_colombia_last_36_months.png"
                title="Colombia · national hot spots, last 36 months"
                subtitle="Hot spots per month (VIIRS reference) · dashed line: median of the same month in the other years since 2003"
                note="The median uses 2003–2011 MODIS rescaled to VIIRS units (estimates)."
              />
            )}
          </div>
        }
        sub={showMonths ? 'Hot spots per month against the median of the same month.' : 'One harmonized series: MODIS rescaled (lighter bars) and VIIRS.'}
        info={showMonths
          ? 'Hot spots per month, all 33 departments (VIIRS reference). The dashed line is the median of the same month in the other years since 2003 (2003–2011 estimated from MODIS); orange months are above the 90th percentile of their history.'
          : <>One harmonized series. 2003–2011 are MODIS rescaled to VIIRS units with a factor per month (lighter bars, estimates); from 2012 the values are VIIRS observations. In the test the national monthly total was predicted with a median error of {p.harm?.national_error_all_months_pct.toFixed(1)}%. {p.harm?.notice}</>}>
        {showMonths ? <MonthlyChart rows={last36} /> : <YearBars totals={p.years} />}
      </Card>
    </div>
  );
});

function formatMonthName(r: MonthStat) {
  return new Date(Date.UTC(r.y, r.m, 1)).toLocaleString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
}
