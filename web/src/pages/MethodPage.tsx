// Note: Implementation assisted by AI (Claude Code) following Horum Labs' methodology.
// Plain-language summary of docs/METHOD.md, docs/HARMONIZATION.md and docs/VALIDATION.md.
// The method and the harmonization rule are the team's; this page only explains them. The factors
// and test errors are read from the data (manifest.harmonization), not typed here.

import type { Harmonization } from '../lib/types.ts';
import { MONTHS_SHORT } from '../lib/dates.ts';
import { CELL_RAMP, CELL_ZERO, LEVELS } from '../lib/colors.ts';
import { Icon } from '../components/Icon.tsx';
import { LevelScale } from '../components/Panels.tsx';

const REPO = 'https://github.com/DrkGodEater9/nasa-space-apps-2026-burn-calendar/blob/main';

const SENSORS = [
  { name: 'MODIS (Terra + Aqua)', from: 2003, to: 2026.9, color: '#8f9bb3', role: 'Rescaled for 2003–2011' },
  { name: 'VIIRS S-NPP', from: 2012.05, to: 2026.84, color: CELL_RAMP[2], role: 'Reference sensor' },
  { name: 'VIIRS NOAA-20', from: 2018.25, to: 2026.9, color: CELL_RAMP[1], role: 'Fills S-NPP gaps' },
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
      <text x={x(2012.05) + 6} y={18} className="axis tl-ref-label">Observed by VIIRS · alerts and baselines</text>
      <text x={x(2003) + 6} y={18} className="axis">Estimated from MODIS</text>
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

function FactorTable({ harm }: { harm: Harmonization }) {
  return (
    <div className="factor-table" role="table" aria-label="Monthly factors from MODIS to VIIRS and their test error">
      <div role="row" className="ft-row ft-head">
        <span role="columnheader">Month</span>
        {MONTHS_SHORT.map((m) => <span role="columnheader" key={m}>{m}</span>)}
      </div>
      <div role="row" className="ft-row">
        <span role="rowheader">Factor</span>
        {harm.factors.map((f, i) => <span role="cell" key={i}>{f.toFixed(2)}</span>)}
      </div>
      <div role="row" className="ft-row">
        <span role="rowheader">Test error</span>
        {harm.national_error_pct.map((e, i) => <span role="cell" key={i}>±{Math.round(e)}%</span>)}
      </div>
    </div>
  );
}

export function MethodPage({ harm }: { harm: Harmonization | null }) {
  const counts = { ok: 0, low_confidence: 0, viirs_only: 0, insufficient: 0 };
  if (harm) for (const d of Object.values(harm.departments)) counts[d.status]++;
  return (
    <article className="doc">
      <header className="doc-hero">
        <div className="eyebrow"><Icon name="sparkle" size={14} /> Method</div>
        <h1>How four satellites become one honest calendar</h1>
        <p>
          MODIS and VIIRS see fire very differently. Adding their detections together would double count fires and make
          recent years look worse just because newer sensors see more. This is how the Horum Labs team harmonized them
          into one series from 2003 to today, and where that series can and cannot be trusted.
        </p>
      </header>

      <div className="notice-card">
        <Icon name="warning" size={20} />
        <div>
          <b>What a hot spot is.</b> A thermal anomaly detected by satellite, not a confirmed fire. Cloud cover can hide
          fires: a zero does not guarantee absence of fire. Data from different satellites are never summed on the same day.
        </div>
      </div>

      <section className="doc-section">
        <h2><span className="num">1</span>The pipeline</h2>
        <div className="pipeline">
          {[
            { t: 'Quality filter', d: 'Drop VIIRS low confidence, MODIS confidence < 30, and volcanoes, gas flares and offshore sources (type ≠ 0, plus a static-source mask for recent data, so Galeras and Llanos gas flares are not counted as wildfires).' },
            { t: 'Local date', d: 'Every detection is moved to Colombian time (UTC-5) before it is assigned to a day. Day and night passes are used together.' },
            { t: 'Count hot spots', d: 'The calendar counts accepted detections ("hot spots") per municipality and day. Active 1 km cells (a 0.01° grid) are kept as a second figure. A test chose between the two: see section 2.' },
            { t: 'One reference sensor', d: 'VIIRS S-NPP since 2012. On days S-NPP has no data, NOAA-20 (same orbit) fills in and the day is flagged. Sensors are never summed on the same day.' },
            { t: 'Rescale MODIS', d: 'For 2003–2011, MODIS hot spots are converted to VIIRS-equivalent units with one factor per calendar month, adjusted to the level of each department. These days are estimates and are always hatched.' },
            { t: 'Compare with itself', d: 'Each place is compared with its own history. Months are compared with the same month since 2003. Daily alerts use VIIRS since 2012 only; the MODIS era has its own internal anomaly.' },
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
        <h2><span className="num">2</span>One calendar from 2003: the harmonization rule</h2>
        <p>
          VIIRS reports about four times more hot spots than MODIS for the same fires: its pixel is about seven times smaller in
          area, it detects smaller fires and it loses less detail at the edges of its swath. The two records cannot be compared
          directly. The team's rule converts MODIS into VIIRS-equivalent units:
        </p>
        <ul className="bullets">
          <li><b>One factor per calendar month</b>, at national scale, from the years when both sensors overlap (2013–2025). The factor is the VIIRS S-NPP total of that month divided by the MODIS total.</li>
          {harm?.department_version === 2 && (
            <li><b>Adjusted to each department.</b> The ratio between the sensors is not the same everywhere: in the eastern plains VIIRS sees about 3.6–3.9 times what MODIS sees, in Bolívar or Magdalena more than 5 times. Each department's factor is the national monthly factor times its own level (its VIIRS/MODIS ratio over 2013–2025, divided by the national one). Departments with fewer than 100 detections keep the national factor. The national totals keep the national factor.</li>
          )}
          <li><b>2003–2011</b> are MODIS multiplied by that factor. 2000–2002 are excluded: a single satellite and incomplete data.</li>
          <li><b>From 2012</b> the calendar shows what VIIRS observed. Nothing is rescaled there.</li>
        </ul>
        <div className="figure"><SensorTimeline /></div>
        {harm && (
          <>
            <div className="figure"><FactorTable harm={harm} /></div>
            <h3>How it was tested</h3>
            <p>
              Leaving one year out: the factors are estimated with the other twelve years, applied to the MODIS data of the
              withheld year, and compared with what VIIRS observed. The margins were written down before the test ran: up to 15%
              median error for the national monthly total, and up to 30% per department and month.
            </p>
            <ul className="bullets">
              <li><b>National: passed.</b> Median error {harm.national_error_all_months_pct.toFixed(1)}% over 156 withheld months, and the worst calendar month is {Math.max(...harm.national_error_pct).toFixed(1)}%, just under the margin.</li>
              <li><b>Hot spots or 1 km cells?</b> Both were tested with the same margins. Hot spots had the lower error (6.9% against 8.3%), so they are the harmonized quantity.</li>
              {harm.department_version === 2 ? (
                <li><b>Departments: {counts.ok} of 33 passed</b>, {counts.low_confidence} is shown as low confidence, {counts.viirs_only} failed in most months and {counts.insufficient} have too few detections to evaluate. A first version with the national factor alone passed in 14 and showed 15; the department level was written down and tested the same way, and it was adopted because a rule fixed in advance said so (more departments shown from 2003). Bolívar improved but still fails; Caquetá passed with the national factor and does not with its own level.</li>
              ) : (
                <li><b>Departments: {counts.ok} of 33 passed</b>, {counts.low_confidence} is shown as low confidence, {counts.viirs_only} failed in most months and {counts.insufficient} have too few detections to evaluate. A national factor works where most of the burning happens (Vichada, Meta, Caquetá, Casanare, Cesar) and fails where MODIS and VIIRS relate differently, such as Bolívar and Magdalena.</li>
              )}
            </ul>
            <h3>What you see as a result</h3>
            <ul className="bullets">
              <li><b>Every area shows one calendar from 2003</b>, as the challenge asks. The MODIS-era days are always hatched and labeled "MODIS rescaled to VIIRS units (estimated)".</li>
              <li>Departments that passed show the typical test error of each month.</li>
              <li><b>Low confidence, with a visible warning:</b> departments that failed the test (estimated error above 30% in most months) or have too few detections to test, and every municipality and drawn area, which use the factor of their department and were never tested at that scale. Until November 15 these started in 2012; the team chose to show them with the warning so that every area answers the challenge from 2003.</li>
              <li>The national totals per year go back to 2003 on the home view, with the national factor.</li>
              <li>The month is compared with the same month in <b>every other year since 2003</b>: VIIRS from 2012, MODIS rescaled before.</li>
              <li>Anomalies in the MODIS era are computed against that era only (2003–2011) and are never mixed with current alerts.</li>
            </ul>
            <div className="notice-card">
              <Icon name="info" size={20} />
              <div>{harm.notice}</div>
            </div>
          </>
        )}
      </section>

      <section className="doc-section two">
        <div>
          <h2><span className="num">3</span>Is this week unusual?</h2>
          <p>
            For each municipality and day, the hot spots of the last 7 days are added up and compared with the same 7-day
            windows within ±15 days of that date in every other year since 2012 (about 400 windows). Neighboring windows
            overlap, so they are not independent samples, but their percentiles describe the normal range well.
          </p>
          <ul className="bullets">
            <li>At least <b>3 hot spots</b> are needed to call a week unusual or extreme.</li>
            <li>If a municipality had fewer than <b>10 active days</b> in its baseline season, its history is too short: the calendar shows the department level instead and says so.</li>
            <li>A window with 4 or more no-data days is not rated.</li>
            <li>The month is compared with the <b>median of the same month</b> in the other years since 2003 ("2.3× normal") and its percentile; 2003–2011 come from MODIS rescaled to VIIRS units. We use the median, not the average, so one extreme year does not hide unusual activity. The current, unfinished month is compared with the <b>same days</b> of that month in the other years (for example days 1–13), never with whole months.</li>
          </ul>
        </div>
        <div>
          <LevelScale />
          <div className="states">
            <h4>Reading the calendar</h4>
            <div className="state"><i style={{ background: CELL_ZERO }} /> Zero hot spots</div>
            <div className="state"><i className="lg-nodata" /> No data: no satellite observation that day</div>
            <div className="state"><i style={{ background: `linear-gradient(90deg, ${CELL_RAMP.join(',')})`, width: 60 }} /> Hot spots, more is brighter</div>
            <div className="state"><i className="lg-est" style={{ background: CELL_RAMP[1] }} /> Estimated: MODIS rescaled to VIIRS units</div>
            <div className="state"><i style={{ background: CELL_RAMP[0], position: 'relative' }}><b className="lg-dot" /></i> NOAA-20 filled the day</div>
            <div className="state"><i className="lg-ring" /> 7-day level unusual or <span style={{ color: LEVELS[3].color }}>extreme</span></div>
          </div>
        </div>
      </section>

      <section className="doc-section">
        <h2><span className="num">4</span>Drawing your own area</h2>
        <p>
          The data are counted per municipality (DANE MGN 2018, 1,122 areas; each detection falls in a 1 km cell, and the cell
          belongs to the municipality that contains its center). The coverage is Colombia only. A drawn polygon or a bounding box is answered with every municipality that has at least 25% of
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
          data pipeline (ingestion, filters, boundaries), not the harmonized series: the method never sums sensors on the same day.
        </p>
      </section>

      <section className="doc-section">
        <h2><span className="num">6</span>Limits</h2>
        <ul className="bullets">
          <li><b>The MODIS era is an estimate.</b> The factor was tested inside 2013–2025. That it also held in 2003–2011 cannot be verified, because VIIRS did not exist then. Read that era as lower confidence.</li>
          <li>The error is larger in regions and months with few detections, and it was not measured at municipality scale.</li>
          <li>A hot spot is one detection, not one fire: a large fire produces several, and VIIRS and MODIS count them differently.</li>
          <li>Satellites pass over a few times a day: short fires between passes and fires under clouds or smoke are missed.</li>
          <li>Hot spots also come from agricultural burning, which is common and seasonal; "unusual" means unusual for that place and season, not illegal or harmful.</li>
          <li>Municipality boundaries are DANE MGN 2018. Other boundary versions move some detections between neighbors.</li>
          <li>The newest days come from near-real-time data, which FIRMS later replaces with standard processing.</li>
        </ul>
        <p>
          Full details: <a href={`${REPO}/docs/METHOD.md`} target="_blank" rel="noopener noreferrer">METHOD.md</a>,{' '}
          <a href={`${REPO}/docs/HARMONIZATION.md`} target="_blank" rel="noopener noreferrer">HARMONIZATION.md</a>,{' '}
          <a href={`${REPO}/docs/VALIDATION.md`} target="_blank" rel="noopener noreferrer">VALIDATION.md</a> and{' '}
          <a href={`${REPO}/docs/DATA_CONTRACT.md`} target="_blank" rel="noopener noreferrer">DATA_CONTRACT.md</a>.
        </p>
      </section>
    </article>
  );
}
