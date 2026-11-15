// Note: Implementation assisted by AI (Claude Code) following Horum Labs' methodology.
// Landing view before an area is chosen: how Colombia looks on the selected day.

import { useMemo, useState } from 'react';
import type { DeptStatus, MonthStat, YearTotal } from '../lib/analysis.ts';
import type { Harmonization } from '../lib/types.ts';
import { levelInfo, levelRank } from '../lib/colors.ts';
import { formatDay } from '../lib/dates.ts';
import { fmtInt, fmtRatio, titleCase } from '../lib/format.ts';
import type { GeoIndex } from '../lib/geo.ts';
import { AreaPicker } from './AreaPicker.tsx';
import { MonthlyChart, YearBars } from './Charts.tsx';
import { Icon } from './Icon.tsx';
import { Card } from './Panels.tsx';

interface Props {
  geo: GeoIndex;
  day: number;
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

export function NationalOverview(p: Props) {
  const [showAll, setShowAll] = useState(false);
  const ranked = useMemo(
    () => [...p.depts].sort((a, b) => levelRank(b.level) - levelRank(a.level) || b.cells7 - a.cells7),
    [p.depts],
  );
  const total = p.depts.reduce((s, d) => s + d.cells7, 0);
  const max = Math.max(1, ...p.depts.map((d) => d.cells7));
  const lastComplete = [...p.monthly].reverse().find((r) => r.ok);
  const last36 = p.monthly.slice(-36);
  const list = showAll ? ranked : ranked.slice(0, 10);

  return (
    <div className="overview">
      <div className="hero">
        <div className="eyebrow"><Icon name="flame" size={14} /> Harmonized MODIS + VIIRS hot spots · Colombia 2003 – today</div>
        <h1>When and where does Colombia burn?</h1>
        <p>
          A daily calendar of satellite fire activity for any municipality, department or area you draw, built on NASA FIRMS
          data. Each day is compared with the same season in every year since 2012, so you can tell an ordinary dry season
          from an unusual one.
        </p>
        <AreaPicker geo={p.geo} onDepartment={p.onDepartment} onMunicipality={p.onMunicipality} onPoint={p.onPoint} onBox={p.onBox} />
        <div className="steps">
          <div><span>1</span><p>Pick an area: search, click the map, <button className="link-btn" onClick={p.onDrawTool}>draw a polygon</button> or type coordinates.</p></div>
          <div><span>2</span><p>Choose dates. VIIRS starts in 2012; departments that passed the harmonization test go back to 2003 with MODIS rescaled to VIIRS units.</p></div>
          <div><span>3</span><p>Read the calendar, compare with history and download the CSV.</p></div>
        </div>
        <div className="suggest">
          <span className="muted small">Try:</span>
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
        sub="Departments ranked by their 7-day activity level against the same season since 2012. Click one to explore it."
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

      <Card title="National activity, last 36 months" icon="chart" sub="Hot spots per month, all 33 departments (VIIRS reference). The dashed line is the median of the same month in the other years; orange months are above the 90th percentile of their history.">
        <MonthlyChart rows={last36} />
      </Card>

      {p.harm && p.years.some((t) => t.est) && (
        <Card
          title="Colombia, hot spots per year since 2003"
          icon="clock"
          sub={<>One harmonized series. 2003–2011 are MODIS rescaled to VIIRS units with a factor per month (lighter bars, estimates); from 2012 the values are VIIRS observations. In the test the national monthly total was predicted with a median error of {p.harm.national_error_all_months_pct.toFixed(1)}%.</>}
        >
          <YearBars totals={p.years} note={p.harm.notice} />
        </Card>
      )}
    </div>
  );
}

function formatMonthName(r: MonthStat) {
  return new Date(Date.UTC(r.y, r.m, 1)).toLocaleString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
}
