// Note: Implementation assisted by AI (Claude Code) following Horum Labs' methodology.
// Area selection on the DANE MGN 2018 boundaries. A drawn shape uses every municipality with
// at least 25% of its area inside it (docs/METHOD.md, "Hand-drawn polygon").

import { area as turfArea } from '@turf/area';
import { intersect } from '@turf/intersect';
import { featureCollection, polygon as turfPolygon } from '@turf/helpers';
import { booleanPointInPolygon } from '@turf/boolean-point-in-polygon';
import { bbox as turfBbox } from '@turf/bbox';
import type { Area, AreaMember } from './types.ts';
import { titleCase } from './format.ts';

export const MIN_COVERAGE = 0.25;

type PolyFeature = GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon>;

export interface MunicipalityGeo {
  code: string;
  name: string;
  dpto: string;
  dptoName: string;
  bbox: [number, number, number, number];
  area: number;
  feature: PolyFeature;
}

export interface DepartmentGeo {
  code: string;
  name: string;
  bbox: [number, number, number, number];
  municipalities: MunicipalityGeo[];
}

export interface GeoIndex {
  municipalities: GeoJSON.FeatureCollection;
  departments: GeoJSON.FeatureCollection;
  muniList: MunicipalityGeo[];
  muniByCode: Map<string, MunicipalityGeo>;
  deptByCode: Map<string, DepartmentGeo>;
}

export function buildGeoIndex(municipalities: GeoJSON.FeatureCollection, departments: GeoJSON.FeatureCollection): GeoIndex {
  const muniList: MunicipalityGeo[] = municipalities.features.map((f) => {
    const p = f.properties as Record<string, string>;
    return {
      code: p.MPIO_CDPMP,
      name: titleCase(p.MPIO_CNMBR),
      dpto: p.DPTO_CCDGO,
      dptoName: titleCase(p.DPTO_CNMBR),
      bbox: turfBbox(f) as [number, number, number, number],
      area: turfArea(f),
      feature: f as PolyFeature,
    };
  });
  const deptByCode = new Map<string, DepartmentGeo>();
  for (const f of departments.features) {
    const p = f.properties as Record<string, string>;
    deptByCode.set(p.DPTO_CCDGO, {
      code: p.DPTO_CCDGO,
      name: titleCase(p.DPTO_CNMBR),
      bbox: turfBbox(f) as [number, number, number, number],
      municipalities: [],
    });
  }
  for (const m of muniList) deptByCode.get(m.dpto)?.municipalities.push(m);
  for (const d of deptByCode.values()) d.municipalities.sort((a, b) => a.name.localeCompare(b.name, 'es'));
  return { municipalities, departments, muniList, muniByCode: new Map(muniList.map((m) => [m.code, m])), deptByCode };
}

const bboxOverlap = (a: number[], b: number[]) => a[0] <= b[2] && a[2] >= b[0] && a[1] <= b[3] && a[3] >= b[1];

function member(m: MunicipalityGeo, coverage = 1): AreaMember {
  return { mpio: m.code, dpto: m.dpto, name: m.name, dptoName: m.dptoName, coverage };
}

function uniqueDepts(members: AreaMember[]): string[] {
  return [...new Set(members.map((m) => m.dpto))].sort();
}

export function municipalityArea(geo: GeoIndex, code: string): Area | null {
  const m = geo.muniByCode.get(code);
  if (!m) return null;
  return {
    kind: 'municipality', key: `m:${m.code}`, label: m.name, sublabel: `${m.dptoName} · DANE ${m.code}`,
    members: [member(m)], dptoCodes: [m.dpto],
  };
}

export function departmentArea(geo: GeoIndex, code: string): Area | null {
  const d = geo.deptByCode.get(code);
  if (!d) return null;
  return {
    kind: 'department', key: `d:${d.code}`, label: d.name,
    sublabel: `Department · ${d.municipalities.length} municipalities`,
    members: d.municipalities.map((m) => member(m)), dptoCodes: [d.code],
  };
}

export function municipalityAt(geo: GeoIndex, lon: number, lat: number): MunicipalityGeo | null {
  const pt: [number, number] = [lon, lat];
  for (const m of geo.muniList) {
    const b = m.bbox;
    if (lon < b[0] || lon > b[2] || lat < b[1] || lat > b[3]) continue;
    if (booleanPointInPolygon(pt, m.feature)) return m;
  }
  return null;
}

export function pointArea(geo: GeoIndex, lon: number, lat: number): Area | null {
  const m = municipalityAt(geo, lon, lat);
  if (!m) return null;
  const a = municipalityArea(geo, m.code)!;
  return { ...a, kind: 'point', sublabel: `Municipality containing ${lat.toFixed(4)}, ${lon.toFixed(4)} · ${m.dptoName}` };
}

/** Closes a ring and returns a polygon geometry. */
export function ringToPolygon(ring: [number, number][]): GeoJSON.Polygon {
  const closed = [...ring];
  const [f, l] = [closed[0], closed[closed.length - 1]];
  if (f[0] !== l[0] || f[1] !== l[1]) closed.push([f[0], f[1]]);
  return { type: 'Polygon', coordinates: [closed] };
}

export function bboxPolygon(west: number, south: number, east: number, north: number): GeoJSON.Polygon {
  return ringToPolygon([[west, south], [east, south], [east, north], [west, north]]);
}

export function shapeArea(geo: GeoIndex, poly: GeoJSON.Polygon, kind: 'polygon' | 'bbox'): Area {
  const shape = turfPolygon(poly.coordinates);
  const sb = turfBbox(shape);
  const used: AreaMember[] = [];
  const excluded: AreaMember[] = [];
  for (const m of geo.muniList) {
    if (!bboxOverlap(m.bbox, sb)) continue;
    let inter: GeoJSON.Feature | null = null;
    try {
      inter = intersect(featureCollection([shape, m.feature]) as GeoJSON.FeatureCollection<GeoJSON.Polygon | GeoJSON.MultiPolygon>);
    } catch {
      inter = null;
    }
    if (!inter) continue;
    const cov = Math.min(1, turfArea(inter) / m.area);
    if (cov <= 0.001) continue;
    (cov >= MIN_COVERAGE ? used : excluded).push(member(m, cov));
  }
  used.sort((a, b) => b.coverage - a.coverage);
  excluded.sort((a, b) => b.coverage - a.coverage);
  const km2 = turfArea(shape) / 1e6;
  const key = `p:${poly.coordinates[0].slice(0, -1).map(([x, y]) => `${x.toFixed(4)},${y.toFixed(4)}`).join(';')}`;
  return {
    kind,
    key,
    label: kind === 'bbox' ? 'Bounding box' : 'Drawn area',
    sublabel: `${Math.round(km2).toLocaleString('en-US')} km² · ${used.length} municipalities with ≥ 25% inside`,
    members: used,
    excluded,
    dptoCodes: uniqueDepts(used),
    geometry: poly,
  };
}

export function areaBounds(geo: GeoIndex, area: Area): [number, number, number, number] | null {
  if (area.geometry) return turfBbox(area.geometry) as [number, number, number, number];
  let b: [number, number, number, number] | null = null;
  for (const mem of area.members) {
    const m = geo.muniByCode.get(mem.mpio);
    if (!m) continue;
    b = b ? [Math.min(b[0], m.bbox[0]), Math.min(b[1], m.bbox[1]), Math.max(b[2], m.bbox[2]), Math.max(b[3], m.bbox[3])] : [...m.bbox];
  }
  return b;
}

/** Restores an area from its URL key. */
export function areaFromKey(geo: GeoIndex, key: string): Area | null {
  if (key.startsWith('m:')) return municipalityArea(geo, key.slice(2));
  if (key.startsWith('d:')) return departmentArea(geo, key.slice(2));
  if (key.startsWith('p:')) {
    const ring = key.slice(2).split(';').map((p) => p.split(',').map(Number) as [number, number]);
    if (ring.length < 3 || ring.some((p) => p.length !== 2 || p.some((v) => !Number.isFinite(v)))) return null;
    return shapeArea(geo, ringToPolygon(ring), 'polygon');
  }
  return null;
}
