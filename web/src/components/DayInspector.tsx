// Note: Implementation assisted by AI (Claude Code) following Horum Labs' methodology.
// Details of the selected day, with links to the NASA tools that show the raw detections.

import type { AreaSeries, DeptStatus, RefContext } from '../lib/analysis.ts';
import { STATUS_N20, STATUS_NODATA } from '../lib/analysis.ts';
import type { Area } from '../lib/types.ts';
import { LEVELS, levelInfo } from '../lib/colors.ts';
import { formatDay } from '../lib/dates.ts';
import { firmsUrl, worldviewUrl, type ImageryLayer } from '../lib/imagery.ts';
import { fmtInt, titleCase } from '../lib/format.ts';
import { Icon } from './Icon.tsx';

interface Props {
  day: number;
  ctx: RefContext;
  minDay: number;
  area: Area | null;
  series: AreaSeries | null;
  national: DeptStatus[];
  bounds: [number, number, number, number];
  imagery: ImageryLayer;
  imageryOn: boolean;
  onDay: (d: number) => void;
  onImageryToggle: () => void;
}

export function DayInspector(p: Props) {
  const { day, ctx } = p;
  const i = day - ctx.refStart;
  const st = i >= 0 && i < ctx.status.length ? ctx.status[i] : -1;
  const statusLabel = st === STATUS_NODATA ? 'No VIIRS data' : st === STATUS_N20 ? 'NOAA-20 fill' : st === 0 ? 'VIIRS S-NPP' : 'Before VIIRS';

  let body;
  if (p.area && p.series) {
    const s = p.series;
    // A day before the VIIRS reference, shown as MODIS rescaled to VIIRS units where the area has it.
    const era = i < 0 && day >= 0 ? s.era : null;
    const lv = era ? era.level[day] : s.level[i] ?? -1;
    const li = levelInfo(lv);
    const contributors = p.area.members
      .map((m, k) => ({ name: m.name, c: s.memberCells[k][i] ?? 0 }))
      .filter((x) => x.c > 0)
      .sort((a, b) => b.c - a.c)
      .slice(0, 4);
    body = (
      <>
        <div className="di-stats">
          <div>
            <div className="di-label">{era ? 'Hot spots (est.)' : 'Hot spots'}</div>
            <div className="di-val">{era ? (ctx.eraNoData[day] ? '—' : `≈ ${fmtInt(Math.round(era.est[day]))}`) : st === STATUS_NODATA ? '—' : fmtInt(s.cells[i] ?? 0)}</div>
          </div>
          <div>
            <div className="di-label">7-day total</div>
            <div className="di-val">{era ? `≈ ${fmtInt(Math.round(era.est7[day]))}` : fmtInt(s.cells7[i] ?? 0)}</div>
          </div>
          <div>
            <div className="di-label">Level</div>
            <div className="di-val"><span className="level-pill" style={{ background: li.color, color: li.text }}>{li.label}</span></div>
          </div>
        </div>
        {era && <div className="di-note">MODIS rescaled to VIIRS units (estimated). The level is the internal anomaly of the MODIS era (2003–2011), not a current alert.</div>}
        {!era && s.fallback[i] ? <div className="di-note">Municipal history is too short this season; department level shown.</div> : null}
        {contributors.length > 1 && (
          <div className="di-contrib">
            {contributors.map((c) => <span key={c.name}>{c.name} <b>{fmtInt(c.c)}</b></span>)}
          </div>
        )}
      </>
    );
  } else {
    const counts = [0, 0, 0, 0];
    let total = 0;
    for (const d of p.national) {
      if (d.level >= 0 && d.level < 4) counts[d.level]++;
      total += d.cells7;
    }
    const hot = [...p.national].filter((d) => d.level >= 2 && d.level <= 3).sort((a, b) => b.level - a.level || b.cells7 - a.cells7);
    body = (
      <>
        <div className="di-stats">
          <div>
            <div className="di-label">Colombia, 7 days</div>
            <div className="di-val">{fmtInt(total)}<small> hot spots</small></div>
          </div>
          {[3, 2, 1].map((l) => (
            <div key={l}>
              <div className="di-label">{LEVELS[l].label}</div>
              <div className="di-val" style={{ color: counts[l] ? LEVELS[l].color : undefined }}>{counts[l]}<small> dept.</small></div>
            </div>
          ))}
        </div>
        {hot.length > 0 && (
          <div className="di-contrib">
            {hot.slice(0, 5).map((d) => (
              <span key={d.code}><i className="dot" style={{ background: levelInfo(d.level).color }} />{titleCase(d.name)}</span>
            ))}
          </div>
        )}
      </>
    );
  }

  return (
    <section className="inspector" aria-label="Selected day">
      <div className="di-head">
        <div className="di-nav">
          <button className="icon-btn" onClick={() => p.onDay(Math.max(p.minDay, day - 1))} aria-label="Previous day" disabled={day <= p.minDay}>‹</button>
          <div>
            <div className="di-date">{formatDay(day)}</div>
            <div className="di-where">{p.area ? p.area.label : 'All of Colombia'} · <span className={`status-tag s${st}`}>{statusLabel}</span></div>
          </div>
          <button className="icon-btn" onClick={() => p.onDay(Math.min(ctx.refEnd, day + 1))} aria-label="Next day" disabled={day >= ctx.refEnd}>›</button>
        </div>
        <div className="di-links">
          <button className={`chip ${p.imageryOn ? 'on amber' : ''}`} onClick={p.onImageryToggle} title={`${p.imagery.label} from NASA GIBS`}>
            <Icon name="satellite" size={13} /> {p.imageryOn ? 'Imagery on' : 'See the sky that day'}
          </button>
          <a className="chip" href={worldviewUrl(p.bounds, day, p.imagery.id)} target="_blank" rel="noopener noreferrer" title="Open this day in NASA Worldview with the fire detection layers">
            Worldview <Icon name="external" size={12} />
          </a>
          <a className="chip" href={firmsUrl(p.bounds, day)} target="_blank" rel="noopener noreferrer" title="Open the individual detections of this day on the NASA FIRMS map">
            FIRMS <Icon name="external" size={12} />
          </a>
        </div>
      </div>
      {body}
    </section>
  );
}
