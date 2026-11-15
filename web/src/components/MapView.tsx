// Note: Implementation assisted by AI (Claude Code) following Horum Labs' methodology.
// Interactive map: pick a department or municipality, draw a polygon or rectangle, and see
// the 7-day activity level of the selected day. Optional NASA GIBS true-color imagery.

import { memo, useEffect, useRef, useState } from 'react';
import * as maplibregl from 'maplibre-gl';
import type { GeoJSONSource, MapMouseEvent, RasterTileSource } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { Area, MapTool } from '../lib/types.ts';
import type { GeoIndex } from '../lib/geo.ts';
import { areaBounds, ringToPolygon } from '../lib/geo.ts';
import { GEO_FILES, dataUrl } from '../lib/data.ts';
import type { DeptStatus } from '../lib/analysis.ts';
import { LEVELS, levelInfo } from '../lib/colors.ts';
import { gibsTiles, type ImageryLayer } from '../lib/imagery.ts';
import { formatDay } from '../lib/dates.ts';
import { fmtInt, titleCase } from '../lib/format.ts';
import { Icon } from './Icon.tsx';

const BASEMAP = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json';
const COLOMBIA: [number, number, number, number] = [-79.2, -4.3, -66.8, 12.6];
const PICK_MUNICIPALITY_ZOOM = 6;
const EMPTY: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] };

const levelColor: maplibregl.ExpressionSpecification = [
  'match', ['coalesce', ['feature-state', 'lvl'], -1],
  0, LEVELS[0].color, 1, LEVELS[1].color, 2, LEVELS[2].color, 3, LEVELS[3].color, 4, LEVELS[4].color,
  'rgba(0,0,0,0)',
];

function levelOpacity(scale: number): maplibregl.ExpressionSpecification {
  return [
    'match', ['coalesce', ['feature-state', 'lvl'], -1],
    0, 0.32 * scale, 1, 0.72 * scale, 2, 0.8 * scale, 3, 0.85 * scale, 4, 0.3 * scale,
    0,
  ];
}

interface Hover {
  key: string;
  title: string;
  sub: string;
  level: number;
  cells7: number | null;
}

interface Props {
  geo: GeoIndex;
  area: Area | null;
  tool: MapTool;
  onToolChange: (t: MapTool) => void;
  focusDay: number;
  deptLevels: DeptStatus[];
  muniLevels: Map<string, { level: number; cells7: number; name: string }>;
  loadedDepts: string[];
  imageryOn: boolean;
  imagery: ImageryLayer;
  onImageryToggle: () => void;
  onSelectMunicipality: (code: string) => void;
  onSelectDepartment: (code: string) => void;
  onShape: (poly: GeoJSON.Polygon, kind: 'polygon' | 'bbox') => void;
  onClear: () => void;
}

// Memoized: the explorer re-renders often (selected day, menus, toasts); the map only needs to when its props change.
export const MapView = memo(function MapView(props: Props) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [ready, setReady] = useState(false);
  const [hover, setHover] = useState<Hover | null>(null);
  const tipRef = useRef<HTMLDivElement>(null);
  const tipPos = useRef({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(4.5);
  const [drawCount, setDrawCount] = useState(0);
  const [mapError, setMapError] = useState(false);

  // Latest props for handlers registered once.
  const live = useRef(props);
  live.current = props;
  const draw = useRef<[number, number][]>([]);

  // ------------------------------------------------------------ init
  useEffect(() => {
    if (!container.current) return;
    const map = new maplibregl.Map({
      container: container.current,
      style: BASEMAP,
      bounds: COLOMBIA,
      fitBoundsOptions: { padding: 20 },
      attributionControl: { compact: true },
      dragRotate: false,
      pitchWithRotate: false,
      maxZoom: 12,
      minZoom: 3,
    });
    mapRef.current = map;
    map.touchZoomRotate.disableRotation();
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-right');
    map.on('error', (e) => {
      // Basemap failures should not hide the data layers; just flag them.
      if (String(e.error?.message ?? '').includes('cartocdn')) setMapError(true);
    });

    map.on('load', () => {
      const firstSymbol = map.getStyle().layers.find((l) => l.type === 'symbol')?.id;

      map.addSource('gibs', {
        type: 'raster',
        tiles: [gibsTiles(live.current.imagery.id, live.current.focusDay)],
        tileSize: 256,
        maxzoom: 9,
        attribution: 'Imagery: <a href="https://earthdata.nasa.gov/gibs" target="_blank" rel="noopener">NASA GIBS</a>',
      });
      // The boundaries are given to MapLibre as URLs, not as objects: its worker fetches them (from the
      // HTTP cache, the app already downloaded them) and parses them off the main thread. Passing the
      // objects made the main thread copy about 2 MB of geometry into the worker at start-up.
      // The worker resolves relative URLs against its own script, so the URL must be absolute.
      const abs = (path: string) => new URL(dataUrl(path), window.location.href).href;
      map.addSource('departments', { type: 'geojson', data: abs(GEO_FILES.departments), promoteId: 'DPTO_CCDGO' });
      map.addSource('municipalities', { type: 'geojson', data: abs(GEO_FILES.municipalities), promoteId: 'MPIO_CDPMP' });
      map.addSource('shape', { type: 'geojson', data: EMPTY });
      map.addSource('draw', { type: 'geojson', data: EMPTY });

      const add = (layer: maplibregl.LayerSpecification) => map.addLayer(layer, firstSymbol);
      add({ id: 'gibs', type: 'raster', source: 'gibs', layout: { visibility: 'none' }, paint: { 'raster-opacity': 0.95 } });
      add({ id: 'dept-fill', type: 'fill', source: 'departments', paint: { 'fill-color': levelColor, 'fill-opacity': levelOpacity(1) } });
      add({ id: 'muni-fill', type: 'fill', source: 'municipalities', filter: ['in', ['get', 'DPTO_CCDGO'], ['literal', []]], paint: { 'fill-color': levelColor, 'fill-opacity': levelOpacity(1) } });
      add({ id: 'muni-hit', type: 'fill', source: 'municipalities', paint: { 'fill-opacity': 0 } });
      add({ id: 'muni-line', type: 'line', source: 'municipalities', minzoom: 5.5, paint: { 'line-color': '#9fb3d1', 'line-opacity': ['interpolate', ['linear'], ['zoom'], 5.5, 0.08, 9, 0.3], 'line-width': 0.6 } });
      add({ id: 'dept-line', type: 'line', source: 'departments', paint: { 'line-color': '#a9bbd6', 'line-opacity': 0.45, 'line-width': ['interpolate', ['linear'], ['zoom'], 4, 0.6, 9, 1.6] } });
      const hoverOpacity: maplibregl.ExpressionSpecification = ['case', ['boolean', ['feature-state', 'hover'], false], 0.9, 0];
      add({ id: 'hover-line', type: 'line', source: 'municipalities', paint: { 'line-color': '#ffffff', 'line-width': 1.5, 'line-opacity': hoverOpacity } });
      add({ id: 'hover-dept-line', type: 'line', source: 'departments', paint: { 'line-color': '#ffffff', 'line-width': 1.6, 'line-opacity': hoverOpacity } });
      add({ id: 'selected-fill', type: 'fill', source: 'municipalities', filter: ['in', ['get', 'MPIO_CDPMP'], ['literal', []]], paint: { 'fill-color': '#5ad1ff', 'fill-opacity': 0.1 } });
      add({ id: 'selected-line', type: 'line', source: 'municipalities', filter: ['in', ['get', 'MPIO_CDPMP'], ['literal', []]], paint: { 'line-color': '#5ad1ff', 'line-width': 1.8 } });
      add({ id: 'shape-line', type: 'line', source: 'shape', paint: { 'line-color': '#ffffff', 'line-width': 2, 'line-dasharray': [2, 1.5] } });
      add({ id: 'draw-fill', type: 'fill', source: 'draw', filter: ['==', ['geometry-type'], 'Polygon'], paint: { 'fill-color': '#5ad1ff', 'fill-opacity': 0.15 } });
      add({ id: 'draw-line', type: 'line', source: 'draw', filter: ['!=', ['geometry-type'], 'Point'], paint: { 'line-color': '#5ad1ff', 'line-width': 2, 'line-dasharray': [1.5, 1] } });
      // The hover outline must stay visible above the cyan selection outline.
      map.moveLayer('hover-line', 'shape-line');
      map.moveLayer('hover-dept-line', 'shape-line');
      map.addLayer({ id: 'draw-points', type: 'circle', source: 'draw', filter: ['==', ['geometry-type'], 'Point'], paint: { 'circle-radius': 4.5, 'circle-color': '#0b1220', 'circle-stroke-color': '#5ad1ff', 'circle-stroke-width': 2 } });
      setReady(true);
    });

    map.on('zoomend', () => setZoom(map.getZoom()));

    // ------------------------------------------------------------ drawing helpers
    const renderDraw = (cursor?: [number, number]) => {
      const pts = draw.current;
      const tool = live.current.tool;
      const feats: GeoJSON.Feature[] = pts.map((p) => ({ type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: p } }));
      if (tool === 'rectangle' && pts.length === 1 && cursor) {
        const [a, b] = [pts[0], cursor];
        feats.push({ type: 'Feature', properties: {}, geometry: ringToPolygon([[a[0], a[1]], [b[0], a[1]], [b[0], b[1]], [a[0], b[1]]]) });
      } else if (tool === 'polygon' && pts.length) {
        const ring = cursor ? [...pts, cursor] : pts;
        feats.push(
          ring.length >= 3
            ? { type: 'Feature', properties: {}, geometry: ringToPolygon(ring) }
            : { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: ring } },
        );
      }
      (map.getSource('draw') as GeoJSONSource | undefined)?.setData({ type: 'FeatureCollection', features: feats });
    };

    const finishPolygon = () => {
      const pts = draw.current;
      if (pts.length < 3) return;
      draw.current = [];
      setDrawCount(0);
      renderDraw();
      live.current.onShape(ringToPolygon(pts), 'polygon');
      live.current.onToolChange('select');
    };

    const onClick = (e: MapMouseEvent) => {
      const { tool } = live.current;
      const p: [number, number] = [e.lngLat.lng, e.lngLat.lat];
      if (tool === 'polygon') {
        draw.current = [...draw.current, p];
        setDrawCount(draw.current.length);
        renderDraw();
        return;
      }
      if (tool === 'rectangle') {
        if (!draw.current.length) {
          draw.current = [p];
          setDrawCount(1);
          renderDraw();
        } else {
          const a = draw.current[0];
          draw.current = [];
          setDrawCount(0);
          renderDraw();
          if (Math.abs(a[0] - p[0]) < 1e-4 || Math.abs(a[1] - p[1]) < 1e-4) return;
          const [w, e2] = [Math.min(a[0], p[0]), Math.max(a[0], p[0])];
          const [s, n] = [Math.min(a[1], p[1]), Math.max(a[1], p[1])];
          live.current.onShape(ringToPolygon([[w, s], [e2, s], [e2, n], [w, n]]), 'bbox');
          live.current.onToolChange('select');
        }
        return;
      }
      const f = map.queryRenderedFeatures(e.point, { layers: ['muni-hit'] })[0];
      if (!f) return;
      const pr = f.properties as Record<string, string>;
      if (map.getZoom() < PICK_MUNICIPALITY_ZOOM) live.current.onSelectDepartment(pr.DPTO_CCDGO);
      else live.current.onSelectMunicipality(pr.MPIO_CDPMP);
    };

    const onDblClick = (e: MapMouseEvent) => {
      if (live.current.tool !== 'polygon') return;
      e.preventDefault();
      // The double click also fired two clicks; drop the duplicate last vertex.
      if (draw.current.length > 3) draw.current = draw.current.slice(0, -1);
      finishPolygon();
    };

    // Hover outline via feature-state (a paint change) instead of setFilter, which would make
    // MapLibre re-process the geometries on every mouse move. The tooltip follows the mouse by
    // moving its DOM node directly; React only re-renders when the hovered area changes.
    let hovered: { source: 'municipalities' | 'departments'; id: string } | null = null;
    let frame = 0;
    let lastEvent: MapMouseEvent | null = null;

    const setHovered = (next: typeof hovered) => {
      if (hovered && next && hovered.source === next.source && hovered.id === next.id) return false;
      if (hovered) map.setFeatureState(hovered, { hover: false });
      if (next) map.setFeatureState(next, { hover: true });
      hovered = next;
      return true;
    };

    const processMove = () => {
      frame = 0;
      const e = lastEvent;
      if (!e) return;
      const { tool } = live.current;
      if (tool !== 'select' && draw.current.length) renderDraw([e.lngLat.lng, e.lngLat.lat]);
      tipPos.current = { x: e.point.x, y: e.point.y };
      if (tipRef.current) tipRef.current.style.transform = `translate(${e.point.x + 14}px, ${e.point.y + 14}px)`;
      const f = map.queryRenderedFeatures(e.point, { layers: ['muni-hit'] })[0];
      if (!f) {
        if (setHovered(null)) setHover(null);
        return;
      }
      const pr = f.properties as Record<string, string>;
      const byDept = map.getZoom() < PICK_MUNICIPALITY_ZOOM && tool === 'select';
      const L = live.current;
      if (byDept) {
        if (!setHovered({ source: 'departments', id: pr.DPTO_CCDGO })) return;
        const d = L.deptLevels.find((x) => x.code === pr.DPTO_CCDGO);
        setHover({ key: `d${pr.DPTO_CCDGO}`, title: titleCase(pr.DPTO_CNMBR), sub: 'Department', level: d?.level ?? -1, cells7: d?.cells7 ?? 0 });
      } else {
        if (!setHovered({ source: 'municipalities', id: pr.MPIO_CDPMP })) return;
        const m = L.muniLevels.get(pr.MPIO_CDPMP);
        setHover({ key: `m${pr.MPIO_CDPMP}`, title: titleCase(pr.MPIO_CNMBR), sub: titleCase(pr.DPTO_CNMBR), level: m?.level ?? -1, cells7: m ? m.cells7 : null });
      }
      map.getCanvas().style.cursor = tool === 'select' ? 'pointer' : 'crosshair';
    };

    const onMove = (e: MapMouseEvent) => {
      lastEvent = e;
      if (!frame) frame = requestAnimationFrame(processMove);
    };

    const onKey = (ev: KeyboardEvent) => {
      const { tool } = live.current;
      if (tool === 'select') return;
      if (ev.key === 'Escape') {
        draw.current = [];
        setDrawCount(0);
        renderDraw();
        live.current.onToolChange('select');
      } else if (ev.key === 'Enter' && tool === 'polygon') {
        finishPolygon();
      } else if (ev.key === 'Backspace' && draw.current.length) {
        draw.current = draw.current.slice(0, -1);
        setDrawCount(draw.current.length);
        renderDraw();
      }
    };

    map.on('click', onClick);
    map.on('dblclick', onDblClick);
    map.on('mousemove', onMove);
    map.on('mouseout', () => {
      lastEvent = null;
      setHovered(null);
      setHover(null);
    });
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // ------------------------------------------------------------ tool changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (props.tool === 'polygon') map.doubleClickZoom.disable();
    else map.doubleClickZoom.enable();
    map.getCanvas().style.cursor = props.tool === 'select' ? '' : 'crosshair';
    if (props.tool === 'select' && draw.current.length) {
      draw.current = [];
      setDrawCount(0);
      (map.getSource('draw') as GeoJSONSource | undefined)?.setData(EMPTY);
    }
  }, [props.tool, ready]);

  // ------------------------------------------------------------ data-driven styling
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    for (const d of props.deptLevels) map.setFeatureState({ source: 'departments', id: d.code }, { lvl: d.level });
  }, [props.deptLevels, ready]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    for (const [code, v] of props.muniLevels) map.setFeatureState({ source: 'municipalities', id: code }, { lvl: v.level });
  }, [props.muniLevels, ready]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const loaded = props.loadedDepts;
    map.setFilter('muni-fill', ['in', ['get', 'DPTO_CCDGO'], ['literal', loaded]]);
    map.setFilter('dept-fill', ['!', ['in', ['get', 'DPTO_CCDGO'], ['literal', loaded]]]);
  }, [props.loadedDepts, ready]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const codes = props.area?.members.map((m) => m.mpio) ?? [];
    map.setFilter('selected-line', ['in', ['get', 'MPIO_CDPMP'], ['literal', codes]]);
    map.setFilter('selected-fill', ['in', ['get', 'MPIO_CDPMP'], ['literal', codes]]);
    const shape = props.area?.geometry;
    (map.getSource('shape') as GeoJSONSource).setData(
      shape ? { type: 'FeatureCollection', features: [{ type: 'Feature', properties: {}, geometry: shape }] } : EMPTY,
    );
    if (props.area) {
      const b = areaBounds(props.geo, props.area);
      if (b) map.fitBounds(b, { padding: { top: 70, bottom: 60, left: 40, right: 40 }, maxZoom: 10, duration: 900 });
    } else if (map.getZoom() > 5.2) {
      map.fitBounds(COLOMBIA, { padding: 20, duration: 900 });
    }
  }, [props.area, ready]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    map.setLayoutProperty('gibs', 'visibility', props.imageryOn ? 'visible' : 'none');
    const scale = props.imageryOn ? 0.45 : 1;
    map.setPaintProperty('dept-fill', 'fill-opacity', levelOpacity(scale));
    map.setPaintProperty('muni-fill', 'fill-opacity', levelOpacity(scale));
    if (props.imageryOn) (map.getSource('gibs') as RasterTileSource).setTiles([gibsTiles(props.imagery.id, props.focusDay)]);
  }, [props.imageryOn, props.imagery.id, props.focusDay, ready]);

  const pickHint = zoom < PICK_MUNICIPALITY_ZOOM ? 'Click a department · zoom in to pick a municipality' : 'Click a municipality';

  return (
    <div className="map-shell">
      <div ref={container} className="map-canvas" role="application" aria-label="Map of Colombia for selecting an area" />

      <div className="map-toolbar" role="toolbar" aria-label="Map tools">
        <button className={`tool ${props.tool === 'select' ? 'active' : ''}`} onClick={() => props.onToolChange('select')} title="Click to select a department or municipality">
          <Icon name="cursor" /> <span>Select</span>
        </button>
        <button className={`tool ${props.tool === 'polygon' ? 'active' : ''}`} onClick={() => props.onToolChange(props.tool === 'polygon' ? 'select' : 'polygon')} title="Draw a polygon">
          <Icon name="polygon" /> <span>Polygon</span>
        </button>
        <button className={`tool ${props.tool === 'rectangle' ? 'active' : ''}`} onClick={() => props.onToolChange(props.tool === 'rectangle' ? 'select' : 'rectangle')} title="Draw a rectangle">
          <Icon name="square" /> <span>Box</span>
        </button>
        <span className="tool-sep" />
        <button className={`tool ${props.imageryOn ? 'active amber' : ''}`} onClick={props.onImageryToggle} title="Show NASA satellite imagery of the selected day">
          <Icon name="satellite" /> <span>Imagery</span>
        </button>
        {props.area && (
          <>
            <span className="tool-sep" />
            <button className="tool danger" onClick={props.onClear} title="Remove the selected area or drawn shape and go back to all of Colombia">
              <Icon name="close" /> <span>Clear</span>
            </button>
          </>
        )}
      </div>

      <div className="map-hint" aria-live="polite">
        {props.tool === 'polygon' && (drawCount === 0 ? 'Click to add the first vertex' : `${drawCount} vertices · double-click or Enter to finish · Backspace undo · Esc cancel`)}
        {props.tool === 'rectangle' && (drawCount === 0 ? 'Click the first corner' : 'Click the opposite corner · Esc to cancel')}
        {props.tool === 'select' && pickHint}
      </div>

      <div className="map-legend">
        <div className="map-legend-title">
          7-day activity level · <strong>{formatDay(props.focusDay, false)}</strong>
        </div>
        <div className="map-legend-row">
          {LEVELS.slice(0, 4).map((l) => (
            <span key={l.key} className="lg-item"><i style={{ background: l.color }} />{l.label}</span>
          ))}
          <span className="lg-item"><i style={{ background: LEVELS[4].color }} />Insufficient</span>
        </div>
        {props.imageryOn && <div className="map-legend-img"><Icon name="satellite" size={12} /> {props.imagery.label} · NASA GIBS</div>}
      </div>

      {mapError && <div className="map-warn">Basemap unavailable — data layers still work.</div>}

      {hover && (
        <div className="map-tip" ref={tipRef} style={{ left: 0, top: 0, transform: `translate(${tipPos.current.x + 14}px, ${tipPos.current.y + 14}px)` }}>
          <div className="tip-title">{hover.title}</div>
          <div className="tip-sub">{hover.sub}</div>
          {hover.cells7 === null ? (
            <div className="tip-row muted">Select its department to see levels</div>
          ) : (
            <div className="tip-row">
              <span className="dot" style={{ background: levelInfo(hover.level).color }} />
              {levelInfo(hover.level).label} · {fmtInt(hover.cells7)} hot spots in 7 days
            </div>
          )}
        </div>
      )}
    </div>
  );
});
