// Note: Implementation assisted by AI (Claude Code) following Horum Labs' methodology.
// Plain-language summary of docs/METHOD.md and docs/VALIDATION.md. The method is the team's;
// this page only explains it.

import { CELL_RAMP, CELL_ZERO, LEVELS } from '../lib/colors.ts';
import { Icon } from '../components/Icon.tsx';
import { LevelScale } from '../components/Panels.tsx';

const REPO = 'https://github.com/DrkGodEater9/nasa-space-apps-2026-burn-calendar/blob/main';

const SENSORS = [
  { name: 'MODIS (Terra + Aqua)', from: 2003, to: 2026.9, color: '#8f9bb3', role: 'Long history only' },
  { name: 'VIIRS S-NPP', from: 2012.05, to: 2026.84, color: CELL_RAMP[4], role: 'Reference sensor' },
  { name: 'VIIRS NOAA-20', from: 2018.25, to: 2026.9, color: CELL_RAMP[3], role: 'Fills S-NPP gaps' },
  { name: 'VIIRS NOAA-21', from: 2023.17, to: 2026.9, color: '#5ad1ff', role: 'Informational' },
];

function SensorTimeline() {
  const x0 = 2003;
  const x1 = 2027;
  const L = 150;
  const W = 760;
  const x = (v: number) => L + ((v - x0) / (x1 - x0)) * (W - L - 10);
  return (
    <svg viewBox={`0 0 ${W} 170`} width="100%" role="img" aria-label="Sensor timeline from 2003 to 2026">
      {[2003, 2006, 2009, 2012, 2015, 2018, 2021, 2024, 2027].map((y) => (
        <g key={y}>
          <line x1={x(y)} x2={x(y)} y1={8} y2={140} className="grid" />
          <text x={x(y)} y={158} textAnchor="middle" className="axis">{y}</text>
        </g>
      ))}
      <rect x={x(2012.05)} y={4} width={x(2026.9) - x(2012.05)} height={136} className="tl-ref" />
      <text x={x(2012.05) + 6} y={18} className="axis tl-ref-label">Comparable period · alerts and baselines</text>
      {SENSORS.map((s, i) => (
        <g key={s.name}>
          <text x={0} y={42 + i * 26} className="tl-name">{s.name}</text>
          <rect x={x(s.from)} y={31 + i * 26} width={x(s.to) - x(s.from)} height={14} rx={7} fill={s.color} opacity={0.9} />
          <text x={x(s.to) - 8} y={42 + i * 26} textAnchor="end" className="tl-role">{s.role}</text>
        </g>
      ))}
    </svg>
  );
}

export function MethodPage() {
  return (
    <article className="doc">
      <header className="doc-hero">
        <div className="eyebrow"><Icon name="sparkle" size={14} /> Method</div>
        <h1>How four satellites become one honest calendar</h1>
        <p>
          MODIS and VIIRS see fire very differently. Adding their detections together would double count fires and make
          recent years look worse just because newer sensors see more. This is how the Horum Labs team harmonized them.
        </p>
      </header>

      <div className="notice-card">
        <Icon name="warning" size={20} />
        <div>
          <b>What a hot spot is.</b> A thermal anomaly detected by satellite, not a confirmed fire. Cloud cover can hide
          fires: a zero does not guarantee absence of fire. Data from different satellites are not summed.
        </div>
      </div>

      <section className="doc-section">
        <h2><span className="num">1</span>The pipeline</h2>
        <div className="pipeline">
          {[
            { t: 'Quality filter', d: 'Drop VIIRS low confidence, MODIS confidence < 30, and volcanoes, gas flares and offshore sources (type ≠ 0, plus a static-source mask for recent data, so Galeras and Llanos gas flares are not counted as wildfires).' },
            { t: 'Local date', d: 'Every detection is moved to Colombian time (UTC-5) before it is assigned to a day. Day and night passes are used together.' },
            { t: '1 km cells', d: 'Detections are snapped to a 0.01° grid. A cell is active if it has at least one detection that day, so one big fire no longer counts as eight VIIRS points.' },
            { t: 'One reference sensor', d: 'VIIRS S-NPP since 2012. On days S-NPP has no data, NOAA-20 (same orbit) fills in and the day is flagged. Sensors are never summed.' },
            { t: 'Compare with itself', d: 'Each place is compared with its own history in the same season, which removes the remaining difference between sensors.' },
          ].map((s, i) => (
            <div key={s.t} className="step">
              <div className="step-n">{String(i + 1).padStart(2, '0')}</div>
              <h3>{s.t}</h3>
              <p>{s.d}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="doc-section">
        <h2><span className="num">2</span>Which satellite, when</h2>
        <p>
          VIIRS reports about four times more hot spots than MODIS for the same fires: its pixel is about seven times smaller in
          area, it detects smaller fires and it loses less detail at the edges of its swath. Counting 1 km cells narrows the gap;
          comparing each sensor only with its own history removes it. That is why the calendar shows one reference series and
          keeps MODIS in a separate "Long history" view.
        </p>
        <div className="figure"><SensorTimeline /></div>
      </section>

      <section className="doc-section two">
        <div>
          <h2><span className="num">3</span>Is this week unusual?</h2>
          <p>
            For each municipality and day, the active cells of the last 7 days are added up and compared with the same 7-day
            windows within ±15 days of that date in every other year since 2012 (about 400 windows). Neighboring windows
            overlap, so they are not independent samples, but their percentiles describe the normal range well.
          </p>
          <ul className="bullets">
            <li>At least <b>3 active cells</b> are needed to call a week unusual or extreme.</li>
            <li>If a municipality had fewer than <b>10 active days</b> in its baseline season, its history is too short: the calendar shows the department level instead and says so.</li>
            <li>A window with 4 or more no-data days is not rated.</li>
            <li>The month is compared with the <b>median of the same month</b> in other years ("2.3× normal") and its percentile.</li>
          </ul>
        </div>
        <div>
          <LevelScale />
          <div className="states">
            <h4>Reading the calendar</h4>
            <div className="state"><i style={{ background: CELL_ZERO }} /> Zero active cells</div>
            <div className="state"><i className="lg-nodata" /> No data: neither VIIRS satellite observed that day</div>
            <div className="state"><i style={{ background: `linear-gradient(90deg, ${CELL_RAMP.join(',')})`, width: 60 }} /> Active cells, more is brighter</div>
            <div className="state"><i style={{ background: CELL_RAMP[1], position: 'relative' }}><b className="lg-dot" /></i> NOAA-20 filled the day</div>
            <div className="state"><i className="lg-ring" /> 7-day level unusual or <span style={{ color: LEVELS[3].color }}>extreme</span></div>
          </div>
        </div>
      </section>

      <section className="doc-section">
        <h2><span className="num">4</span>Drawing your own area</h2>
        <p>
          The data are counted per municipality (DANE MGN 2018, 1,122 areas; each 1 km cell belongs to the municipality that
          contains its center). A drawn polygon or a bounding box is answered with every municipality that has at least 25% of
          its area inside it, counted in full. The list of municipalities and the share inside the shape is always shown. For
          several municipalities, the level shown each day is the highest among them.
        </p>
      </section>

      <section className="doc-section">
        <h2><span className="num">5</span>Checked against IDEAM</h2>
        <p>
          IDEAM, Colombia's environmental agency, publishes semester hot spot reports. Reproducing its totals from the same FIRMS
          files (raw detections, MODIS + S-NPP + NOAA-20, archive type 0) checks our ingestion, filters and boundaries:
        </p>
        <div className="val-grid">
          {[
            ['2023-S1', '157,216', '156,655', '+0.4%'],
            ['2023-S2', '54,054', '53,665', '+0.7%'],
            ['2024-S1', '168,867', '168,208', '+0.4%'],
            ['2024-S2', '57,826', '57,205', '+1.1%'],
          ].map(([s, ours, ideam, d]) => (
            <div key={s} className="val">
              <span className="val-sem">{s}</span>
              <span className="val-diff">{d}</span>
              <span className="val-detail">{ours} ours · {ideam} IDEAM</span>
            </div>
          ))}
        </div>
        <p className="muted">
          39 of the 40 department values IDEAM lists are within ±10% (38 within ±5%). The exception is Caquetá, whose shortfall
          mirrors an excess in neighboring Meta, which points to a different boundary layer along that border. This validates the
          data pipeline, not the harmonized cells: the method never sums sensors.
        </p>
      </section>

      <section className="doc-section">
        <h2><span className="num">6</span>Limits</h2>
        <ul className="bullets">
          <li>Satellites pass over a few times a day: short fires between passes and fires under clouds or smoke are missed.</li>
          <li>Hot spots also come from agricultural burning, which is common and seasonal; "unusual" means unusual for that place and season, not illegal or harmful.</li>
          <li>Municipality boundaries are DANE MGN 2018. Other boundary versions move some detections between neighbors.</li>
          <li>The newest days come from near-real-time data, which FIRMS later replaces with standard processing.</li>
        </ul>
        <p>
          Full details: <a href={`${REPO}/docs/METHOD.md`} target="_blank" rel="noopener noreferrer">METHOD.md</a>,{' '}
          <a href={`${REPO}/docs/VALIDATION.md`} target="_blank" rel="noopener noreferrer">VALIDATION.md</a> and{' '}
          <a href={`${REPO}/docs/DATA_CONTRACT.md`} target="_blank" rel="noopener noreferrer">DATA_CONTRACT.md</a>.
        </p>
      </section>
    </article>
  );
}
