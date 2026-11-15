// Note: Implementation assisted by AI (Claude Code) following Horum Labs' methodology.
// Checks that the web app recomputes the monthly comparison exactly like the data pipeline
// (monthly_municipio / monthly_departamento) and that per-area sums match department totals.
// Run with: npm run verify (after npm run sync-data).
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Area, DeptFile, Manifest, NationalFile, StatusFile } from '../src/lib/types.ts';
import { computeAreaSeries, indexDept, indexNational, makeRefContext, type IndexedDept } from '../src/lib/analysis.ts';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'public', 'data', 'web');
const load = <T>(f: string): T => JSON.parse(readFileSync(path.join(root, f), 'utf8')) as T;
const manifest = load<Manifest>('manifest.json');
const ctx = makeRefContext(manifest.reference_range, load<StatusFile>('status.json'), manifest.harmonization);
const national = indexNational(load<NationalFile>('departments.json'));

let failures = 0;
const check = (label: string, ok: boolean) => { if (!ok) { failures++; if (failures < 25 || process.env.ALL) console.log('MISMATCH', label); } };
const close = (a: number | null, b: number | null, tol: number) =>
  (a === null && b === null) || (a !== null && b !== null && Math.abs(a - b) <= tol);

for (const code of ['52', '50', '99', '11']) {
  const dep = indexDept(load<DeptFile>(`departments/${code}.json`));
  const depts = new Map<string, IndexedDept>([[code, dep]]);
  const firstMo = 0;
  // Every municipality that has monthly rows.
  const munis = new Set(dep.file.monthly.m);
  let rowsChecked = 0;
  for (const m of munis) {
    const u = dep.file.municipalities[m];
    const area: Area = { kind: 'municipality', key: `m:${u.code}`, label: u.name, sublabel: '', dptoCodes: [code],
      members: [{ mpio: u.code, dpto: code, name: u.name, dptoName: '', coverage: 1 }] };
    const s = computeAreaSeries(area, depts, national, ctx);
    const mb = dep.file.monthly;
    for (let r = 0; r < mb.m.length; r++) {
      if (mb.m[r] !== m) continue;
      const row = s.monthly[mb.mo[r] - firstMo];
      rowsChecked++;
      check(`${u.code} mo${mb.mo[r]} cd ${row?.cd} vs ${mb.cd[r]}`, row?.cd === mb.cd[r]);
      check(`${u.code} mo${mb.mo[r]} ad`, row?.ad === mb.ad[r]);
      check(`${u.code} mo${mb.mo[r]} nd`, row?.nd === mb.nd[r]);
      check(`${u.code} mo${mb.mo[r]} ok`, row?.ok === (mb.ok[r] === 1));
      // med and pct are rounded to 2 decimals by the pipeline and to 1 decimal in the web JSON, so the stored
      // value can differ by up to 0.055. Medians include MODIS-era estimates (decimals) since November 15, 2026.
      check(`${u.code} mo${mb.mo[r]} med ${row?.med} vs ${mb.med[r]}`, close(row?.med ?? null, mb.med[r], 0.06));
      check(`${u.code} mo${mb.mo[r]} pct ${row?.pct} vs ${mb.pct[r]}`, close(row?.pct ?? null, mb.pct[r], 0.06));
      check(`${u.code} mo${mb.mo[r]} ratio ${row?.ratio} vs ${mb.ratio[r]}`, close(row?.ratio ?? null, mb.ratio[r], 0.0051)); // stored rounded to 2 decimals
    }
  }
  // Whole department: sum of municipalities vs departments.json monthly.
  const di = national.deptIndex.get(code)!;
  const area: Area = { kind: 'department', key: `d:${code}`, label: code, sublabel: '', dptoCodes: [code],
    members: dep.file.municipalities.map((u) => ({ mpio: u.code, dpto: code, name: u.name, dptoName: '', coverage: 1 })) };
  const s = computeAreaSeries(area, depts, national, ctx);
  const nm = national.file.monthly;
  let deptRows = 0;
  for (const r of national.monthlyRows[di]) {
    const row = s.monthly[nm.mo[r]];
    deptRows++;
    check(`dept ${code} mo${nm.mo[r]} cd ${row.cd} vs ${nm.cd[r]}`, row.cd === nm.cd[r]);
    check(`dept ${code} mo${nm.mo[r]} med ${row.med} vs ${nm.med[r]}`, close(row.med, nm.med[r], 0.06));
    check(`dept ${code} mo${nm.mo[r]} pct ${row.pct} vs ${nm.pct[r]}`, close(row.pct, nm.pct[r], 0.06));
  }
  // 7-day sums vs the alert rows.
  const a = dep.file.alerts;
  for (let r = 0; r < a.m.length; r += 7) {
    const u = dep.file.municipalities[a.m[r]];
    const single: Area = { kind: 'municipality', key: '', label: '', sublabel: '', dptoCodes: [code],
      members: [{ mpio: u.code, dpto: code, name: u.name, dptoName: '', coverage: 1 }] };
    if (r > 2000) break;
    const ss = computeAreaSeries(single, depts, national, ctx);
    check(`c7 ${u.code} d${a.d[r]} ${ss.cells7[a.d[r] - ctx.refStart]} vs ${a.c[r]}`, ss.cells7[a.d[r] - ctx.refStart] === a.c[r]);
  }
  // Single calendar: since November 15, 2026 every area shows the MODIS era (HARMONIZATION.md Part 5),
  // with the reason that drives its warning.
  let eraRows = 0;
  const harm = manifest.harmonization;
  if (harm?.accepted) {
    const status = harm.departments[code]?.status;
    const expectReason = status === 'ok' || status === 'low_confidence' ? 'shown' : status === 'viirs_only' ? 'department_failed' : 'insufficient';
    check(`dept ${code} era shown=${!!s.era}, reason ${s.eraReason} vs ${expectReason}`, !!s.era && s.eraReason === expectReason);
    const first = dep.file.municipalities[0];
    const muni = computeAreaSeries({ kind: 'municipality', key: '', label: '', sublabel: '', dptoCodes: [code],
      members: [{ mpio: first.code, dpto: code, name: first.name, dptoName: '', coverage: 1 }] }, depts, national, ctx);
    check(`municipality ${first.code} shows the era with the not-tested warning`, !!muni.era && muni.eraReason === 'scale_not_tested'
      && muni.era.status === 'not_tested' && muni.era.factorLevel === (harm.departments[code]?.level ?? 1));
    // The department era is the sum of its municipalities' eras.
    if (s.era) {
      let sumM = 0; let sumD = 0;
      for (const u of dep.file.municipalities) {
        const one = computeAreaSeries({ kind: 'municipality', key: '', label: '', sublabel: '', dptoCodes: [code],
          members: [{ mpio: u.code, dpto: code, name: u.name, dptoName: '', coverage: 1 }] }, depts, national, ctx);
        for (let d = 0; d < ctx.refStart; d += 97) sumM += one.era ? one.era.est[d] : 0;
      }
      for (let d = 0; d < ctx.refStart; d += 97) sumD += s.era.est[d];
      check(`dept ${code} era = sum of municipalities (${sumD} vs ${sumM})`, Math.abs(sumD - sumM) < 1e-6 * Math.max(1, sumD));
    }
    const ea = national.file.alerts_modis_era;
    if (s.era && ea && national.eraRows) {
      // The 7-day totals of the rescaled series match the pipeline (stored rounded to 1 decimal).
      for (const r of national.eraRows[di]) {
        eraRows++;
        check(`era c7 dept ${code} d${ea.d[r]} ${s.era.est7[ea.d[r]]} vs ${ea.c[r]}`, Math.abs(s.era.est7[ea.d[r]] - ea.c[r]) <= 0.2);
        check(`era level dept ${code} d${ea.d[r]}`, s.era.level[ea.d[r]] === ea.l[r]);
        check(`era day before the reference dept ${code}`, ea.d[r] < ctx.refStart);
      }
    } else if (ea && national.eraRows) {
      check(`dept ${code} has MODIS-era alerts but is not shown rescaled`, national.eraRows[di].length === 0);
    }
  }
  console.log(`dept ${code}: ${munis.size} municipalities, ${rowsChecked} municipal month rows, ${deptRows} department month rows, ${eraRows} MODIS-era rows`);
}
// Points CSV: for each municipality and day, the points of that day's reference sensor are exactly
// the hot spots the calendar shows.
if (manifest.points) {
  const { gunzipSync } = await import('node:zlib');
  const { existsSync } = await import('node:fs');
  const status = load<StatusFile>('status.json');
  const refSensor = ['VIIRS_SNPP', 'VIIRS_N20', ''];
  let pointRows = 0;
  for (const [code, year] of [['52', 2024], ['50', 2019], ['99', 2022]] as const) {
    const file = path.join(root, manifest.points.path.replace('{dpto}', code).replace('{year}', String(year)));
    if (!existsSync(file)) { check(`points file missing ${code}/${year}`, false); continue; }
    const rows = gunzipSync(readFileSync(file)).toString('utf8').split('\n');
    check(`points header ${code}/${year}`, rows[0] === manifest.points.columns.join(','));
    const counted = new Map<string, number>();
    for (let i = 1; i < rows.length; i++) {
      if (!rows[i]) continue;
      const f = rows[i].split(',');
      const dayIdx = Math.round((Date.parse(f[0]) - Date.parse(status.start)) / 86400000);
      pointRows++;
      if (f[4] !== refSensor[status.status[dayIdx]]) continue;
      const key = `${f[8]}|${f[0]}`;
      counted.set(key, (counted.get(key) ?? 0) + 1);
    }
    const dep = load<DeptFile>(`departments/${code}.json`);
    const base = Date.parse(manifest.day_base);
    let expected = 0;
    for (let r = 0; r < dep.daily.d.length; r++) {
      const iso = new Date(base + dep.daily.d[r] * 86400000).toISOString().slice(0, 10);
      if (!iso.startsWith(String(year))) continue;
      expected++;
      const key = `${dep.municipalities[dep.daily.m[r]].code}|${iso}`;
      check(`points ${key}: ${counted.get(key)} vs calendar ${dep.daily.c[r]}`, counted.get(key) === dep.daily.c[r]);
    }
    check(`points ${code}/${year}: ${counted.size} municipality-days vs calendar ${expected}`, counted.size === expected);
  }
  console.log(`points: ${pointRows} points cross-checked against the calendar values`);
}
console.log(failures ? `FAILED: ${failures} mismatches` : 'OK: web aggregation matches the data pipeline');
process.exit(failures ? 1 : 0);
