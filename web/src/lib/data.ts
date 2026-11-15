// Note: Implementation assisted by AI (Claude Code) following Horum Labs' methodology.
// Loads the static JSON files copied into public/data by scripts/sync-data.mjs.

import type { DeptFile, Manifest, NationalFile, StatusFile } from './types.ts';
import { indexDept, indexNational, makeRefContext, type IndexedDept, type IndexedNational, type RefContext } from './analysis.ts';
import { buildGeoIndex, type GeoIndex } from './geo.ts';

const DATA_ROOT = `${import.meta.env.BASE_URL}data/`;
const cache = new Map<string, Promise<unknown>>();

export function loadJson<T>(path: string): Promise<T> {
  let p = cache.get(path);
  if (!p) {
    p = fetch(DATA_ROOT + path).then((r) => {
      if (!r.ok) throw new Error(`Could not load ${path} (HTTP ${r.status})`);
      return r.json();
    });
    p.catch(() => cache.delete(path));
    cache.set(path, p);
  }
  return p as Promise<T>;
}

export interface BootData {
  manifest: Manifest;
  ctx: RefContext;
  national: IndexedNational;
  geo: GeoIndex;
}

export async function loadBoot(): Promise<BootData> {
  const [manifest, status, national, municipalities, departments] = await Promise.all([
    loadJson<Manifest>('web/manifest.json'),
    loadJson<StatusFile>('web/status.json'),
    loadJson<NationalFile>('web/departments.json'),
    loadJson<GeoJSON.FeatureCollection>('geo/municipalities.json'),
    loadJson<GeoJSON.FeatureCollection>('geo/departments.json'),
  ]);
  if (manifest.day_base !== '2003-01-01' || manifest.month_base !== '2012-01') {
    throw new Error('Unexpected date bases in manifest.json; the web app expects 2003-01-01 and 2012-01.');
  }
  return {
    manifest,
    ctx: makeRefContext(manifest.reference_range, status, manifest.harmonization),
    national: indexNational(national),
    geo: buildGeoIndex(municipalities, departments),
  };
}

const deptCache = new Map<string, Promise<IndexedDept>>();

export function loadDept(manifest: Manifest, code: string): Promise<IndexedDept> {
  let p = deptCache.get(code);
  if (!p) {
    const meta = manifest.departments.find((d) => d.code === code);
    if (!meta) return Promise.reject(new Error(`Unknown department ${code}`));
    p = loadJson<DeptFile>(`web/${meta.file}`).then(indexDept);
    p.catch(() => deptCache.delete(code));
    deptCache.set(code, p);
  }
  return p;
}
