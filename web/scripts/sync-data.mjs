// Note: Implementation assisted by AI (Claude Code) following Horum Labs' methodology.
// Copies the files produced by the Data role (data/processed) into web/public/data so the
// static site can serve them. The web branch never edits the data itself, it only copies it.
// GeoJSON coordinates are rounded to 4 decimals (about 11 m; the DANE layers are already
// simplified to 300 m) and saved as .json so every static host serves them gzipped to shrink the download.
import { cp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const processed = path.resolve(webRoot, '..', 'data', 'processed');
const out = path.join(webRoot, 'public', 'data');

const round = (v) => Math.round(v * 1e4) / 1e4;
const roundCoords = (c) => (typeof c[0] === 'number' ? [round(c[0]), round(c[1])] : c.map(roundCoords));

async function copyGeo(source, target, keep) {
  const geo = JSON.parse(await readFile(path.join(processed, source), 'utf8'));
  geo.features = geo.features.map((f) => ({
    type: 'Feature',
    properties: Object.fromEntries(keep.map((k) => [k, f.properties[k]])),
    geometry: { type: f.geometry.type, coordinates: roundCoords(f.geometry.coordinates) },
  }));
  await writeFile(path.join(out, 'geo', target), JSON.stringify(geo));
  return geo.features.length;
}

await rm(out, { recursive: true, force: true });
await mkdir(path.join(out, 'geo'), { recursive: true });
await cp(path.join(processed, 'web'), path.join(out, 'web'), { recursive: true });
const nMun = await copyGeo('dane_mgn2018_municipios.geojson', 'municipalities.json', [
  'MPIO_CDPMP', 'MPIO_CNMBR', 'DPTO_CCDGO', 'DPTO_CNMBR',
]);
const nDep = await copyGeo('dane_mgn2018_departamentos.geojson', 'departments.json', ['DPTO_CCDGO', 'DPTO_CNMBR']);
console.log(`sync-data: copied web JSON, ${nMun} municipalities and ${nDep} departments into public/data`);
