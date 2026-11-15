// Note: Implementation assisted by AI (Claude Code) following Horum Labs' methodology.
// Monthly comparison with the historical median, seasonality matrix, and yearly totals.

import { useMemo, useState } from 'react';
import type { MonthStat, YearTotal } from '../lib/analysis.ts';
import { CELL_ZERO, binLabels, cellColor, makeBins, percentile } from '../lib/colors.ts';
import { MONTHS_LONG, MONTHS_SHORT, formatMonth } from '../lib/dates.ts';
import { fmtInt, fmtNum, fmtRatio } from '../lib/format.ts';

const HOT_PCT = 90;

function niceMax(v: number): number {
  if (v <= 5) return 5;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p;
}

// ------------------------------------------------------------------ month vs median

export function MonthlyChart({ rows, onPick }: { rows: MonthStat[]; onPick?: (mo: number) => void }) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 760;
  const H = 210;
  const pad = { l: 46, r: 10, t: 12, b: 26 };
  const max = niceMax(Math.max(1, ...rows.map((r) => Math.max(r.cd, r.med ?? 0))));
  const bw = (W - pad.l - pad.r) / Math.max(rows.length, 1);
  const y = (v: number) => pad.t + (H - pad.t - pad.b) * (1 - v / max);
  const ticks = [0, max / 2, max];
  const h = hover !== null ? rows[hover] : null;
  // Label the first bar only when the next January is far enough away not to overlap it.
  const yearStarts = rows.map((r, i) => ({ r, i })).filter(({ r, i }) => r.m === 0 || (i === 0 && r.m <= 8));
  const labelEvery = Math.ceil(yearStarts.length / 10);

  const medianPath = rows
    .map((r, i) => (r.med === null ? null : `${i === 0 || rows[i - 1].med === null ? 'M' : 'L'}${pad.l + i * bw + bw / 2},${y(r.med)}`))
    .filter(Boolean)
    .join(' ');

  return (
    <div className="chart-wrap">
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Monthly cell-days compared with the historical median" onMouseLeave={() => setHover(null)}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} className="grid" />
            <text x={pad.l - 8} y={y(t) + 4} textAnchor="end" className="axis">{fmtInt(t)}</text>
          </g>
        ))}
        {rows.map((r, i) => {
          const hot = (r.pct ?? 0) >= HOT_PCT && r.cd > 0;
          const x = pad.l + i * bw;
          return (
            <g key={r.mo} onMouseEnter={() => setHover(i)} onClick={() => onPick?.(r.mo)} style={{ cursor: onPick ? 'pointer' : 'default' }}>
              <rect x={x} y={pad.t} width={bw} height={H - pad.t - pad.b} fill="transparent" />
              <rect
                x={x + Math.max(0.5, bw * 0.12)}
                y={y(r.cd)}
                width={Math.max(1, bw * 0.76)}
                height={Math.max(0, H - pad.b - y(r.cd))}
                rx={Math.min(2, bw * 0.2)}
                className={`bar ${hot ? 'hot' : ''} ${hover === i ? 'hover' : ''} ${r.ok ? '' : 'partial'}`}
              />
            </g>
          );
        })}
        {medianPath && <path d={medianPath} className="median-line" />}
        {yearStarts.map(({ r, i }, k) =>
          k % labelEvery === 0 ? (
            <text key={r.mo} x={pad.l + i * bw + 2} y={H - 8} className="axis">{rows.length > 24 ? r.y : `${MONTHS_SHORT[r.m]} ${r.y}`}</text>
          ) : null,
        )}
        {rows.length <= 24 &&
          rows.map((r, i) => (r.m !== 0 && i !== 0 && i % Math.ceil(rows.length / 12) === 0 ? (
            <text key={`l${r.mo}`} x={pad.l + i * bw + 2} y={H - 8} className="axis dim">{MONTHS_SHORT[r.m]}</text>
          ) : null))}
      </svg>
      <div className="chart-foot">
        <span className="lg-item"><i className="sw-bar" />Cell-days</span>
        <span className="lg-item"><i className="sw-bar hot" />Above P{HOT_PCT} of the same month</span>
        <span className="lg-item"><i className="sw-line" />Median of the same month, other years</span>
        <span className="chart-readout">
          {h ? (
            <>
              <strong>{formatMonth(h.mo)}</strong> · {fmtInt(h.cd)} cell-days
              {h.med !== null && <> · median {fmtNum(h.med)}</>}
              {h.ratio !== null && <> · <b>{fmtRatio(h.ratio)}</b></>}
              {h.pct !== null && <> · P{Math.round(h.pct)}</>}
              {!h.ok && <> · partial month</>}
            </>
          ) : (
            'Hover a month for details'
          )}
        </span>
      </div>
    </div>
  );
}

export function MonthHeadline({ row, partial }: { row: MonthStat | null; partial: MonthStat | null }) {
  if (!row) return null;
  const ratio = row.ratio;
  const cls = row.pct === null ? '' : row.pct >= 90 ? 'hot' : row.pct >= 75 ? 'warm' : row.pct <= 25 ? 'cool' : '';
  return (
    <div className="headline">
      <div className={`headline-big ${cls}`}>
        {ratio === null ? (row.med === 0 ? (row.cd > 0 ? 'Above a zero median' : 'In line') : '—') : fmtRatio(ratio)}
        <span>{ratio === null ? '' : 'of normal'}</span>
      </div>
      <div className="headline-text">
        <strong>{MONTHS_LONG[row.m]} {row.y}</strong> recorded <strong>{fmtInt(row.cd)}</strong> cell-days
        {row.med !== null && <> against a median of <strong>{fmtNum(row.med)}</strong> in the {row.histYears} other complete {MONTHS_LONG[row.m]}s since 2012</>}.
        {row.pct !== null && <> It is higher than or equal to <strong>{Math.round(row.pct)}%</strong> of them.</>}
        {partial && (
          <div className="headline-partial">
            {MONTHS_LONG[partial.m]} {partial.y} so far (days {partial.d1}–{partial.d2}, partial): {fmtInt(partial.cd)} cell-days · median of the same days in the {partial.histYears} other years {partial.med === null ? '—' : fmtNum(partial.med)}
            {partial.ratio !== null && <> · <strong>{fmtRatio(partial.ratio)}</strong> of normal</>}
            {partial.pct !== null && <> · higher than or equal to {Math.round(partial.pct)}% of them</>}.
          </div>
        )}
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ seasonality

export function SeasonalityMatrix({ rows }: { rows: MonthStat[] }) {
  const [hover, setHover] = useState<MonthStat | null>(null);
  const years = useMemo(() => [...new Set(rows.map((r) => r.y))].sort((a, b) => b - a), [rows]);
  const bins = useMemo(() => {
    const v = rows.map((r) => r.cd).filter((x) => x > 0).sort((a, b) => a - b);
    return makeBins(Math.max(1, percentile(v, 97)), percentile(v, 15));
  }, [rows]);
  const top = useMemo(() => [...rows].sort((a, b) => b.cd - a.cd)[0], [rows]);
  const byKey = useMemo(() => new Map(rows.map((r) => [`${r.y}-${r.m}`, r])), [rows]);
  const labels = binLabels(bins);

  const CW = 38;
  const CH = 17;
  const L = 40;
  const T = 18;
  const W = L + 12 * CW;
  const H = T + years.length * CH + 2;

  // Typical seasonal profile: median cell-days per calendar month across complete months.
  const profile = useMemo(() => {
    return MONTHS_SHORT.map((_, m) => {
      const v = rows.filter((r) => r.m === m && r.ok).map((r) => r.cd).sort((a, b) => a - b);
      return v.length ? v[Math.floor((v.length - 1) / 2)] : 0;
    });
  }, [rows]);
  const pmax = Math.max(1, ...profile);

  return (
    <div className="season">
      <svg viewBox={`0 0 ${W} ${H + 44}`} width="100%" role="img" aria-label="Cell-days by year and month" onMouseLeave={() => setHover(null)}>
        {MONTHS_SHORT.map((m, i) => (
          <text key={m} x={L + i * CW + CW / 2} y={11} textAnchor="middle" className="axis">{m}</text>
        ))}
        {years.map((y, yi) => (
          <g key={y}>
            <text x={L - 8} y={T + yi * CH + CH / 2 + 4} textAnchor="end" className="axis">{y}</text>
            {MONTHS_SHORT.map((_, m) => {
              const r = byKey.get(`${y}-${m}`);
              if (!r) return null;
              const isTop = r === top && r.cd > 0;
              return (
                <rect
                  key={m}
                  x={L + m * CW + 1}
                  y={T + yi * CH + 1}
                  width={CW - 2}
                  height={CH - 2}
                  rx={2.5}
                  fill={r.cd > 0 ? cellColor(r.cd, bins) : CELL_ZERO}
                  className={`season-cell ${isTop ? 'top' : ''} ${r.ok ? '' : 'partial'} ${hover === r ? 'hover' : ''}`}
                  onMouseEnter={() => setHover(r)}
                />
              );
            })}
          </g>
        ))}
        {/* Seasonal profile under the matrix */}
        {profile.map((v, m) => {
          const h = (v / pmax) * 32;
          return <rect key={`p${m}`} x={L + m * CW + 6} y={H + 38 - h} width={CW - 12} height={h} rx={2} className="profile-bar" />;
        })}
        <text x={L - 8} y={H + 36} textAnchor="end" className="axis dim">typical</text>
      </svg>
      <div className="chart-foot">
        <span className="lg-item"><i style={{ background: CELL_ZERO }} />0</span>
        {bins.map((b, k) => (
          <span className="lg-item" key={b}><i style={{ background: cellColor(b, bins) }} />{labels[k]}</span>
        ))}
        <span className="chart-readout">
          {hover ? (
            <>
              <strong>{formatMonth(hover.mo, true)}</strong> · {fmtInt(hover.cd)} cell-days · {hover.ad} active days
              {hover.ratio !== null && <> · {fmtRatio(hover.ratio)} the median</>}
              {!hover.ok && <> · partial month</>}
            </>
          ) : top && top.cd > 0 ? (
            <>Peak month on record: <strong>{formatMonth(top.mo, true)}</strong> ({fmtInt(top.cd)} cell-days)</>
          ) : (
            'No activity recorded'
          )}
        </span>
      </div>
    </div>
  );
}

export function YearBars({ totals, accent = false, note }: { totals: YearTotal[]; accent?: boolean; note?: string }) {
  const sorted = [...totals].sort((a, b) => b.y - a.y);
  const max = Math.max(1, ...totals.map((t) => t.cd));
  const best = [...totals].filter((t) => t.complete).sort((a, b) => b.cd - a.cd)[0];
  return (
    <div className="year-bars">
      {sorted.map((t) => (
        <div key={t.y} className={`yb-row ${best && t.y === best.y ? 'best' : ''}`}>
          <span className="yb-year">{t.y}</span>
          <span className="yb-track">
            <span className={`yb-fill ${accent ? 'modis' : ''}`} style={{ width: `${(100 * t.cd) / max}%` }} />
          </span>
          <span className="yb-val">
            {fmtInt(t.cd)}
            {!t.complete && <em> partial</em>}
          </span>
        </div>
      ))}
      {note && <div className="yb-note">{note}</div>}
    </div>
  );
}

export function TopMonths({ rows, n = 5 }: { rows: MonthStat[]; n?: number }) {
  const top = [...rows].filter((r) => r.cd > 0).sort((a, b) => b.cd - a.cd).slice(0, n);
  if (!top.length) return null;
  return (
    <ol className="top-months">
      {top.map((r, i) => (
        <li key={r.mo}>
          <span className="tm-rank">{i + 1}</span>
          <span className="tm-name">{formatMonth(r.mo, true)}</span>
          <span className="tm-val">{fmtInt(r.cd)}</span>
          {r.ratio !== null && <span className="tm-ratio">{fmtRatio(r.ratio)}</span>}
        </li>
      ))}
    </ol>
  );
}

/** Tiny inline bar chart used in the national overview. */
export function Sparkbars({ rows }: { rows: MonthStat[] }) {
  const W = 360;
  const H = 70;
  const max = Math.max(1, ...rows.map((r) => Math.max(r.cd, r.med ?? 0)));
  const bw = W / rows.length;
  const [hover, setHover] = useState<MonthStat | null>(null);
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="National monthly cell-days, last months" onMouseLeave={() => setHover(null)}>
        {rows.map((r, i) => {
          const h = (r.cd / max) * (H - 6);
          const mh = r.med === null ? null : H - (r.med / max) * (H - 6);
          return (
            <g key={r.mo} onMouseEnter={() => setHover(r)}>
              <rect x={i * bw} y={0} width={bw} height={H} fill="transparent" />
              <rect x={i * bw + 1} y={H - h} width={Math.max(1, bw - 2)} height={h} rx={1.5}
                className={`bar ${(r.pct ?? 0) >= HOT_PCT ? 'hot' : ''} ${hover === r ? 'hover' : ''} ${r.ok ? '' : 'partial'}`} />
              {mh !== null && <line x1={i * bw + 1} x2={i * bw + bw - 1} y1={mh} y2={mh} className="median-tick" />}
            </g>
          );
        })}
      </svg>
      <div className="spark-readout">
        {hover ? (
          <>
            <strong>{formatMonth(hover.mo)}</strong> · {fmtInt(hover.cd)} cell-days
            {hover.ratio !== null && <> · {fmtRatio(hover.ratio)} the median</>}
            {!hover.ok && ' · partial'}
          </>
        ) : (
          <>Bars: national cell-days per month · ticks: median of the same month</>
        )}
      </div>
    </div>
  );
}
