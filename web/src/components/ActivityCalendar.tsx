// Note: Implementation assisted by AI (Claude Code) following Horum Labs' methodology.
// Year-by-year activity calendar (weeks as columns, Monday to Sunday as rows). States follow
// docs/METHOD.md section 5: zero = light base color, no data = striped gray, detections = color
// scale. NOAA-20 fill days carry a small marker. Anomaly levels can replace the color scale.
// Single calendar: for every area, the days before the VIIRS reference are MODIS rescaled to VIIRS
// units (HARMONIZATION.md Part 5). They are estimates and are always hatched.

import { memo, useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type MouseEvent, type ReactNode } from 'react';
import type { AreaSeries, RefContext } from '../lib/analysis.ts';
import { STATUS_N20, STATUS_NODATA } from '../lib/analysis.ts';
import type { ColorMode, Sensor } from '../lib/types.ts';
import {
  CELL_ZERO, LEVEL_EXTREME, LEVEL_UNUSUAL, binLabels, cellColor, levelInfo, makeBins, percentile, CELL_RAMP, LEVELS, NO_ACTIVITY,
} from '../lib/colors.ts';
import { MONTHS_LONG, MONTHS_SHORT, dayParts, formatDay, ymdToDay } from '../lib/dates.ts';
import { fmtInt, fmtNum } from '../lib/format.ts';

const CELL = 11;
const GAP = 2;
const STEP = CELL + GAP;
const LEFT = 40;
const RIGHT = 74;
const MONTH_ROW = 16;
const YEAR_GAP = 20;
const YEAR_H = MONTH_ROW + 7 * STEP + YEAR_GAP;
const WIDTH = LEFT + 53 * STEP + RIGHT;

export const SENSOR_START: Record<Sensor, string> = { ref: '2012-01-20', n21: '2023-03-01', modis: '2003-01-01' };

interface Props {
  series: AreaSeries;
  ctx: RefContext;
  from: number;
  to: number;
  sensor: Sensor;
  colorMode: ColorMode;
  markUnusual: boolean;
  focusDay: number;
  onFocus: (day: number) => void;
  memberNames: string[];
  /** Clicking a year label shows only that year. */
  onPickYear?: (year: number) => void;
}

interface Tip {
  day: number;
  x: number;
  y: number;
}

export function valueAt(series: AreaSeries, sensor: Sensor, day: number): number {
  if (sensor === 'modis') return series.modis[day] ?? 0;
  const i = day - series.refStart;
  // Before the VIIRS reference: MODIS rescaled to VIIRS units, where the area shows it.
  if (i < 0) return sensor === 'ref' && series.era && day >= 0 ? Math.round(series.era.est[day]) : 0;
  if (i >= series.cells.length) return 0;
  return sensor === 'n21' ? series.n21[i] : series.cells[i];
}

function ActivityCalendarImpl(p: Props) {
  const { series, ctx, sensor } = p;
  const wrap = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [tip, setTip] = useState<Tip | null>(null);

  const start = Math.max(p.from, sensor === 'modis' ? 0 : sensor === 'n21' ? ymdToDay(2023, 2, 1) : series.era ? 0 : series.refStart);
  const end = Math.min(p.to, series.refEnd);

  const bins = useMemo(() => {
    const vals: number[] = [];
    for (let d = start; d <= end; d++) {
      const v = valueAt(series, sensor, d);
      if (v > 0) vals.push(v);
    }
    vals.sort((a, b) => a - b);
    return makeBins(Math.max(1, percentile(vals, 98)));
  }, [series, sensor, start, end]);

  const years = useMemo(() => {
    const out: number[] = [];
    if (end < start) return out;
    for (let y = dayParts(end).y; y >= dayParts(start).y; y--) out.push(y);
    return out;
  }, [start, end]);

  // All cells of one color are drawn as a single <path>: the picture is identical, but the
  // calendar has a few dozen DOM nodes instead of several thousand, so long ranges, hovering
  // and clicking stay smooth. Hit testing is done from the mouse position.
  const drawing = useMemo(() => {
    const fills = new Map<string, string[]>();
    const rings = new Map<string, string[]>();
    const dots: string[] = [];
    const fallbacks: string[] = [];
    const estimates: string[] = [];
    const labels: ReactNode[] = [];
    const push = (m: Map<string, string[]>, k: string, seg: string) => {
      const a = m.get(k);
      if (a) a.push(seg);
      else m.set(k, [seg]);
    };
    years.forEach((y, yi) => {
      const top = yi * YEAR_H;
      const jan1 = ymdToDay(y, 0, 1);
      const offset = dayParts(jan1).wd;
      const dec31 = ymdToDay(y, 11, 31);
      let total = 0;
      let nodata = 0;
      let estDays = 0;
      for (let day = Math.max(jan1, start); day <= Math.min(dec31, end); day++) {
        const k = day - jan1 + offset;
        const x = LEFT + Math.floor(k / 7) * STEP;
        const yy = top + MONTH_ROW + (k % 7) * STEP;
        const i = day - series.refStart;
        const st = sensor === 'ref' && i >= 0 ? ctx.status[i] : -1;
        // A day of the MODIS era (an estimate). Only reached when the area shows that era.
        const isEra = sensor === 'ref' && i < 0 && !!series.era;
        const v = valueAt(series, sensor, day);
        total += v;
        let fill: string;
        if (st === STATUS_NODATA || (isEra && ctx.eraNoData[day])) {
          fill = 'url(#cal-nodata)';
          nodata++;
        } else if (p.colorMode === 'level' && sensor === 'ref') {
          const l = isEra ? series.era!.level[day] : series.level[i];
          fill = l < 0 ? (v > 0 ? NO_ACTIVITY.color : CELL_ZERO) : levelInfo(l).color;
          if (!isEra && l >= 0 && series.fallback[i]) fallbacks.push(roundRect(x + 0.4, yy + 0.4, CELL - 0.8, CELL - 0.8, 2));
        } else {
          fill = cellColor(v, bins);
        }
        const cellPath = roundRect(x, yy, CELL, CELL, 2);
        push(fills, fill, cellPath);
        if (isEra) {
          estDays++;
          estimates.push(cellPath);
        }
        if (sensor === 'ref' && st === STATUS_N20) dots.push(circle(x + CELL - 2.6, yy + 2.6, 1.6));
        if (sensor === 'ref' && !isEra && p.markUnusual && p.colorMode === 'cells') {
          const l = series.level[i];
          if (l === LEVEL_UNUSUAL || l === LEVEL_EXTREME) {
            push(rings, l === LEVEL_EXTREME ? '#ff4d6d' : '#ffffff', roundRect(x - 1, yy - 1, CELL + 2, CELL + 2, 3));
          }
        }
      }
      // Month labels at the first week that contains the 1st of each month.
      for (let m = 0; m < 12; m++) {
        const first = ymdToDay(y, m, 1);
        if (first > end || ymdToDay(y, m + 1, 0) < start) continue;
        const k = first - jan1 + offset;
        labels.push(
          <text key={`m${y}${m}`} className="cal-month" x={LEFT + Math.floor(k / 7) * STEP + (k % 7 ? STEP : 0)} y={top + 10}>
            {MONTHS_SHORT[m]}
          </text>,
        );
      }
      labels.push(
        <text key={`t${y}`} className="cal-total" x={WIDTH - 4} y={top + MONTH_ROW + 3 * STEP + 3} textAnchor="end">{fmtInt(total)}</text>,
        <text key={`tl${y}`} className="cal-total-label" x={WIDTH - 4} y={top + MONTH_ROW + 3 * STEP + 16} textAnchor="end">
          {estDays ? 'hot spots (est.)' : 'hot spots'}
        </text>,
      );
      // The no-data count goes on its own line: on one line with "hot spots (est.)" it ran under the squares.
      if (nodata) {
        labels.push(
          <text key={`tn${y}`} className="cal-total-label" x={WIDTH - 4} y={top + MONTH_ROW + 3 * STEP + 27} textAnchor="end">
            {`${nodata} no-data`}
          </text>,
        );
      }
      [0, 2, 4].forEach((wd) =>
        labels.push(<text key={`w${y}${wd}`} className="cal-wd" x={LEFT - 6} y={top + MONTH_ROW + wd * STEP + 9} textAnchor="end">{['Mon', '', 'Wed', '', 'Fri'][wd]}</text>),
      );
    });
    return {
      labels,
      fills: [...fills].map(([f, segs]) => <path key={f} d={segs.join('')} fill={f} />),
      rings: [...rings].map(([c, segs]) => <path key={c} d={segs.join('')} fill="none" stroke={c} strokeWidth={1.3} />),
      dots: dots.length ? <path d={dots.join('')} className="cal-fill-dot" /> : null,
      fallbacks: fallbacks.length ? <path d={fallbacks.join('')} className="cal-fallback" /> : null,
      estimates: estimates.length ? <path d={estimates.join('')} fill="url(#cal-est)" /> : null,
      hasEstimates: estimates.length > 0,
    };
  }, [years, start, end, series, ctx, sensor, p.colorMode, p.markUnusual, bins]);

  const height = Math.max(1, years.length * YEAR_H - YEAR_GAP + 4);

  /** Top-left corner of a day's square, or null when it is not drawn. */
  const cellPos = (day: number): [number, number] | null => {
    if (day < start || day > end) return null;
    const { y } = dayParts(day);
    const yi = years.indexOf(y);
    if (yi < 0) return null;
    const jan1 = ymdToDay(y, 0, 1);
    const k = day - jan1 + dayParts(jan1).wd;
    return [LEFT + Math.floor(k / 7) * STEP, yi * YEAR_H + MONTH_ROW + (k % 7) * STEP];
  };

  const dayAtPointer = (e: MouseEvent<SVGSVGElement>): number | null => {
    const ctm = svgRef.current?.getScreenCTM();
    if (!ctm) return null;
    const pt = new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm.inverse());
    const yi = Math.floor(pt.y / YEAR_H);
    const local = pt.y - yi * YEAR_H - MONTH_ROW;
    const col = Math.floor((pt.x - LEFT) / STEP);
    if (yi < 0 || yi >= years.length || local < 0 || local >= 7 * STEP || col < 0 || col > 53) return null;
    const jan1 = ymdToDay(years[yi], 0, 1);
    const day = jan1 + col * 7 + Math.floor(local / STEP) - dayParts(jan1).wd;
    if (day < jan1 || day > ymdToDay(years[yi], 11, 31) || day < start || day > end) return null;
    return day;
  };

  const onMove = (e: MouseEvent<SVGSVGElement>) => {
    const d = dayAtPointer(e);
    if (d === null) return setTip(null);
    // Pointer position in the window: the tooltip is fixed to the viewport, so it is right wherever the
    // calendar has been scrolled to, and it never adds a scrollbar to the calendar.
    setTip({ day: d, x: e.clientX, y: e.clientY });
  };

  const onClick = (e: MouseEvent<SVGSVGElement>) => {
    const d = dayAtPointer(e);
    if (d !== null) p.onFocus(d);
  };

  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const step = { ArrowLeft: -7, ArrowRight: 7, ArrowUp: -1, ArrowDown: 1 }[e.key];
    if (!step) return;
    e.preventDefault();
    const next = Math.min(end, Math.max(start, p.focusDay + step));
    p.onFocus(next);
  };

  if (!years.length) {
    return <div className="empty-note">No {sensor === 'n21' ? 'NOAA-21' : 'data'} days in this date range.</div>;
  }

  const hoverPos = tip ? cellPos(tip.day) : null;
  // The tooltip is fixed to the window, so any scroll (the panel, the calendar, the page) hides it
  // instead of leaving it behind over other content.
  useEffect(() => {
    if (!tip) return;
    const hide = () => setTip(null);
    window.addEventListener('scroll', hide, true);
    return () => window.removeEventListener('scroll', hide, true);
  }, [tip !== null]);

  const focusPos = cellPos(p.focusDay);

  return (
    <div className="calendar">
      <div
        className="calendar-scroll"
        ref={wrap}
        tabIndex={0}
        onKeyDown={onKey}
        aria-label="Activity calendar. Use arrow keys to move the selected day."
      >
        <svg
          ref={svgRef}
          viewBox={`0 0 ${WIDTH} ${height}`}
          width="100%"
          style={{ minWidth: 640, cursor: tip ? 'pointer' : 'default' }}
          role="img"
          aria-label={`Daily activity from ${formatDay(start, false)} to ${formatDay(end, false)}`}
          onMouseMove={onMove}
          onMouseLeave={() => setTip(null)}
          onClick={onClick}
        >
          <defs>
            <pattern id="cal-nodata" width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <rect width="4" height="4" fill="#2b3342" />
              <line x1="0" y1="0" x2="0" y2="4" stroke="#5b667a" strokeWidth="1.6" />
            </pattern>
            {/* Hatch over the estimated days (MODIS rescaled to VIIRS units). */}
            {/* Two tones (dark next to light) so the hatch stays visible on the darkest and the lightest class. */}
            <pattern id="cal-est" width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(-45)">
              <line x1="0.6" y1="0" x2="0.6" y2="4" stroke="#0b0f17" strokeOpacity="0.75" strokeWidth="1.1" />
              <line x1="1.7" y1="0" x2="1.7" y2="4" stroke="#ffffff" strokeOpacity="0.6" strokeWidth="0.9" />
            </pattern>
          </defs>
          {drawing.labels}
          {years.map((y, yi) => (
            <text
              key={`y${y}`}
              className={`cal-year ${p.onPickYear ? 'pickable' : ''}`}
              x={0}
              y={yi * YEAR_H + MONTH_ROW + 3 * STEP + 9}
              onClick={(e) => { e.stopPropagation(); p.onPickYear?.(y); }}
            >
              {p.onPickYear && <title>{`Show only ${y}`}</title>}
              {y}
            </text>
          ))}
          {drawing.fills}
          {drawing.estimates}
          {drawing.fallbacks}
          {drawing.dots}
          {drawing.rings}
          {focusPos && <rect className="cal-focus" x={focusPos[0]} y={focusPos[1]} width={CELL} height={CELL} rx={2} />}
          {hoverPos && <rect className="cal-hover" x={hoverPos[0]} y={hoverPos[1]} width={CELL} height={CELL} rx={2} />}
        </svg>
        {tip && <CalendarTip {...p} tip={tip} />}
      </div>
      <CalendarLegend bins={bins} colorMode={sensor === 'ref' ? p.colorMode : 'cells'} sensor={sensor} markUnusual={p.markUnusual} hasEstimates={drawing.hasEstimates} />
    </div>
  );
}

function roundRect(x: number, y: number, w: number, h: number, r: number): string {
  return `M${x + r} ${y}h${w - 2 * r}a${r} ${r} 0 0 1 ${r} ${r}v${h - 2 * r}a${r} ${r} 0 0 1 ${-r} ${r}h${2 * r - w}a${r} ${r} 0 0 1 ${-r} ${-r}v${2 * r - h}a${r} ${r} 0 0 1 ${r} ${-r}z`;
}

function circle(cx: number, cy: number, r: number): string {
  return `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0z`;
}

export const ActivityCalendar = memo(ActivityCalendarImpl);

function CalendarTip(p: Props & { tip: Tip }) {
  const { series, ctx, sensor, tip } = p;
  const day = tip.day;
  const i = day - series.refStart;
  const st = i >= 0 && i < ctx.status.length ? ctx.status[i] : -1;
  const v = valueAt(series, sensor, day);
  const lv = sensor === 'ref' && i >= 0 ? series.level[i] : -1;
  const base = sensor === 'ref' ? series.baselineAt?.(day) ?? null : null;
  const driver = sensor === 'ref' && i >= 0 && series.driver[i] >= 0 && p.memberNames.length > 1 ? p.memberNames[series.driver[i]] : null;
  // Next to the pointer; flipped to its left or above it when it would not fit in the window.
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const pos: CSSProperties = {
    ...(tip.x + 14 + 290 > vw ? { right: Math.max(4, vw - tip.x + 14) } : { left: tip.x + 14 }),
    ...(tip.y + 16 + 250 > vh ? { bottom: vh - tip.y + 12 } : { top: tip.y + 16 }),
  };
  if (sensor === 'ref' && i < 0 && series.era) {
    // A day of the MODIS era: an estimate, with its own internal anomaly and no current alert.
    const era = series.era;
    const month = dayParts(day).m;
    const err = era.errorPct[month];
    const el = era.level[day];
    return (
      <div className="cal-tip" style={pos}>
        <div className="tip-title">{formatDay(day)}</div>
        {ctx.eraNoData[day] ? (
          <div className="tip-row warn">No MODIS data on this day. Not a zero.</div>
        ) : (
          <div className="tip-big">≈ {fmtInt(v)} <span>hot spots (estimated)</span></div>
        )}
        <div className="tip-row">MODIS rescaled to VIIRS units (estimated)</div>
        <div className="tip-row muted">
          {era.factorLevel !== null
            ? <>{series.modis[day] ?? 0} MODIS hot spots × {fmtNum((ctx.harm?.factors[month] ?? 0) * era.factorLevel)} ({MONTHS_LONG[month]} factor{era.factorLevel !== 1 ? ' for this department' : ''})</>
            : <>{series.modis[day] ?? 0} MODIS hot spots × the {MONTHS_LONG[month]} factor of each department</>}
        </div>
        <div className={`tip-row${era.status === 'ok' ? ' muted' : ' warn'}`}>
          {era.status === 'not_tested'
            ? 'Not tested at this scale: the error is unknown'
            : era.status === 'insufficient'
              ? 'Too few detections to test here: the error is unknown'
              : err === null || err === undefined
                ? `Test error for ${MONTHS_LONG[month]} here: not evaluable (too few detections)`
                : `Typical test error for ${MONTHS_LONG[month]} here: ±${Math.round(err)}%`}
        </div>
        <div className="tip-row">
          <span className="dot" style={{ background: levelInfo(el).color }} />
          {!era.hasLevels ? 'MODIS-era anomaly: computed for departments only'
            : el < 0 ? 'No activity in the last 7 days' : `Internal anomaly of the MODIS era: ${levelInfo(el).label}`}
        </div>
        <div className="tip-row muted">7-day total ≈ {fmtInt(Math.round(era.est7[day]))} · compared with 2003–2011 only, no current alert</div>
        <div className="tip-foot">Click the day for its details</div>
      </div>
    );
  }
  return (
    <div className="cal-tip" style={pos}>
      <div className="tip-title">{formatDay(day)}</div>
      {sensor === 'ref' && st === STATUS_NODATA ? (
        <div className="tip-row warn">No data — neither S-NPP nor NOAA-20 had observations. Not a zero.</div>
      ) : (
        <div className="tip-big">
          {fmtInt(v)} <span>hot spots</span>
        </div>
      )}
      {sensor === 'ref' && (
        <>
          <div className="tip-row">
            <span className="dot" style={{ background: levelInfo(lv).color }} />
            {lv < 0 ? 'No activity in the last 7 days' : `${levelInfo(lv).label}${series.fallback[i] ? ' (department level, municipality has insufficient history)' : ''}`}
          </div>
          <div className="tip-row muted">7-day total: {fmtInt(series.cells7[i] ?? 0)} hot spots{driver ? ` · level set by ${driver}` : ''}</div>
          {st !== STATUS_NODATA && <div className="tip-row muted">Active 1 km cells: {fmtInt(series.activeCells[i] ?? 0)}</div>}
          {base && base.p75 !== null && (
            <div className="tip-row muted">
              Baseline for this season: P75 {fmtNum(base.p75)} · P90 {fmtNum(base.p90 ?? 0)} · P97.5 {fmtNum(base.p975 ?? 0)}
            </div>
          )}
          <div className="tip-row muted">
            {st === STATUS_N20 ? 'Sensor: VIIRS NOAA-20 (filled, S-NPP had no data)' : st === 0 ? 'Sensor: VIIRS S-NPP (reference)' : ''}
          </div>
          {series.n21[i] > 0 && <div className="tip-row muted">NOAA-21 (informational): {fmtInt(series.n21[i])} hot spots, not added</div>}
        </>
      )}
      {sensor === 'modis' && <div className="tip-row muted">MODIS Collection 6.1 · raw hot spots, not rescaled</div>}
      {sensor === 'n21' && <div className="tip-row muted">VIIRS NOAA-21 · informational layer, no baseline</div>}
      <div className="tip-foot">Click the day for its details</div>
    </div>
  );
}

function CalendarLegend({ bins, colorMode, sensor, markUnusual, hasEstimates }: {
  bins: number[]; colorMode: ColorMode; sensor: Sensor; markUnusual: boolean; hasEstimates: boolean;
}) {
  const labels = binLabels(bins);
  return (
    <div className="cal-legend">
      {colorMode === 'cells' ? (
        <div className="lg-group">
          <span className="lg-label">Hot spots / day</span>
          <span className="lg-item"><i style={{ background: CELL_ZERO }} />0</span>
          {bins.map((b, k) => (
            <span className="lg-item" key={b}><i style={{ background: cellColor(b, bins) }} />{labels[k]}</span>
          ))}
        </div>
      ) : (
        <div className="lg-group">
          <span className="lg-label">7-day level vs. same season</span>
          {LEVELS.map((l) => (
            <span className="lg-item" key={l.key}><i style={{ background: l.color }} />{l.label}</span>
          ))}
        </div>
      )}
      {sensor === 'ref' && (
        <div className="lg-group">
          <span className="lg-item"><i className="lg-nodata" />No data</span>
          <span className="lg-item"><i style={{ background: CELL_RAMP[0], position: 'relative' }}><b className="lg-dot" /></i>NOAA-20 fill</span>
          {hasEstimates && <span className="lg-item"><i className="lg-est" style={{ background: CELL_RAMP[1] }} />MODIS rescaled to VIIRS units (estimated)</span>}
          {colorMode === 'cells' && markUnusual && (
            <>
              <span className="lg-item"><i className="lg-ring" />Unusual</span>
              <span className="lg-item"><i className="lg-ring extreme" />Extreme</span>
            </>
          )}
        </div>
      )}
    </div>
  );
}
