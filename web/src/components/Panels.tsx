// Note: Implementation assisted by AI (Claude Code) following Horum Labs' methodology.
// Smaller panels of the explorer: date controls, KPI strip, unusual episodes, data quality.

import { memo, useState, type ReactNode } from 'react';
import type { AreaSeries, Episode, RangeSummary, RefContext } from '../lib/analysis.ts';
import type { Area, ColorMode, Sensor } from '../lib/types.ts';
import { LEVELS, levelInfo } from '../lib/colors.ts';
import { clampDay, dayParts, dayToISO, formatDay, isValidIso, isoToDay, ymdToDay } from '../lib/dates.ts';
import { fmtInt, plural } from '../lib/format.ts';
import { Icon } from './Icon.tsx';

export function Card({ title, icon, actions, children, sub, className, id }: {
  title: ReactNode; icon?: string; actions?: ReactNode; children: ReactNode; sub?: ReactNode; className?: string; id?: string;
}) {
  return (
    <section className={`card ${className ?? ''}`} id={id}>
      <header className="card-head">
        <div>
          <h3>{icon && <Icon name={icon} />} {title}</h3>
          {sub && <p className="card-sub">{sub}</p>}
        </div>
        {actions && <div className="card-actions">{actions}</div>}
      </header>
      {children}
    </section>
  );
}

/**
 * Downloads the chart of the card it sits in (its first SVG with role="img", plus the card's legend) as a PNG.
 * The exporter is loaded on first use, so it adds nothing to the initial page.
 */
export function PngButton({ filename, title, subtitle, note }: { filename: string; title: string; subtitle?: string; note?: string }) {
  const [busy, setBusy] = useState(false);
  return (
    <button
      className="btn ghost"
      disabled={busy}
      title="Download this chart as a PNG image"
      onClick={async (e) => {
        const card = e.currentTarget.closest('.card');
        const svg = card?.querySelector<SVGSVGElement>('svg[role="img"]');
        if (!svg) return;
        setBusy(true);
        try {
          const { downloadSvgPng } = await import('../lib/png-export.ts');
          await downloadSvgPng(svg, card ?? null, { filename, title, subtitle, note });
        } finally {
          setBusy(false);
        }
      }}
    >
      <Icon name="download" /> PNG
    </button>
  );
}

export function Segmented<T extends string>({ value, options, onChange, label }: {
  value: T; options: { value: T; label: string; title?: string }[]; onChange: (v: T) => void; label: string;
}) {
  return (
    <div className="segmented" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} role="radio" aria-checked={value === o.value} className={value === o.value ? 'on' : ''} title={o.title} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

// ------------------------------------------------------------------ dates

/**
 * Named calendar views. Each row of the calendar is one calendar year, so whole-year views keep
 * the same months aligned vertically for comparison.
 */
export type CalendarView = 'year' | 'three' | 'full' | 'custom';

export function viewRange(view: Exclude<CalendarView, 'custom'>, minDay: number, maxDay: number): [number, number] {
  const endY = dayParts(maxDay).y;
  if (view === 'year') return [ymdToDay(endY, 0, 1), maxDay];
  if (view === 'three') return [ymdToDay(endY - 2, 0, 1), maxDay];
  return [minDay, maxDay];
}

export function viewOf(from: number, to: number, minDay: number, maxDay: number): CalendarView {
  for (const v of ['year', 'three', 'full'] as const) {
    const [a, b] = viewRange(v, minDay, maxDay);
    if (from === Math.max(minDay, a) && to === b) return v;
  }
  return 'custom';
}

export function viewCaption(view: CalendarView, from: number, to: number): string {
  const [ya, yb] = [dayParts(from).y, dayParts(to).y];
  switch (view) {
    case 'year': return `This year · how ${yb} is going, day by day`;
    case 'three': return `Last 3 years · one row per year, so the same months line up to compare`;
    case 'full': return `Full record ${ya}–${yb} · when this place burns, and which years were worst`;
    default:
      if (ya === yb && from === ymdToDay(ya, 0, 1) && to >= ymdToDay(ya, 11, 31)) return `${ya} · the whole year, day by day`;
      return ya === yb ? `${ya} · custom dates` : `Custom dates · ${ya}–${yb}, one row per year`;
  }
}

export function RangeControls({ from, to, minDay, maxDay, onChange, sensor, onSensor, colorMode, onColorMode, markUnusual, onMarkUnusual }: {
  from: number; to: number; minDay: number; maxDay: number; onChange: (a: number, b: number) => void;
  sensor: Sensor; onSensor: (s: Sensor) => void; colorMode: ColorMode; onColorMode: (c: ColorMode) => void;
  markUnusual: boolean; onMarkUnusual: (v: boolean) => void;
}) {
  const endY = dayParts(maxDay).y;
  const current = viewOf(from, to, minDay, maxDay);
  const [customOpen, setCustomOpen] = useState(current === 'custom');
  const shown: CalendarView = customOpen ? 'custom' : current;
  const years: number[] = [];
  for (let y = endY; y >= dayParts(minDay).y; y--) years.push(y);
  const set = (a: number, b: number) => {
    const x = clampDay(a, minDay, maxDay);
    const y = clampDay(b, minDay, maxDay);
    onChange(Math.min(x, y), Math.max(x, y));
  };
  // Typing a "From" after the current "To" (or a "To" before the "From") moves the other end and keeps the
  // length of the range, so the date the user just typed is always the one applied.
  const setFrom = (d: number) => set(d, d > to ? d + (to - from) : to);
  const setTo = (d: number) => set(d < from ? d - (to - from) : from, d);
  // Draft text of the date inputs: while the user types a year, the browser reports intermediate values such
  // as 0002-05-01. Those are kept as a draft and only applied once they are a real date inside the range.
  const [draftFrom, setDraftFrom] = useState<string | null>(null);
  const [draftTo, setDraftTo] = useState<string | null>(null);
  const inRange = (iso: string) => isValidIso(iso) && isoToDay(iso) >= minDay && isoToDay(iso) <= maxDay;
  const selectedYear = years.find((y) => from === Math.max(minDay, ymdToDay(y, 0, 1)) && to === Math.min(maxDay, ymdToDay(y, 11, 31)));

  const pick = (v: CalendarView) => {
    if (v === 'custom') {
      setCustomOpen(true);
      return;
    }
    setCustomOpen(false);
    set(...viewRange(v, minDay, maxDay));
  };

  return (
    <div className="range">
      <div className="range-row">
        <div className="view-pick">
          <span className="view-label">Calendar view</span>
          <Segmented<CalendarView>
            label="Calendar view"
            value={shown}
            onChange={pick}
            options={[
              { value: 'year', label: `This year`, title: `${endY}: what is happening now` },
              { value: 'three', label: 'Last 3 years', title: `${endY - 2}–${endY}: is this year normal compared with the previous ones?` },
              { value: 'full', label: 'Full record', title: `${dayParts(minDay).y}–${endY}: when does this place burn, and which years were worst?` },
              { value: 'custom', label: 'Custom…', title: 'Pick any start and end date' },
            ]}
          />
        </div>
        {shown !== 'custom' && <span className="view-dates">{formatDay(from, false)} – {formatDay(to, false)}</span>}
      </div>
      {shown === 'custom' && (
        <div className="range-row custom">
          <label className="date-field">
            <span>From</span>
            <input type="date" value={draftFrom ?? dayToISO(from)} min={dayToISO(minDay)} max={dayToISO(maxDay)}
              onChange={(e) => {
                const v = e.target.value;
                if (inRange(v)) { setDraftFrom(null); setFrom(isoToDay(v)); } else setDraftFrom(v);
              }}
              onBlur={() => setDraftFrom(null)} />
          </label>
          <span className="range-arrow"><Icon name="arrow" size={14} /></span>
          <label className="date-field">
            <span>To</span>
            <input type="date" value={draftTo ?? dayToISO(to)} min={dayToISO(minDay)} max={dayToISO(maxDay)}
              onChange={(e) => {
                const v = e.target.value;
                if (inRange(v)) { setDraftTo(null); setTo(isoToDay(v)); } else setDraftTo(v);
              }}
              onBlur={() => setDraftTo(null)} />
          </label>
          <div className="presets">
            <button className="chip" onClick={() => set(maxDay - 89, maxDay)}>Last 90 days</button>
            <button className="chip" onClick={() => set(maxDay - 364, maxDay)}>Last 12 months</button>
            <select className="chip select" value={selectedYear ?? ''} onChange={(e) => {
              const y = Number(e.target.value);
              if (y) set(ymdToDay(y, 0, 1), ymdToDay(y, 11, 31));
            }} aria-label="Pick a calendar year">
              <option value="">One year…</option>
              {years.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
        </div>
      )}
      <div className="range-row options">
        <Segmented<Sensor>
          label="Sensor series"
          value={sensor}
          onChange={onSensor}
          options={[
            { value: 'ref', label: 'Harmonized calendar', title: 'VIIRS S-NPP since 2012 (NOAA-20 fills its gaps), used for all alerts, and MODIS rescaled to VIIRS units back to 2003 (estimated, hatched).' },
            { value: 'modis', label: 'MODIS, raw', title: 'MODIS Collection 6.1 since 2003, as observed and not rescaled.' },
            { value: 'n21', label: 'NOAA-21 · info', title: 'VIIRS NOAA-21 since 2023. Informational layer only.' },
          ]}
        />
        {sensor === 'ref' && (
          <>
            <Segmented<ColorMode>
              label="Color the calendar by"
              value={colorMode}
              onChange={onColorMode}
              options={[
                { value: 'cells', label: 'Hot spots' },
                { value: 'level', label: 'Anomaly level' },
              ]}
            />
            {colorMode === 'cells' && (
              <label className="toggle">
                <input type="checkbox" checked={markUnusual} onChange={(e) => onMarkUnusual(e.target.checked)} />
                <span className="toggle-ui" /> Outline unusual days
              </label>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ KPIs

export const Kpis = memo(function Kpis({ s, sensorLabel, showLevels = true }: { s: RangeSummary; sensorLabel: string; showLevels?: boolean }) {
  const hot = s.levelDays[2] + s.levelDays[3];
  const last = levelInfo(s.lastLevel);
  return (
    <div className={`kpis ${showLevels ? '' : 'three'}`}>
      <div className="kpi">
        <div className="kpi-label">Hot spots</div>
        <div className="kpi-val">{s.estimatedDays ? '≈ ' : ''}{fmtInt(s.cellDays)}</div>
        <div className="kpi-sub">{sensorLabel}{s.estimatedDays ? ` · ${fmtInt(s.estimatedDays)} estimated days` : ''}</div>
      </div>
      <div className="kpi">
        <div className="kpi-label">Days with activity</div>
        <div className="kpi-val">{fmtInt(s.activeDays)}<small> / {fmtInt(s.days)}</small></div>
        <div className="kpi-sub">{s.days ? Math.round((100 * s.activeDays) / s.days) : 0}% of days</div>
      </div>
      <div className="kpi">
        <div className="kpi-label">Peak day</div>
        <div className="kpi-val">{s.peakDay >= 0 ? fmtInt(s.peakCells) : '—'}<small> hot spots</small></div>
        <div className="kpi-sub">{s.peakDay >= 0 ? formatDay(s.peakDay, false) : 'no activity'}</div>
      </div>
      {showLevels && <div className="kpi">
        <div className="kpi-label">Unusual or extreme</div>
        <div className={`kpi-val ${hot ? 'hot' : ''}`}>{fmtInt(hot)}<small> days</small></div>
        <div className="kpi-sub">incl. {fmtInt(s.levelDays[3])} extreme</div>
      </div>}
      {showLevels && <div className="kpi">
        <div className="kpi-label">Level, last day</div>
        <div className="kpi-val"><span className="level-pill" style={{ background: last.color, color: last.text }}>{last.label}</span></div>
        <div className="kpi-sub">{formatDay(s.lastLevelDay, false)}</div>
      </div>}
    </div>
  );
});

// ------------------------------------------------------------------ episodes

export const Episodes = memo(function Episodes({ episodes, onFocus }: { episodes: Episode[]; onFocus: (d: number) => void }) {
  const [all, setAll] = useState(false);
  if (!episodes.length) {
    return <div className="empty-note"><Icon name="check" /> No unusual or extreme 7-day windows in this range.</div>;
  }
  const list = all ? episodes : episodes.slice(0, 6);
  return (
    <>
      <ul className="episodes">
        {list.map((e) => {
          const li = levelInfo(e.peakLevel);
          const days = e.end - e.start + 1;
          return (
            <li key={e.start}>
              <button onClick={() => onFocus(e.peakDay)}>
                <span className="ep-level" style={{ background: li.color, color: li.text }}>{li.label}</span>
                <span className="ep-dates">
                  {formatDay(e.start, false)}{days > 1 ? ` – ${formatDay(e.end, false)}` : ''}
                  <small>{plural(days, 'day')}</small>
                </span>
                <span className="ep-peak">
                  {fmtInt(e.peakCells7)}<small>hot spots / 7 days at peak</small>
                </span>
                <Icon name="arrow" size={14} />
              </button>
            </li>
          );
        })}
      </ul>
      {episodes.length > 6 && <button className="link-btn" onClick={() => setAll(!all)}>{all ? 'Show fewer' : `Show all ${episodes.length} episodes`}</button>}
    </>
  );
});

// ------------------------------------------------------------------ data quality

export const DataQuality = memo(function DataQuality({ area, series, summary, ctx, from, to }: {
  area: Area; series: AreaSeries; summary: RangeSummary; ctx: RefContext; from: number; to: number;
}) {
  const insufficient = series.insufficientMembers.map((k) => area.members[k]?.name).filter(Boolean);
  // Longest run of no-data days inside the range.
  let longest = 0;
  let run = 0;
  for (let d = Math.max(from, ctx.refStart); d <= Math.min(to, ctx.refEnd); d++) {
    if (ctx.status[d - ctx.refStart] === 2) { run++; longest = Math.max(longest, run); } else run = 0;
  }
  const items: { tone: 'ok' | 'warn' | 'info'; text: ReactNode }[] = [];
  items.push(
    summary.noDataDays
      ? { tone: 'warn', text: <><b>{plural(summary.noDataDays, 'day')}</b> without satellite data (striped in the calendar){longest > 1 ? `; the longest VIIRS gap lasts ${longest} days` : ''}. These are gaps, not zeros.</> }
      : { tone: 'ok', text: <>No days without satellite data in this range.</> },
  );
  if (summary.filledDays) {
    items.push({ tone: 'info', text: <><b>{plural(summary.filledDays, 'day')}</b> use NOAA-20 because S-NPP had no data (dot in the corner of the cell).</> });
  }
  if (insufficient.length) {
    items.push({
      tone: 'warn',
      text: <>
        <b>{insufficient.length === area.members.length && area.members.length === 1 ? insufficient[0] : `${insufficient.length} of ${area.members.length} municipalities`}</b>{' '}
        {insufficient.length === 1 && area.members.length === 1 ? 'has' : 'have'} too little history on some days (fewer than 10 active days in the baseline season), so the department level is shown instead on those days.
      </>,
    });
  }
  if (area.kind === 'polygon' || area.kind === 'bbox') {
    items.push({ tone: 'info', text: <>Data are aggregated per municipality: the shape is answered with the {plural(area.members.length, 'municipality', 'municipalities')} that have at least 25% of their area inside it, counted in full.</> });
  }
  if (area.members.length > 1 && area.kind !== 'department') {
    items.push({ tone: 'info', text: <>For several municipalities the level shown each day is the highest among them.</> });
  }
  if (series.era) {
    const why = series.eraReason === 'department_failed'
      ? <> <b>Low confidence:</b> this department did not pass the harmonization test (estimated error above 30% in most months).</>
      : series.eraReason === 'insufficient'
        ? <> <b>Low confidence:</b> there are too few detections here to test the harmonization, so its error is unknown.</>
        : series.eraReason === 'scale_not_tested'
          ? <> <b>Low confidence:</b> the rescaling was tested for departments, not for municipalities or drawn areas. Each municipality uses the factor of its department, and the error at this scale is unknown.</>
          : series.era.status === 'low_confidence'
            ? <> For this department the estimated error is above 30%, so read them as low confidence.</>
            : null;
    items.push({
      tone: why ? 'warn' : 'info',
      text: <>
        Days before {formatDay(ctx.refStart, false)} are <b>MODIS rescaled to VIIRS units (estimated)</b>, hatched in the calendar.
        {why}
        {ctx.harm ? <> {ctx.harm.notice}</> : null}
      </>,
    });
  }
  items.push({ tone: 'info', text: <>Cloud cover can hide fires: a zero does not guarantee absence of fire.</> });

  return (
    <ul className="quality">
      {items.map((it, i) => (
        <li key={i} className={it.tone}>
          <Icon name={it.tone === 'ok' ? 'check' : it.tone === 'warn' ? 'warning' : 'info'} />
          <span>{it.text}</span>
        </li>
      ))}
    </ul>
  );
});

export function LevelScale() {
  return (
    <div className="level-scale">
      {LEVELS.slice(0, 4).map((l) => (
        <div key={l.key} className="ls-item">
          <span className="ls-sw" style={{ background: l.color }} />
          <div>
            <b>{l.label}</b>
            <small>{l.range}</small>
          </div>
        </div>
      ))}
    </div>
  );
}
