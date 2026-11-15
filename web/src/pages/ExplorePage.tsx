// Note: Implementation assisted by AI (Claude Code) following Horum Labs' methodology.
// Main explorer: map + day inspector on the left, area analysis on the right.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { BootData } from '../lib/data.ts';
import { loadDept } from '../lib/data.ts';
import type { Area, ColorMode, MapTool, Sensor } from '../lib/types.ts';
import {
  computeAreaSeries, eraMonthTotals, findEpisodes, harmonizedYearTotals, modisYearTotals, municipalLevelsAt, nationalAt, nationalMonthly,
  summarizeRange, yearTotals, type IndexedDept, type RangeSummary,
} from '../lib/analysis.ts';
import {
  areaBounds, areaFromKey, bboxPolygon, departmentArea, municipalityArea, pointArea, shapeArea,
} from '../lib/geo.ts';
import { clampDay, dayParts, dayToISO, formatDay, isValidIso, isoToDay, monthIndexOfDay, ymdToDay } from '../lib/dates.ts';
import { imageryForDay } from '../lib/imagery.ts';
import { dailyCsv, memberCsv, monthlyCsv, pointsCsv, slug } from '../lib/csv-exporter.ts';
import { fmtInt } from '../lib/format.ts';
import { MapView } from '../components/MapView.tsx';
import { DayInspector } from '../components/DayInspector.tsx';
import { NationalOverview } from '../components/NationalOverview.tsx';
import { AreaMembers, AreaPicker } from '../components/AreaPicker.tsx';
import { ActivityCalendar, SENSOR_START, valueAt } from '../components/ActivityCalendar.tsx';
import { MonthHeadline, MonthlyChart, SeasonalityMatrix, TopMonths, YearBars } from '../components/Charts.tsx';
import { Card, DataQuality, Episodes, Kpis, PngButton, RangeControls, Tabs, viewCaption, viewOf } from '../components/Panels.tsx';

const PANEL_TABS = ['calendar', 'history', 'unusual', 'notes'] as const;
type PanelTab = (typeof PANEL_TABS)[number];
import { Icon } from '../components/Icon.tsx';

const COLOMBIA_BOUNDS: [number, number, number, number] = [-79.2, -4.3, -66.8, 12.6];

interface Props {
  boot: BootData;
  params: URLSearchParams;
  onParams: (p: URLSearchParams) => void;
}

export function ExplorePage({ boot, params, onParams }: Props) {
  const { ctx, geo, national, manifest } = boot;
  const refStart = ctx.refStart;
  const refEnd = ctx.refEnd;
  const endYear = dayParts(refEnd).y;

  // ------------------------------------------------------------ state (seeded from the URL)
  const [area, setArea] = useState<Area | null>(() => (params.get('area') ? areaFromKey(geo, params.get('area')!) : null));
  const [sensor, setSensor] = useState<Sensor>(() => (['ref', 'modis', 'n21'].includes(params.get('sensor') ?? '') ? (params.get('sensor') as Sensor) : 'ref'));
  const [range, setRange] = useState<[number, number]>(() => {
    const f = params.get('from');
    const t = params.get('to');
    // Each date is clamped into the data range before ordering, so a hand-edited URL with both dates
    // outside the range (or in the wrong order) still gives a valid range.
    const a = clampDay(f && isValidIso(f) ? isoToDay(f) : ymdToDay(endYear - 2, 0, 1), 0, refEnd);
    const b = clampDay(t && isValidIso(t) ? isoToDay(t) : refEnd, 0, refEnd);
    return [Math.min(a, b), Math.max(a, b)];
  });
  const [focusDay, setFocusDay] = useState<number>(() => {
    const d = params.get('day');
    return d && isValidIso(d) ? Math.min(refEnd, Math.max(0, isoToDay(d))) : refEnd;
  });
  const [colorMode, setColorMode] = useState<ColorMode>(params.get('color') === 'level' ? 'level' : 'cells');
  const [markUnusual, setMarkUnusual] = useState(true);
  const [tool, setTool] = useState<MapTool>('select');
  const [imageryOn, setImageryOn] = useState(params.get('img') === '1');
  const [depts, setDepts] = useState<Map<string, IndexedDept>>(new Map());
  const [loadError, setLoadError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [csvMenu, setCsvMenu] = useState(false);
  // The area view is split into sections, one visible at a time, so the panel is not one long column.
  const [tab, setTab] = useState<PanelTab>(() => (PANEL_TABS.includes(params.get('tab') as PanelTab) ? (params.get('tab') as PanelTab) : 'calendar'));
  // The search box of the area view stays closed until the reader asks to change the area.
  const [pickerOpen, setPickerOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  // The CSV menu closes on a tap or click outside it and on Escape. Touch screens have no "mouse leave",
  // so without this the menu stayed open over the calendar.
  useEffect(() => {
    if (!csvMenu) return;
    const onDown = (e: PointerEvent) => {
      if (!(e.target instanceof Element) || !e.target.closest('.menu-wrap')) setCsvMenu(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setCsvMenu(false); };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [csvMenu]);

  // ------------------------------------------------------------ URL sync
  useEffect(() => {
    const p = new URLSearchParams();
    if (area) p.set('area', area.key);
    p.set('from', dayToISO(range[0]));
    p.set('to', dayToISO(range[1]));
    if (focusDay !== refEnd) p.set('day', dayToISO(focusDay));
    if (sensor !== 'ref') p.set('sensor', sensor);
    if (colorMode !== 'cells') p.set('color', colorMode);
    if (imageryOn) p.set('img', '1');
    if (area && tab !== 'calendar') p.set('tab', tab);
    onParams(p);
  }, [area, range, focusDay, sensor, colorMode, imageryOn, tab, onParams, refEnd]);

  // ------------------------------------------------------------ department files
  useEffect(() => {
    if (!area) return;
    let alive = true;
    const missing = area.dptoCodes.filter((c) => !depts.has(c));
    if (!missing.length) return;
    setLoadError(null);
    Promise.all(area.dptoCodes.map((c) => loadDept(manifest, c)))
      .then((list) => {
        if (!alive) return;
        setDepts(new Map(area.dptoCodes.map((c, i) => [c, list[i]])));
      })
      .catch((e: Error) => alive && setLoadError(e.message));
    return () => {
      alive = false;
    };
  }, [area, depts, manifest]);

  const ready = !!area && area.dptoCodes.every((c) => depts.has(c));
  const series = useMemo(() => (ready && area ? computeAreaSeries(area, depts, national, ctx) : null), [ready, area, depts, national, ctx]);
  // The single calendar goes back to 2003 only where the area shows MODIS rescaled to VIIRS units.
  const hasEra = sensor === 'ref' && !!series?.era;
  const minDay = hasEra ? 0 : isoToDay(SENSOR_START[sensor]);
  const loadedDepts = useMemo(() => (ready && area ? area.dptoCodes : []), [ready, area]);
  const mapDepts = useMemo(() => new Map([...depts].filter(([c]) => loadedDepts.includes(c))), [depts, loadedDepts]);
  const muniLevels = useMemo(() => municipalLevelsAt(mapDepts, focusDay), [mapDepts, focusDay]);
  const deptLevels = useMemo(() => nationalAt(national, focusDay), [national, focusDay]);
  const natMonthly = useMemo(() => nationalMonthly(national, ctx), [national, ctx]);
  const imagery = useMemo(() => imageryForDay(focusDay, ctx), [focusDay, ctx]);

  // If the chosen sensor starts after the selected range (e.g. NOAA-21 with dates before 2023), move the range
  // to that sensor's full record instead of leaving an empty, inverted view.
  // Only once the area is loaded: before that the MODIS era is unknown and minDay would be 2012.
  useEffect(() => {
    if (series && range[1] < minDay) setRange([minDay, refEnd]);
  }, [series, minDay, range, refEnd]);

  const [from, to] = range;
  const viewFrom = Math.min(Math.max(from, minDay), Math.max(to, minDay));

  const summary: RangeSummary | null = useMemo(() => {
    if (!series) return null;
    if (sensor === 'ref') return summarizeRange(series, ctx, viewFrom, to);
    const out: RangeSummary = {
      days: to - viewFrom + 1, cellDays: 0, activeDays: 0, noDataDays: 0, filledDays: 0, peakDay: -1, peakCells: 0,
      levelDays: [0, 0, 0, 0, 0], lastLevel: -1, lastLevelDay: to, estimatedDays: 0,
    };
    for (let d = viewFrom; d <= to; d++) {
      const v = valueAt(series, sensor, d);
      out.cellDays += v;
      if (v > 0) out.activeDays++;
      if (v > out.peakCells) { out.peakCells = v; out.peakDay = d; }
    }
    return out;
  }, [series, sensor, ctx, viewFrom, to]);

  const episodes = useMemo(() => (series ? findEpisodes(series, Math.max(from, refStart), to) : []), [series, from, to, refStart]);
  const rangeMonths = useMemo(() => {
    if (!series) return [];
    const a = monthIndexOfDay(Math.max(from, refStart));
    const b = monthIndexOfDay(to);
    return series.monthly.filter((r) => r.mo >= a && r.mo <= b);
  }, [series, from, to, refStart]);
  // Derived tables, computed once per area or range instead of on every render.
  const refYearTotals = useMemo(
    () => (series ? harmonizedYearTotals(series.era ? series.era.est : null, refStart, yearTotals(series.monthly)) : []),
    [series, refStart],
  );
  const eraMonths = useMemo(() => (series?.era ? eraMonthTotals(series.era.est, refStart) : []), [series, refStart]);
  const natYearTotals = useMemo(() => harmonizedYearTotals(ctx.nationalEra, refStart, yearTotals(natMonthly)), [ctx, refStart, natMonthly]);
  const modisTotals = useMemo(() => (series && sensor === 'modis' ? modisYearTotals(series.modis) : []), [series, sensor]);
  const refSummary = useMemo(() => (series ? summarizeRange(series, ctx, Math.max(from, refStart), to) : null), [series, ctx, from, to, refStart]);
  const headlineMonth = useMemo(() => [...rangeMonths].reverse().find((r) => r.ok) ?? null, [rangeMonths]);
  const partialMonth = useMemo(() => {
    const last = rangeMonths[rangeMonths.length - 1];
    return last && !last.ok && last.mo === monthIndexOfDay(refEnd) ? last : null;
  }, [rangeMonths, refEnd]);

  // ------------------------------------------------------------ actions
  const flash = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 3200);
  };

  const choose = useCallback((a: Area | null) => {
    if (!a) return;
    if (!a.members.length) {
      flash('No municipality has at least 25% of its area inside that shape. Draw a larger area.');
      return;
    }
    setArea(a);
    setCsvMenu(false);
    setPickerOpen(false);
    panelRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
    if (window.innerWidth < 1100) window.setTimeout(() => panelRef.current?.scrollIntoView({ behavior: 'smooth' }), 350);
  }, []);

  const onDepartment = useCallback((code: string) => choose(departmentArea(geo, code)), [geo, choose]);
  const onMunicipality = useCallback((code: string) => choose(municipalityArea(geo, code)), [geo, choose]);
  const onShape = useCallback((poly: GeoJSON.Polygon, kind: 'polygon' | 'bbox') => choose(shapeArea(geo, poly, kind)), [geo, choose]);
  const onPoint = useCallback((lon: number, lat: number) => {
    const a = pointArea(geo, lon, lat);
    if (!a) return 'That point is not inside any Colombian municipality.';
    choose(a);
    return null;
  }, [geo, choose]);
  const onBox = useCallback((w: number, s: number, e: number, n: number) => {
    const a = shapeArea(geo, bboxPolygon(w, s, e, n), 'bbox');
    if (!a.members.length) return 'No municipality has at least 25% of its area inside that box.';
    choose(a);
    return null;
  }, [geo, choose]);

  const onSensor = (s: Sensor) => {
    setSensor(s);
    const min = isoToDay(SENSOR_START[s]);
    if (s === 'modis' && from >= refStart) setRange([ymdToDay(2003, 0, 1), ymdToDay(2011, 11, 31)]);
    else if (s !== 'modis' && from < min) setRange([Math.max(min, ymdToDay(endYear - 2, 0, 1)), refEnd]);
    if (s === 'n21' && from < min) setRange([min, refEnd]);
  };

  const onRange = (a: number, b: number) => {
    setRange([a, b]);
    if (focusDay < a || focusDay > b) setFocusDay(b);
  };

  const pickYear = useCallback((y: number) => {
    const a = Math.max(minDay, ymdToDay(y, 0, 1));
    const b = Math.min(refEnd, ymdToDay(y, 11, 31));
    setRange([a, b]);
    setFocusDay((d) => (d < a || d > b ? b : d));
  }, [minDay, refEnd]);
  const years = dayParts(to).y - dayParts(viewFrom).y + 1;

  const clearArea = useCallback(() => {
    setArea(null);
    setTool('select');
    setFocusDay(refEnd);
  }, [refEnd]);
  const toggleImagery = useCallback(() => setImageryOn((on) => !on), []);
  const startPolygon = useCallback(() => setTool('polygon'), []);

  const [pointsBusy, setPointsBusy] = useState(false);
  const downloadPoints = async () => {
    if (!area || !manifest.points || pointsBusy) return;
    setCsvMenu(false);
    setPointsBusy(true);
    flash('Preparing the hot spot points…');
    try {
      const n = await pointsCsv(area, Math.max(0, from), to, manifest.points);
      flash(n ? `${fmtInt(n)} hot spot points downloaded.` : 'No hot spots in this area and these dates.');
    } catch (e) {
      flash(e instanceof Error ? e.message : 'The points could not be downloaded.');
    } finally {
      setPointsBusy(false);
    }
  };

  const share = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      flash('Link copied. It opens this exact view.');
    } catch {
      flash('Copy the address bar to share this view.');
    }
  };

  const bounds = useMemo(() => (area && areaBounds(geo, area)) || COLOMBIA_BOUNDS, [geo, area]);
  const memberNames = useMemo(() => area?.members.map((m) => m.name) ?? [], [area]);
  // Short form of the low-confidence warning, shown next to the calendar whenever estimated days of an area
  // that did not pass (or was not part of) the harmonization test are on screen. The full text is in Data notes.
  const lowConfidence = !series?.era || !hasEra || viewFrom >= refStart || series.era.status === 'ok' ? null
    : series.era.status === 'not_tested' ? 'The MODIS rescaling was tested for departments, not at this scale: the error of the hatched days is unknown.'
    : series.era.status === 'viirs_only' ? 'This department did not pass the harmonization test: the hatched days can be off by more than 30%.'
    : series.era.status === 'insufficient' ? 'Too few detections here to test the harmonization: the error of the hatched days is unknown.'
    : 'For this department the estimated error of the hatched days is above 30%.';
  const sensorLabel = sensor === 'ref' ? (hasEra && viewFrom < refStart ? 'MODIS rescaled + VIIRS' : 'VIIRS reference') : sensor === 'modis' ? 'MODIS C6.1, raw' : 'NOAA-21, info';

  return (
    <div className="explore">
      <div className="explore-panel" ref={panelRef}>
        {!area && (
          <NationalOverview
            geo={geo}
            day={focusDay}
            depts={deptLevels}
            monthly={natMonthly}
            years={natYearTotals}
            harm={ctx.harm}
            onDepartment={onDepartment}
            onMunicipality={onMunicipality}
            onPoint={onPoint}
            onBox={onBox}
            onDrawTool={startPolygon}
          />
        )}

        {area && (
          <>
            <section className="area-head">
              <div className="area-title">
                <span className={`badge ${area.kind}`}>{area.kind === 'bbox' ? 'BOX' : area.kind === 'point' ? 'POINT' : area.kind.slice(0, 3).toUpperCase()}</span>
                <div>
                  <h2>{area.label}</h2>
                  <p>{area.sublabel}</p>
                </div>
                <div className="area-actions">
                  <button className={`btn quiet ${pickerOpen ? 'on' : ''}`} onClick={() => setPickerOpen(!pickerOpen)} aria-expanded={pickerOpen} title="Search another place or type coordinates"><Icon name="search" /> Change area</button>
                  <button className="btn quiet" onClick={share} title="Copy a link to this view"><Icon name="link" /> Share</button>
                  <button className="btn quiet" onClick={clearArea} title="Back to the national overview"><Icon name="close" /> Clear</button>
                </div>
              </div>
              <AreaMembers area={area} />
              {pickerOpen && <AreaPicker geo={geo} compact onDepartment={onDepartment} onMunicipality={onMunicipality} onPoint={onPoint} onBox={onBox} />}
            </section>

            <section className="query">
              <RangeControls
                from={viewFrom}
                to={to}
                minDay={minDay}
                maxDay={refEnd}
                onChange={onRange}
                sensor={sensor}
                onSensor={onSensor}
                colorMode={colorMode}
                onColorMode={setColorMode}
                markUnusual={markUnusual}
                onMarkUnusual={setMarkUnusual}
              />
            </section>

            {loadError && <div className="error-box"><Icon name="warning" /> {loadError}</div>}
            {!series && !loadError && <LoadingCard label={`Loading ${area.dptoCodes.length > 1 ? `${area.dptoCodes.length} departments` : 'department data'}…`} />}

            {series && summary && (
              <>
                <Tabs<PanelTab>
                  label="Sections"
                  value={tab}
                  onChange={setTab}
                  options={[
                    { value: 'calendar', label: 'Calendar' },
                    { value: 'history', label: 'History' },
                    { value: 'unusual', label: 'Unusual activity', count: episodes.length, hot: episodes.length > 0 },
                    { value: 'notes', label: 'Data notes' },
                  ]}
                />

                {tab === 'calendar' && (<>
                {sensor !== 'ref' && (
                  <div className={`sensor-note ${sensor}`}>
                    <Icon name="info" />
                    {sensor === 'modis'
                      ? 'MODIS, raw. These are MODIS hot spots as observed, not rescaled. MODIS pixels are about 7 times larger than VIIRS pixels, so the counts are lower and must not be compared directly with VIIRS. No alerts are computed here, and data gaps are not flagged in this view.'
                      : 'NOAA-21 is an informational layer. Its history since 2023 is too short for a baseline, so it has no anomaly levels and is never added to the reference series.'}
                  </div>
                )}

                {lowConfidence && (
                  <div className="confidence-note" role="note">
                    <Icon name="warning" size={14} />
                    <span><b>Low confidence before {formatDay(refStart, false)}.</b> {lowConfidence} <button className="link-btn" onClick={() => setTab('notes')}>Data notes</button></span>
                  </div>
                )}

                <Card
                  title="Activity calendar"
                  icon="calendar"
                  sub={viewCaption(viewOf(viewFrom, to, minDay, refEnd), viewFrom, to)}
                  info={<>Each square is one day · {sensor === 'ref' ? (hasEra ? 'hot spots, harmonized MODIS + VIIRS (hatched days are estimates)' : 'hot spots (VIIRS reference)') : sensorLabel}. Hover a day for its numbers and click it to inspect it on the map{years > 1 ? '; click a year to open only that year' : ''}. Arrow keys move the selected day.</>}
                  actions={
                    <div className="card-buttons">
                    <PngButton
                      filename={`burn_calendar_${slug(area)}_${dayToISO(viewFrom)}_${dayToISO(to)}_calendar.png`}
                      title={`Activity calendar · ${area.label}`}
                      subtitle={`${formatDay(viewFrom, false)} – ${formatDay(to, false)} · ${sensor === 'ref' ? 'hot spots per day, harmonized calendar' : sensorLabel}`}
                      note={hasEra && viewFrom < refStart
                        ? `Hatched days (before ${formatDay(refStart, false)}) are MODIS rescaled to VIIRS units: estimates, not observations.${series.era && series.era.status !== 'ok' ? ' Low confidence for this area (see Data coverage and caveats).' : ''}`
                        : undefined}
                    />
                    <div className="menu-wrap">
                      <button className="btn primary" onClick={() => setCsvMenu(!csvMenu)} aria-expanded={csvMenu}>
                        <Icon name="download" /> CSV
                      </button>
                      {csvMenu && (
                        <div className="menu" role="menu" onMouseLeave={() => setCsvMenu(false)}>
                          {manifest.points && (
                            <button role="menuitem" onClick={downloadPoints} disabled={pointsBusy}>
                              <b>Hot spot points</b><small>Every detection of this search: date, time, latitude, longitude, sensor, confidence, FRP. All satellites, not to be added together</small>
                            </button>
                          )}
                          <button role="menuitem" onClick={() => { dailyCsv(area, series, ctx, hasEra ? viewFrom : Math.max(from, refStart), to); setCsvMenu(false); }}>
                            <b>Daily series</b><small>One row per day: hot spots, 7-day total, level, sensor, gaps{hasEra ? ', estimated days marked with how far the estimate was tested' : ''}</small>
                          </button>
                          {area.members.length > 1 && (
                            <button role="menuitem" onClick={() => { memberCsv(area, series, Math.max(from, refStart), to); setCsvMenu(false); }}>
                              <b>By municipality</b><small>One row per municipality and day with activity</small>
                            </button>
                          )}
                          <button role="menuitem" onClick={() => { monthlyCsv(area, series, Math.max(from, refStart), to); setCsvMenu(false); }}>
                            <b>Monthly vs. history</b><small>Hot spots, median of the same month, ratio and percentile</small>
                          </button>
                        </div>
                      )}
                    </div>
                    </div>
                  }
                >
                  <ActivityCalendar
                    series={series}
                    ctx={ctx}
                    from={viewFrom}
                    to={to}
                    sensor={sensor}
                    colorMode={colorMode}
                    markUnusual={markUnusual}
                    focusDay={focusDay}
                    onFocus={setFocusDay}
                    memberNames={memberNames}
                    onPickYear={pickYear}
                  />
                </Card>

                <Kpis s={summary} sensorLabel={sensorLabel} showLevels={sensor === 'ref'} />

                {sensor === 'modis' && (
                  <Card title="MODIS, raw" icon="clock" sub="Hot spots per year, as observed and not rescaled."
                    info="MODIS Collection 6.1 hot spots per year, as observed and not rescaled. 2000–2002 are excluded: a single satellite and incomplete data.">
                    <YearBars totals={modisTotals} accent />
                  </Card>
                )}
                </>)}

                {tab === 'history' && (<>
                <Card title="This month vs. normal" icon="chart"
                  actions={rangeMonths.length > 1 ? (
                    <PngButton
                      filename={`burn_calendar_${slug(area)}_${dayToISO(viewFrom)}_${dayToISO(to)}_monthly.png`}
                      title={`Monthly hot spots vs. normal · ${area.label}`}
                      subtitle={`${formatDay(Math.max(viewFrom, refStart), false)} – ${formatDay(to, false)} · dashed line: median of the same month in the other years since 2003`}
                      note={series.era ? 'The median uses 2003–2011 MODIS rescaled to VIIRS units (estimates).' : undefined}
                    />
                  ) : undefined}
                  sub="Each month against the median of the same month in the other years."
                  info="Monthly hot spots in the selected dates against the median of the same month in the other years since 2003: VIIRS from 2012, MODIS rescaled to VIIRS units (estimated) for 2003–2011. Orange months are above the 90th percentile of their history.">
                  <MonthHeadline row={headlineMonth} partial={partialMonth} />
                  {rangeMonths.length > 1 && <MonthlyChart rows={rangeMonths} />}
                </Card>

                <Card title="When does it burn?" icon="layers"
                  actions={
                    <PngButton
                      filename={`burn_calendar_${slug(area)}_seasonality.png`}
                      title={`When does it burn? · ${area.label}`}
                      subtitle="Hot spots per month, every year on record"
                      note={eraMonths.length ? 'Hatched months (2003–2011) are MODIS rescaled to VIIRS units: estimates, not observations.' : undefined}
                    />
                  }
                  sub="Every month on record. Brighter is more active."
                  info={eraMonths.length
                  ? 'Every month since 2003: VIIRS from 2012, MODIS rescaled to VIIRS units for 2003–2011 (hatched, estimates). Darker is quieter, brighter is more active. The bars below show the typical month.'
                  : 'Every month since 2012 (VIIRS). Darker is quieter, brighter is more active. The bars below show the typical month.'}>
                  <div className="season-grid">
                    <SeasonalityMatrix rows={series.monthly} era={eraMonths} />
                    <div className="season-side">
                      <h4>Busiest years</h4>
                      <YearBars
                        totals={refYearTotals}
                        note={series.era
                          ? 'Hot spots per year. 2003–2011 are MODIS rescaled to VIIRS units (estimated, lighter bars); 2012 adds 19 estimated days. The busiest-year mark uses observed years only.'
                          : 'Hot spots per year. 2012 starts on 20 January.'}
                      />
                      <h4>Busiest months on record</h4>
                      <TopMonths rows={series.monthly} />
                    </div>
                  </div>
                </Card>
                </>)}

                {tab === 'unusual' && (
                <Card
                  title="Unusual activity"
                  icon="warning"
                  sub={<>{fmtInt(episodes.length)} in the selected dates. Click one to see it on the map.</>}
                  info="Runs of days whose 7-day total is above the 90th percentile for that place and season (at least 3 hot spots). VIIRS era only."
                >
                  <Episodes episodes={episodes} onFocus={setFocusDay} />
                </Card>
                )}

                {tab === 'notes' && (
                <Card title="Data coverage and caveats" icon="info">
                  <DataQuality area={area} series={series} summary={refSummary!} ctx={ctx} from={from} to={to} />
                </Card>
                )}
              </>
            )}
          </>
        )}
        <p className="panel-foot">
          Data through {formatDay(refEnd, false)} · Hot spot = thermal anomaly detected by satellite, not a confirmed fire.
        </p>
      </div>

      <div className="explore-map">
        <MapView
          geo={geo}
          area={area}
          tool={tool}
          onToolChange={setTool}
          focusDay={focusDay}
          deptLevels={deptLevels}
          muniLevels={muniLevels}
          loadedDepts={loadedDepts}
          imageryOn={imageryOn}
          imagery={imagery}
          onImageryToggle={toggleImagery}
          onSelectMunicipality={onMunicipality}
          onSelectDepartment={onDepartment}
          onShape={onShape}
          onClear={clearArea}
        />
        <DayInspector
          day={focusDay}
          ctx={ctx}
          minDay={0}
          area={ready ? area : null}
          series={series}
          national={deptLevels}
          bounds={bounds}
          imagery={imagery}
          imageryOn={imageryOn}
          onDay={setFocusDay}
          onImageryToggle={toggleImagery}
        />
      </div>

      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  );
}

function LoadingCard({ label }: { label: string }) {
  return (
    <div className="card loading">
      <div className="spinner" />
      <span>{label}</span>
      <div className="skeleton-cal">
        {Array.from({ length: 3 }, (_, i) => <div key={i} />)}
      </div>
    </div>
  );
}
